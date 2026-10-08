import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

type Database = NodePgDatabase<typeof schema>;

// Kept on globalThis so dev hot reloads reuse the pool instead of leaking connections.
const globalForDb = globalThis as unknown as { database?: Database };

function connect(): Database {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set.");
  }
  const pool = new Pool({ connectionString });
  // An idle connection dropped by the database emits "error" on the pool;
  // without a listener that is an uncaught exception and takes the server down.
  pool.on("error", (error) => {
    console.error("database connection lost:", error.message);
  });
  return drizzle(pool, { schema });
}

/** Connects on first use, so importing this module (as `next build` does) needs no database. */
export function getDb(): Database {
  globalForDb.database ??= connect();
  return globalForDb.database;
}
