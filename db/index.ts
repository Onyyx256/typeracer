import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { pgPool?: Pool };

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set.");
  }
  const created = new Pool({ connectionString });
  // An idle connection dropped by the database emits "error" on the pool;
  // without a listener that is an uncaught exception and takes the server down.
  created.on("error", (error) => {
    console.error("database connection lost:", error.message);
  });
  return created;
}

// Reuse the pool across hot reloads in dev, otherwise each one leaks connections.
const pool = globalForDb.pgPool ?? createPool();
if (process.env.NODE_ENV !== "production") {
  globalForDb.pgPool = pool;
}

export const db = drizzle(pool, { schema });
