import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { spawn, ChildProcess } from "child_process";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { handleMediaStream, initializeCallContext } from "./ai-calling";
import { startPinggyAndGetDomain, getCurrentPinggyDomain } from "./pinggy-service";

let pythonProcess: ChildProcess | null = null;

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

async function startPythonBackend(): Promise<boolean> {
  // Disable Python backend for AI calling to prevent domain caching issues
  log('Skipping Python FastAPI backend - using Node.js for AI calling...');
  
  // pythonProcess = spawn('python', ['main.py'], {
  //   stdio: ['ignore', 'pipe', 'pipe'],
  //   cwd: process.cwd()
  // });
  
  // Return true to indicate backend is ready (Node.js only)
  return true;
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
  
  // Start Pinggy tunnel for Twilio AI calling
  log('🔗 Setting up Pinggy tunnel for AI calling...');
  const pinggyDomain = await startPinggyAndGetDomain(5000);
  if (!pinggyDomain) {
    log('⚠️ Warning: Pinggy failed to start. AI calling features may not work.');
  } else {
    log(`✅ Pinggy tunnel established: ${pinggyDomain}`);
  }

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
  httpServer.listen(port, '0.0.0.0', async () => {
    log(`Server running on port ${port} with AI calling support`);
    const domain = await getCurrentPinggyDomain();
    log(`Pinggy domain: ${domain || 'Not available'}`);
  });

  // Cleanup on exit
  process.on('SIGINT', () => {
    log('Shutting down services...');
    if (pythonProcess) {
      pythonProcess.kill();
    }
    wss.close();
    httpServer.close();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    log('Shutting down services...');
    if (pythonProcess) {
      pythonProcess.kill();
    }
    wss.close();
    httpServer.close();
    process.exit(0);
  });
})();
