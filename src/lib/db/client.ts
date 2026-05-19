// ── NEON CLIENT: MODULE-LEVEL SINGLETON ────────────────────────────────
//
// neon() returns an HTTP-based SQL tag function, not a connection pool.
// Each call to neon() creates a new client object but re-uses the same
// underlying fetch infrastructure. Caching the instance avoids rebuilding
// it on every request in a warm serverless instance — negligible overhead
// in practice but aligns with the pattern for heavier drivers (pg, postgres.js)
// where connection pool reuse is critical for throughput.
//
// The @neondatabase/serverless driver uses HTTP/2 by default on Node 18+,
// making it suitable for Fluid Compute's concurrent request model.
// No connection pooling config is needed — Neon's HTTP API handles
// concurrency server-side.
import { neon } from "@neondatabase/serverless";

let cachedClient: ReturnType<typeof neon> | null = null;

export function getDb() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is not configured. Install Neon via Vercel Marketplace and pull env vars."
    );
  }

  if (!cachedClient) {
    cachedClient = neon(databaseUrl);
  }

  return cachedClient;
}

