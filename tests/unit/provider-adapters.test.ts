import { afterEach, describe, expect, it, vi } from "vitest";
import { OpenAICompatibleProvider } from "@/providers/ai/openai-compatible";
import { ProviderNotConfiguredError } from "@/providers/errors";
import { TavilyResearchProvider } from "@/providers/research/tavily";
import { checkDomain } from "@/providers/domains";

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const req = { schemaName: "s", jsonSchema: { type: "object" }, messages: [{ role: "user" as const, content: "hi" }], model: "gpt-x", temperature: 0.2, maxOutputTokens: 500 };

afterEach(() => vi.unstubAllGlobals());

describe("OpenAI-compatible provider", () => {
  it("sends a json_schema request and returns real usage", async () => {
    const fetchMock = vi.fn(async () => json(200, { model: "gpt-x-2026", choices: [{ message: { content: '{"a":1}' } }], usage: { prompt_tokens: 12, completion_tokens: 3 } }));
    vi.stubGlobal("fetch", fetchMock);
    const p = new OpenAICompatibleProvider({ apiKey: "k", baseUrl: "https://api.example.com/v1/", responseFormat: "json_schema", maxTokensParam: "max_completion_tokens" });
    const r = await p.generateStructured(req);
    expect(r).toEqual({ raw: '{"a":1}', model: "gpt-x-2026", usage: { inputTokens: 12, outputTokens: 3, estimated: false } });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.example.com/v1/chat/completions");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer k");
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({ model: "gpt-x", temperature: 0.2, max_completion_tokens: 500, response_format: { type: "json_schema", json_schema: { name: "s" } } });
  });

  it("puts the schema in the prompt for json_object mode", async () => {
    const fetchMock = vi.fn(async () => json(200, { choices: [{ message: { content: "{}" } }] }));
    vi.stubGlobal("fetch", fetchMock);
    const p = new OpenAICompatibleProvider({ apiKey: "k", baseUrl: "https://x/v1", responseFormat: "json_object", maxTokensParam: "max_tokens" });
    const r = await p.generateStructured(req);
    const body = JSON.parse(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(body.messages.at(-1).content).toMatch(/JSON Schema/);
    expect(r.usage.estimated).toBe(true);
  });

  it("retries transient errors and fails fast on client errors", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValueOnce(json(429, { error: { message: "slow down" } })).mockResolvedValueOnce(json(200, { choices: [{ message: { content: "{}" } }] }));
    vi.stubGlobal("fetch", fetchMock);
    const p = new OpenAICompatibleProvider({ apiKey: "k", baseUrl: "https://x/v1", responseFormat: "json_schema", maxTokensParam: "max_tokens" });
    const pending = p.generateStructured(req);
    await vi.runAllTimersAsync();
    await expect(pending).resolves.toMatchObject({ raw: "{}" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.useRealTimers();

    vi.stubGlobal("fetch", vi.fn(async () => json(401, { error: { message: "bad key" } })));
    await expect(p.generateStructured(req)).rejects.toThrow(/401: bad key/);
    vi.stubGlobal("fetch", vi.fn(async () => json(200, { choices: [{ message: { content: null, refusal: "no" } }] })));
    await expect(p.generateStructured(req)).rejects.toThrow(/refused/);
  });

  it("requires an API key", async () => {
    const p = new OpenAICompatibleProvider({ apiKey: undefined, baseUrl: "https://x/v1", responseFormat: "json_schema", maxTokensParam: "max_tokens" });
    await expect(p.generateStructured(req)).rejects.toBeInstanceOf(ProviderNotConfiguredError);
  });
});

describe("Tavily research provider", () => {
  it("returns only documents the API returned, with retrieval metadata", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(200, { results: [{ title: "Nurse merch trends", url: "https://www.reddit.com/r/nursing/x", content: "snippet", published_date: "2026-08-01" }, { title: "bad", url: "javascript:alert(1)" }] })));
    const docs = await new TavilyResearchProvider("k").search("nurse merch", { maxResults: 5 });
    expect(docs).toHaveLength(1);
    expect(docs[0]).toMatchObject({ url: "https://www.reddit.com/r/nursing/x", sourceType: "reddit", publisher: "reddit.com" });
    expect(docs[0]!.publishedAt).toBe("2026-08-01T00:00:00.000Z");
    expect(Date.parse(docs[0]!.retrievedAt)).not.toBeNaN();
  });

  it("requires an API key", async () => {
    await expect(new TavilyResearchProvider(undefined).search("x", { maxResults: 1 })).rejects.toBeInstanceOf(ProviderNotConfiguredError);
  });
});

describe("RDAP domain checks", () => {
  it("reports unverified when disabled and never claims availability as certain", async () => {
    expect((await checkDomain("Example.com", { rdapEnabled: false })).availability).toBe("unverified");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 404 })));
    const free = await checkDomain("unregistered-podlab-test.com", { rdapEnabled: true });
    expect(free.availability).toBe("likely_available");
    expect(free.note).toMatch(/Confirm at a registrar/);
    vi.stubGlobal("fetch", vi.fn(async () => json(200, {})));
    expect((await checkDomain("example.com", { rdapEnabled: true })).availability).toBe("taken");
  });
});
