import { Pool } from "pg";
import { E2E_DATABASE_URL, E2E_PREFIX } from "./database";

/**
 * Deletes the accounts and guests the tests created. Their rooms and
 * memberships go with them (foreign keys cascade), and anything else in
 * the database stays.
 */
export default async function globalTeardown(): Promise<void> {
  const pool = new Pool({ connectionString: E2E_DATABASE_URL });
  try {
    const pattern = `${E2E_PREFIX.replace(/_/g, "\\_")}%`;
    await pool.query(
      "delete from users where username like $1 or (is_guest and display_name like $1)",
      [pattern],
    );
  } finally {
    await pool.end();
  }
}
