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

