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

  // APK download endpoint - serves the 110MB APK file
  app.get("/download/apk", (req, res) => {
    const apkPath = path.resolve("android/app/build/outputs/apk/debug/app-debug.apk");
    
    if (!fs.existsSync(apkPath)) {
      return res.status(404).json({ error: "APK not found. Build the APK first." });
    }
    
    const stat = fs.statSync(apkPath);
    
    // Disable request timeout for large file download
    req.setTimeout(0);
    res.setTimeout(0);
    
    // Set headers for download
    res.setHeader("Content-Type", "application/vnd.android.package-archive");
    res.setHeader("Content-Disposition", "attachment; filename=blindfold-chess.apk");
    res.setHeader("Content-Length", stat.size);
    res.setHeader("Cache-Control", "no-cache");
    
    // Stream the file with high watermark for better performance
    const stream = fs.createReadStream(apkPath, { highWaterMark: 1024 * 1024 }); // 1MB chunks
    
    stream.on("error", (err) => {
      console.error("APK stream error:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to stream APK" });
      }
    });
    
    stream.pipe(res);
  });

  return httpServer;
}
