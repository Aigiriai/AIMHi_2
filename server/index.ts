import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";

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
  
  // Initialize unified database manager first
  log('📦 Initializing unified database manager...');
  await getDatabase();
  
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

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
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
