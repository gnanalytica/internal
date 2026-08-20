/**
 * API error taxonomy.
 *
 * `withApiAuth` used to reflect any thrown `err.message` back to the caller with
 * a 400. That leaked internals (Drizzle constraint text carries table and index
 * names, Neon errors carry connection detail) and flattened genuine server
 * faults into 400s — so a client could not tell "you sent bad input" from "we
 * are broken", and would not retry when it should.
 *
 * Throw `ApiInputError` for anything the caller can fix. Everything else is a
 * 500 with a generic body and the real error in the server log.
 */
export class ApiInputError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "ApiInputError";
    this.status = status;
  }
}

/** Postgres unique-violation. Drizzle surfaces the driver error, so read the
 *  SQLSTATE off whichever shape it arrives in. */
export function isUniqueViolation(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const e = err as { code?: unknown; cause?: unknown };
  if (e.code === "23505") return true;
  // node-postgres / neon wrap the driver error one level down.
  const cause = e.cause as { code?: unknown } | undefined;
  return cause?.code === "23505";
}
