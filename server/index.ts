import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import path from "path";

import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { handleMediaStream, initializeCallContext } from "./ai-calling";
// Updated to use unified database manager
import { getDatabase } from "./unified-db-manager";

// Function to get direct domain based on environment
function getDirectDomain(): string {
  if (process.env.NODE_ENV === 'production') {
    return 'aimhi.aigiri.ai';
  } else {
    // Development environment - use Replit development URL
    // This will be something like: your-repl-name.username.replit.dev
    const replitUrl = process.env.REPLIT_DOMAINS || process.env.REPL_SLUG;
    if (replitUrl) {
      return replitUrl.replace('https://', '').replace('http://', '');
    }
    // Fallback for development
    return 'localhost:5000';
  }
}

export { getDirectDomain };



const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ✅ COMPREHENSIVE REQUEST LOGGING MIDDLEWARE
app.use((req, res, next) => {
  const requestId = Math.random().toString(36).substr(2, 9);
  const startTime = Date.now();
  
  // Add request ID to request object for tracking
  (req as any).requestId = requestId;
  
  // console.log(`📥 REQUEST[${requestId}]: ============= INCOMING REQUEST =============`);
  // console.log(`📥 REQUEST[${requestId}]: ${req.method} ${req.originalUrl}`);
  // console.log(`📥 REQUEST[${requestId}]: Headers:`, {
  //   'content-type': req.headers['content-type'],
  //   'authorization': req.headers.authorization ? 'Bearer [TOKEN]' : 'None',
  //   'user-agent': req.headers['user-agent']?.substring(0, 50) + '...',
  //   'origin': req.headers.origin,
  //   'referer': req.headers.referer
  // });
  // console.log(`📥 REQUEST[${requestId}]: Query:`, req.query);
  // console.log(`📥 REQUEST[${requestId}]: Body size:`, JSON.stringify(req.body || {}).length, 'bytes');
  
  // Override res.json to log responses
  const originalJson = res.json.bind(res);
  res.json = function(data: any) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // console.log(`📤 RESPONSE[${requestId}]: ============= OUTGOING RESPONSE =============`);
    // console.log(`📤 RESPONSE[${requestId}]: Status: ${res.statusCode} | Duration: ${duration}ms`);
    // console.log(`📤 RESPONSE[${requestId}]: Response size:`, JSON.stringify(data || {}).length, 'bytes');
    console.log(`📤 RESPONSE[${requestId}]: ${req.method} ${req.originalUrl} -> ${res.statusCode} (${duration}ms)`);
    
    return originalJson(data);
  };
  
  // Track request timeout
  req.setTimeout(30000, () => {
    console.log(`⏰ REQUEST[${requestId}]: Request timeout after 30s - ${req.method} ${req.originalUrl}`);
  });
  
  next();
});

async function waitForService(url: string, serviceName: string, maxRetries = 30): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        log(`${serviceName} is ready`);
        return true;
      }
    } catch (error) {
      // Service not ready yet
    }
    
    if (i % 5 === 0) { // Log every 5 seconds
      log(`Waiting for ${serviceName}... (${i + 1}/${maxRetries})`);
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  log(`${serviceName} failed to start after ${maxRetries} seconds`);
  return false;
}



app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Single Node.js backend for cost optimization - disable Python backend for AI calling
  log('Initializing consolidated Node.js backend...');
  
  // Initialize unified database manager in background (non-blocking)
  log('📦 Initializing unified database manager...');
  const dbPromise = getDatabase().catch(error => {
    console.error('❌ DATABASE: Failed to initialize database:', error);
    console.log('⚠️ SERVER: Continuing without database - some features may not work');
    return null;
  });
  
  // Don't wait for database - continue with server setup
  log('🚀 SERVER: Starting server (database initializing in background)...');
  
  // Using direct Replit URLs for AI calling (eliminates Pinggy tunnel dependency)
  log('🔗 AI calling configured for direct webhooks (no tunnel required)');

  // Create HTTP server and WebSocket server
  const httpServer = createServer(app);
  const wss = new WebSocketServer({ server: httpServer, path: '/media-stream' });

  // Handle WebSocket connections for AI calling
  wss.on('connection', (ws) => {
    handleMediaStream(ws);
  });

  // AI calling route disabled - using routes.ts handler with context storage instead

  // Initialize call context from previous session
  initializeCallContext();
  
  await registerRoutes(app);

  // Log database status after routes are registered
  dbPromise.then(db => {
    if (db) {
      log('✅ DATABASE: Database initialization completed successfully');
    } else {
      log('❌ DATABASE: Database initialization failed - check logs above');
    }
  });

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // CRITICAL: Static file serving must come AFTER API routes registration
  // This ensures API routes are handled before the catch-all static handler
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
    
    // ✅ DEPLOYMENT FIX: Add explicit SPA routing catch-all for deployment
    // This ensures /management and other SPA routes work in production
    app.get("*", (req, res, next) => {
      // Skip API routes (already handled above)
      if (req.path.startsWith('/api/')) {
        return next();
      }
      
      // Skip static assets
      if (req.path.startsWith('/assets/') || 
          req.path.match(/\.(js|css|ico|png|jpg|svg)$/)) {
        return next();
      }
      
      // Serve index.html for all SPA routes
      const indexPath = path.resolve(import.meta.dirname, "public", "index.html");
      console.log(`🔄 SPA_ROUTE: Serving ${req.path} -> index.html`);
      res.sendFile(indexPath, (err) => {
        if (err) {
          console.error(`❌ SPA_ROUTE: Error serving ${req.path}:`, err);
          res.status(404).send('Page not found');
        }
      });
    });
  } else {
    await setupVite(app, httpServer);
  }

  // Start the server
  const port = 5000;
  httpServer.listen(port, '0.0.0.0', () => {
    log(`Server running on port ${port} with AI calling support`);
    const directDomain = getDirectDomain();
    log(`Direct webhook domain: ${directDomain}`);
  });

  // Cleanup on exit
  process.on('SIGINT', () => {
    log('Shutting down services...');
    wss.close();
    httpServer.close();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    log('Shutting down services...');
    wss.close();
    httpServer.close();
    process.exit(0);
  });
})();
