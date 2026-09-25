import { describe, expect, it } from "vitest";
import { z } from "zod";
import { extractJson, generateValidated, toJsonSchema, validateOutput } from "@/agents/runtime/structured";
import { DemoAIProvider } from "@/providers/ai/demo";
import type { AIProvider, StructuredRequest, StructuredResponse } from "@/providers/ai/types";

const schema = z.object({ name: z.string().min(1), score: z.number().min(0).max(10) });

class ScriptedProvider implements AIProvider {
  readonly id = "openai_compatible" as const;
  readonly label = "scripted";
  readonly isDemo = false;
  calls: StructuredRequest[] = [];
  constructor(private readonly outputs: string[]) {}
  async generateStructured(req: StructuredRequest): Promise<StructuredResponse> {
    this.calls.push(structuredClone(req));
    const raw = this.outputs.shift() ?? "{}";
    return { raw, model: "scripted", usage: { inputTokens: 10, outputTokens: 5, estimated: false } };
  }
  async generateText(): Promise<StructuredResponse> {
    throw new Error("unused");
  }
}

const base = { schema, schemaName: "t", system: "sys", user: "usr", model: "m", temperature: 0, maxOutputTokens: 100 };

describe("structured output validation", () => {
  it("extracts JSON from fences and surrounding prose", () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('Sure! {"a":2} hope that helps')).toEqual({ a: 2 });
    expect(() => extractJson("no json here")).toThrow();
  });

  it("returns path-level issues for invalid output", () => {
    const r = validateOutput(schema, '{"name":"","score":11}');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues.map((i) => i.path).sort()).toEqual(["name", "score"]);
  });

  it("accepts valid output on the first attempt", async () => {
    const p = new ScriptedProvider(['{"name":"ok","score":5}']);
    const r = await generateValidated({ ...base, provider: p });
    expect(r.ok).toBe(true);
    expect(r.attempts).toBe(1);
    expect(r.usage).toEqual({ inputTokens: 10, outputTokens: 5, estimated: false });
  });

  it("retries with the validation errors fed back to the model", async () => {
    const p = new ScriptedProvider(['{"name":"x","score":42}', '{"name":"x","score":4}']);
    const r = await generateValidated({ ...base, provider: p });
    expect(r.ok).toBe(true);
    expect(r.attempts).toBe(2);
    expect(r.validationHistory).toHaveLength(1);
    const feedback = p.calls[1]!.messages.at(-1)!.content;
    expect(feedback).toMatch(/failed schema validation/);
    expect(feedback).toMatch(/score/);
    expect(r.usage.inputTokens).toBe(20);
  });

  it("never returns malformed data after exhausting retries", async () => {
    const p = new ScriptedProvider(["nope", '{"name":1}', '{"score":-1}']);
    const r = await generateValidated({ ...base, provider: p, maxValidationRetries: 2 });
    expect(r.ok).toBe(false);
    expect(r.attempts).toBe(3);
    expect("data" in r).toBe(false);
    expect(r.validationHistory).toHaveLength(3);
  });

  it("runs demo generators through the same validation", async () => {
    const good = await generateValidated({ ...base, provider: new DemoAIProvider(), demo: () => ({ name: "demo", score: 3 }) });
    expect(good.ok).toBe(true);
    const bad = await generateValidated({ ...base, provider: new DemoAIProvider(), demo: () => ({ name: "", score: 30 }) });
    expect(bad.ok).toBe(false);
  });

  it("produces a JSON schema for the provider", () => {
    const js = toJsonSchema(schema);
    expect(js.type).toBe("object");
    expect(js.required).toEqual(["name", "score"]);
  });
});
