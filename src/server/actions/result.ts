import { z } from "zod";
import { UserFacingError } from "../services/errors";

export type ActionResult<T = undefined> =
  | { ok: true; message?: string; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export const idle: ActionResult = { ok: true };

/** Normalises thrown errors into a safe ActionResult (never leaks internals). */
export function toActionError(err: unknown): ActionResult<never> {
  if (err instanceof UserFacingError) return { ok: false, error: err.message };
  if (err instanceof z.ZodError) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of err.issues) {
      const key = String(issue.path[0] ?? "form");
      fieldErrors[key] ??= issue.message;
    }
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }
  // Next.js control-flow errors (redirect/notFound) must propagate.
  if (err && typeof err === "object" && "digest" in err && typeof (err as { digest: unknown }).digest === "string" && (err as { digest: string }).digest.startsWith("NEXT_")) throw err;
  console.error("[action] unexpected error", err);
  return { ok: false, error: err instanceof Error && err.message ? `Something went wrong: ${err.message.slice(0, 200)}` : "Something went wrong." };
}

/** Reads FormData into a plain object (repeated keys become arrays). */
export function formToObject(fd: FormData): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const [k, v] of fd.entries()) {
    if (typeof v !== "string" || k.startsWith("$ACTION")) continue;
    const prev = out[k];
    if (prev === undefined) out[k] = v;
    else out[k] = Array.isArray(prev) ? [...prev, v] : [prev, v];
  }
  return out;
}
