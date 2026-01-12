import type { Express } from "express";
import { createServer, type Server } from "http";
import path from "path";
import fs from "fs";

// Minimal routes for blindfold chess app
// The app is fully client-side - this just serves the static files

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // Health check endpoint
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", app: "blindfold-chess" });
  });

  // APK download endpoint
  app.get("/download/apk", (_req, res) => {
    const apkPath = path.resolve("android/app/build/outputs/apk/debug/app-debug.apk");
    
    if (!fs.existsSync(apkPath)) {
      return res.status(404).json({ error: "APK not found. Build the APK first." });
    }
    
    const stat = fs.statSync(apkPath);
    res.setHeader("Content-Type", "application/vnd.android.package-archive");
    res.setHeader("Content-Disposition", "attachment; filename=blindfold-chess.apk");
    res.setHeader("Content-Length", stat.size);
    
    const stream = fs.createReadStream(apkPath);
    stream.pipe(res);
  });

  return httpServer;
}
