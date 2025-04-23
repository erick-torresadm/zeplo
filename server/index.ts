import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { startAutoMonitoring } from "./auto-responder";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Request logging middleware
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
      log(logLine);
    }
  });
  next();
});

(async () => {
  try {
    const server = await registerRoutes(app);

    // Error handling middleware
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      res.status(status).json({ message });
      log(`Error: ${status} - ${message}`, 'error');
    });

    // Vite setup for development
    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

      const port = process.env.PORT ? parseInt(process.env.PORT) : 5000;
      const host = process.env.HOST || '0.0.0.0';

      // Ensure port is a number
      if (isNaN(port)) {
        throw new Error(`Invalid port number: ${process.env.PORT}`);
      }

      server.listen(port, host, () => {
        log(`Server running on http://${host}:${port}`);
        startAutoMonitoring(1);
        log(`Auto-responder started. Monitoring messages every 1 second`);
      });

    // Handle server errors
    server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        log(`Port ${port} is already in use`, 'error');
      } else {
        log(`Server error: ${error.message}`, 'error');
      }
      process.exit(1);
    });

  } catch (error) {
    log(`Failed to start server: ${error}`, 'error');
    process.exit(1);
  }
})();