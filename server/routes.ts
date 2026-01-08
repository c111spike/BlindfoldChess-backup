import type { Express } from "express";
import { createServer, type Server } from "http";

// Minimal routes for blindfold chess app
// The app is fully client-side - this just serves the static files

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // Health check endpoint
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", app: "blindfold-chess" });
  });

  return httpServer;
}
