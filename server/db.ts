import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// PostgreSQL can terminate idle pooled connections during endpoint restarts or
// maintenance. Without an error listener, node-postgres emits an unhandled
// "error" event and exits the entire web process. The pool already discards the
// failed client and opens a fresh connection for the next query.
pool.on("error", (error) => {
  console.error("[database] Idle client connection error; the pool will reconnect:", error.message);
});

export const db = drizzle(pool, { schema });
