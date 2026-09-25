/**
 * Human-readable identifiers. Codes are assigned by the database
 * (`public.next_code`) using the same format; this module mirrors the format for
 * display, parsing and command-bar lookup.
 */
export const CODE_PREFIXES = {
  brand: "PL",
  opportunity: "OPP",
  design: "DES",
  experiment: "EXP",
  mission: "MIS",
  job: "JOB",
  approval: "APR",
  product: "PRD",
  store: "STR",
  campaign: "CMP",
  trend: "TRD",
  insight: "INS",
} as const;

export type CodeEntity = keyof typeof CODE_PREFIXES;
export type CodePrefix = (typeof CODE_PREFIXES)[CodeEntity];

/** Pads to at least four digits and never truncates: 1 → PL-0001, 12345 → PL-12345. */
export function formatCode(prefix: string, n: number): string {
  if (!/^[A-Z]{2,5}$/.test(prefix)) throw new Error(`Invalid code prefix: ${prefix}`);
  if (!Number.isInteger(n) || n < 1) throw new Error(`Invalid code number: ${n}`);
  return `${prefix}-${n < 10000 ? String(n).padStart(4, "0") : String(n)}`;
}

export interface ParsedCode {
  prefix: string;
  number: number;
  entity: CodeEntity | null;
  code: string;
}

export function parseCode(input: string): ParsedCode | null {
  const m = /^\s*([A-Za-z]{2,5})-?(\d{1,9})\s*$/.exec(input);
  if (!m || !m[1] || !m[2]) return null;
  const prefix = m[1].toUpperCase();
  const number = Number.parseInt(m[2], 10);
  if (number < 1) return null;
  const entity =
    (Object.entries(CODE_PREFIXES).find(([, p]) => p === prefix)?.[0] as CodeEntity | undefined) ?? null;
  return { prefix, number, entity, code: formatCode(prefix, number) };
}
