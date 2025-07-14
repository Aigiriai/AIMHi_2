import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { initializeSQLiteDB } from "./sqlite-db";
import { fileStorage } from "./file-storage";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

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
  try {
    // Initialize SQLite database
    log('🚀 Initializing cost-optimized AIM Hi System with SQLite...');
    
    await initializeSQLiteDB();
    log('✅ SQLite database initialized successfully');
    
    const server = await registerRoutes(app);

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      res.status(status).json({ message });
      throw err;
    });

    if (app.get("env") === "development") {
      setupVite(app, server);
    } else {
      serveStatic(app);
    }

    // Setup automatic file cleanup for cost optimization
    setInterval(async () => {
      try {
        await fileStorage.cleanupOldFiles(30); // Clean files older than 30 days
        log('🧹 File cleanup completed');
      } catch (error) {
        log('File cleanup error:', error);
      }
    }, 24 * 60 * 60 * 1000); // Run daily

    log('✅ Cost-optimized system ready');
    log('📊 Using SQLite + File Storage (zero database hosting costs)');
    
  } catch (error) {
    console.error('Startup error:', error);
    process.exit(1);
  }
})();