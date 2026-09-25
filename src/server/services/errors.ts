/** Error safe to show to the user (validation, permissions, workflow rules). */
export class UserFacingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserFacingError";
  }
}

/** Maps Postgres/PostgREST errors raised by guards and RLS to readable messages. */
export function describeDbError(err: { message: string; code?: string } | null | undefined, fallback: string): string {
  if (!err) return fallback;
  if (err.code === "42501") return err.message.includes("row-level security") ? "You do not have permission to do that in this workspace." : err.message;
  if (err.code === "23505") return "That record already exists.";
  if (err.code === "23514") return err.message.replace(/^new row .* violates check constraint/, "Invalid value:");
  return err.message || fallback;
}
