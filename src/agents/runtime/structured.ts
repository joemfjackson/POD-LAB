import { z, type ZodType } from "zod";
import type { AIProvider, AIUsage, ChatMessage } from "@/providers/ai/types";

export interface ValidationIssue {
  path: string;
  message: string;
}

export type GenerateResult<T> =
  | { ok: true; data: T; raw: string; usage: AIUsage; model: string; attempts: number; validationHistory: ValidationIssue[][] }
  | { ok: false; raw: string; usage: AIUsage; model: string; attempts: number; validationHistory: ValidationIssue[][]; error: string };

/** Extracts a JSON value from model text (tolerates ```json fences and leading prose). */
export function extractJson(raw: string): unknown {
  const trimmed = raw.trim();
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
  const candidate = fenced?.[1]?.trim() ?? trimmed;
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(candidate.slice(start, end + 1));
    throw new Error("Response is not valid JSON");
  }
}

export function validateOutput<T>(schema: ZodType<T>, raw: string): { ok: true; data: T } | { ok: false; issues: ValidationIssue[] } {
  let parsed: unknown;
  try {
    parsed = extractJson(raw);
  } catch (e) {
    return { ok: false, issues: [{ path: "$", message: e instanceof Error ? e.message : "Invalid JSON" }] };
  }
  const result = schema.safeParse(parsed);
  if (result.success) return { ok: true, data: result.data };
  return {
    ok: false,
    issues: result.error.issues.slice(0, 25).map((i) => ({ path: i.path.length ? i.path.join(".") : "$", message: i.message })),
  };
}

export function toJsonSchema(schema: ZodType): Record<string, unknown> {
  return z.toJSONSchema(schema, { target: "draft-7", unrepresentable: "any" }) as Record<string, unknown>;
}

/**
 * Calls the model and validates against the Zod schema. On validation failure
 * it retries with the validation errors fed back to the model. Malformed
 * output is never returned as data.
 */
export async function generateValidated<T>(opts: {
  provider: AIProvider;
  schema: ZodType<T>;
  schemaName: string;
  system: string;
  user: string;
  model: string;
  temperature: number | null;
  maxOutputTokens: number | null;
  demo?: () => T;
  maxValidationRetries?: number;
}): Promise<GenerateResult<T>> {
  const maxRetries = opts.maxValidationRetries ?? 2;
  const jsonSchema = toJsonSchema(opts.schema);
  const messages: ChatMessage[] = [
    { role: "system", content: opts.system },
    { role: "user", content: opts.user },
  ];
  const usage: AIUsage = { inputTokens: 0, outputTokens: 0, estimated: false };
  const validationHistory: ValidationIssue[][] = [];
  let raw = "";
  let model = opts.model;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    const res = await opts.provider.generateStructured({
      schemaName: opts.schemaName,
      jsonSchema,
      messages,
      model: opts.model,
      temperature: opts.temperature,
      maxOutputTokens: opts.maxOutputTokens,
      demo: opts.demo,
    });
    raw = res.raw;
    model = res.model;
    usage.inputTokens += res.usage.inputTokens;
    usage.outputTokens += res.usage.outputTokens;
    usage.estimated = usage.estimated || res.usage.estimated;

    const v = validateOutput(opts.schema, raw);
    if (v.ok) return { ok: true, data: v.data, raw, usage, model, attempts: attempt, validationHistory };
    validationHistory.push(v.issues);
    messages.push(
      { role: "assistant", content: raw.slice(0, 20000) },
      {
        role: "user",
        content: `Your previous response failed schema validation:\n${v.issues
          .map((i) => `- ${i.path}: ${i.message}`)
          .join("\n")}\nReturn the complete corrected JSON object only.`,
      },
    );
  }
  return {
    ok: false,
    raw,
    usage,
    model,
    attempts: maxRetries + 1,
    validationHistory,
    error: `Output failed validation after ${maxRetries + 1} attempt(s)`,
  };
}
