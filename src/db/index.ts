import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "./schema";

/**
 * Drizzle client over Neon's HTTP driver.
 *
 * Built lazily on first use. `next build` evaluates route modules (which import
 * `db` transitively) while collecting page data; constructing eagerly here would
 * require DATABASE_URL to be present at build time and fail the build when it
 * isn't (e.g. preview deployments). The connection string is only needed to
 * actually run a query, so we defer construction until then.
 */
function createDb() {
  const sql = neon(process.env.DATABASE_URL!);
  return drizzle(sql, { schema });
}

type Database = ReturnType<typeof createDb>;

let instance: Database | null = null;

function resolveDb(): Database {
  if (!instance) instance = createDb();
  return instance;
}

export const db = new Proxy({} as Database, {
  get(_target, prop, receiver) {
    const real = resolveDb();
    const value = Reflect.get(real as object, prop, receiver);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export { schema };
