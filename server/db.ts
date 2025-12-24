import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Connection pool optimized for high concurrency (10K-100K+ players)
// Neon's serverless pooler handles connection multiplexing automatically
// These settings work with Neon's built-in connection pooler (port 5432)
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  // Max connections per Node.js process (Neon pooler handles the rest)
  max: 20,
  // Close idle connections after 30 seconds to free pooler slots
  idleTimeoutMillis: 30000,
  // Wait up to 10 seconds for a connection from the pool
  connectionTimeoutMillis: 10000,
});

// Handle pool errors gracefully (Neon can terminate connections during scaling)
pool.on('error', (err) => {
  console.error('PG Pool error:', err);
  // Don't crash the server on pool errors - connections will be recreated
});

// Export db with schema for type-safe queries
export const db = drizzle({ client: pool, schema });
