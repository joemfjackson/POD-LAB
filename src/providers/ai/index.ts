import "server-only";
import { serverEnv } from "@/lib/env";
import { DemoAIProvider } from "./demo";
import { OpenAICompatibleProvider } from "./openai-compatible";
import type { AIProvider } from "./types";

export type { AIProvider } from "./types";

export interface AIProviderOverrides {
  provider?: string | null;
  apiKey?: string | null;
}

/**
 * Resolves the AI provider for a run. Precedence: agent/workspace override →
 * environment. An encrypted workspace credential (approved by the owner) can
 * supply the API key; otherwise AI_API_KEY is used.
 */
export function getAIProvider(overrides: AIProviderOverrides = {}): AIProvider {
  const env = serverEnv();
  const provider = overrides.provider ?? env.AI_PROVIDER;
  if (provider === "openai_compatible") {
    return new OpenAICompatibleProvider({
      apiKey: overrides.apiKey ?? env.AI_API_KEY,
      baseUrl: env.AI_BASE_URL,
      responseFormat: env.AI_RESPONSE_FORMAT,
      maxTokensParam: env.AI_MAX_TOKENS_PARAM,
    });
  }
  return new DemoAIProvider();
}

export function aiPricing() {
  const env = serverEnv();
  return { inputPerMTok: env.AI_PRICE_INPUT_PER_MTOK, outputPerMTok: env.AI_PRICE_OUTPUT_PER_MTOK };
}
