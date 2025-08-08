import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import { nanoid } from "nanoid";

const viteLogger = createLogger();

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(import.meta.dirname, "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // ✅ ENHANCED SPA ROUTING: Explicit handling for protected routes
  // This prevents API routes from being intercepted by the catch-all
  app.get("*", (req, res, next) => {
    // Skip API routes - let them be handled by the API handlers
    if (req.path.startsWith('/api/')) {
      console.log(`🔄 STATIC_SERVE: Skipping API route: ${req.path}`);
      return next();
    }
    
    // Skip static assets
    if (req.path.startsWith('/assets/') || 
        req.path.match(/\.(js|css|ico|png|jpg|jpeg|svg|woff|woff2|ttf|eot|map)$/)) {
      console.log(`🔄 STATIC_SERVE: Skipping static asset: ${req.path}`);
      return next();
    }
    
    // Serve index.html for all SPA routes with proper headers
    console.log(`📁 STATIC_SERVE: Serving index.html for SPA route: ${req.path}`);
    
    const indexPath = path.resolve(distPath, "index.html");
    
    // Set cache control headers to prevent caching of index.html
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    res.sendFile(indexPath, (err) => {
      if (err) {
        console.error(`❌ STATIC_SERVE: Error serving index.html for ${req.path}:`, err);
        res.status(500).send('Internal Server Error');
      }
    });
  });
}
