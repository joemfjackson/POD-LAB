import { ProviderNotConfiguredError, ProviderTransientError, fetchWithTimeout } from "../errors";
import type { AIProvider, AIUsage, ChatMessage, StructuredRequest, StructuredResponse, TextRequest } from "./types";
import { estimateTokens } from "./types";

export interface OpenAICompatibleConfig {
  apiKey: string | undefined;
  baseUrl: string;
  responseFormat: "json_schema" | "json_object";
  maxTokensParam: "max_tokens" | "max_completion_tokens";
  timeoutMs?: number;
}

interface ChatCompletionResponse {
  model?: string;
  choices?: Array<{ message?: { content?: string | null; refusal?: string | null }; finish_reason?: string }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  error?: { message?: string };
}

/**
 * Chat Completions-compatible provider (OpenAI, OpenRouter, Together, Groq,
 * vLLM/Ollama gateways, Anthropic's OpenAI-compatible endpoint, ...).
 */
export class OpenAICompatibleProvider implements AIProvider {
  readonly id = "openai_compatible" as const;
  readonly label: string;
  readonly isDemo = false;

  constructor(private readonly config: OpenAICompatibleConfig) {
    this.label = `OpenAI-compatible (${safeHost(config.baseUrl)})`;
  }

  async generateStructured(req: StructuredRequest): Promise<StructuredResponse> {
    const response_format =
      this.config.responseFormat === "json_schema"
        ? { type: "json_schema", json_schema: { name: req.schemaName, schema: req.jsonSchema, strict: false } }
        : { type: "json_object" };
    const messages: ChatMessage[] =
      this.config.responseFormat === "json_object"
        ? [
            ...req.messages,
            {
              role: "system",
              content: `Respond with a single JSON object that conforms to this JSON Schema:\n${JSON.stringify(req.jsonSchema)}`,
            },
          ]
        : req.messages;
    return this.complete(messages, req.model, req.temperature, req.maxOutputTokens, response_format);
  }

  async generateText(req: TextRequest): Promise<StructuredResponse> {
    return this.complete(req.messages, req.model, req.temperature, req.maxOutputTokens, undefined);
  }

  private async complete(
    messages: ChatMessage[],
    model: string,
    temperature: number | null,
    maxOutputTokens: number | null,
    responseFormat: Record<string, unknown> | undefined,
  ): Promise<StructuredResponse> {
    if (!this.config.apiKey) throw new ProviderNotConfiguredError("AI provider", "set AI_API_KEY");
    const body: Record<string, unknown> = { model, messages };
    if (temperature !== null) body.temperature = temperature;
    if (maxOutputTokens !== null) body[this.config.maxTokensParam] = maxOutputTokens;
    if (responseFormat) body.response_format = responseFormat;

    const url = `${this.config.baseUrl.replace(/\/+$/, "")}/chat/completions`;
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) await sleep(1000 * 2 ** attempt);
      const res = await fetchWithTimeout(url, {
        method: "POST",
        timeoutMs: this.config.timeoutMs ?? 180_000,
        headers: { "content-type": "application/json", authorization: `Bearer ${this.config.apiKey}` },
        body: JSON.stringify(body),
      }).catch((e: unknown) => {
        lastError = e instanceof Error ? e : new Error(String(e));
        return null;
      });
      if (!res) continue;
      const json = (await res.json().catch(() => ({}))) as ChatCompletionResponse;
      if (res.status === 429 || res.status >= 500) {
        lastError = new ProviderTransientError(`AI provider returned ${res.status}: ${json.error?.message ?? res.statusText}`);
        continue;
      }
      if (!res.ok) throw new Error(`AI provider returned ${res.status}: ${json.error?.message ?? res.statusText}`);
      const choice = json.choices?.[0];
      if (choice?.message?.refusal) throw new Error(`Model refused: ${choice.message.refusal}`);
      const raw = choice?.message?.content ?? "";
      if (!raw) throw new Error(`AI provider returned an empty response (finish_reason: ${choice?.finish_reason ?? "unknown"})`);
      const usage: AIUsage =
        json.usage?.prompt_tokens !== undefined && json.usage?.completion_tokens !== undefined
          ? { inputTokens: json.usage.prompt_tokens, outputTokens: json.usage.completion_tokens, estimated: false }
          : {
              inputTokens: estimateTokens(messages.map((m) => m.content).join("\n")),
              outputTokens: estimateTokens(raw),
              estimated: true,
            };
      return { raw, usage, model: json.model ?? model };
    }
    throw lastError ?? new ProviderTransientError("AI provider request failed");
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "invalid URL";
  }
}
