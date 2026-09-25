export interface AIUsage {
  inputTokens: number;
  outputTokens: number;
  /** false when the provider returned real usage numbers */
  estimated: boolean;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface StructuredRequest {
  schemaName: string;
  /** JSON Schema generated from the agent's Zod output schema */
  jsonSchema: Record<string, unknown>;
  messages: ChatMessage[];
  model: string;
  temperature: number | null;
  maxOutputTokens: number | null;
  /**
   * Deterministic generator used by the demo provider. Real providers ignore it.
   * Demo output still goes through the same Zod validation as model output.
   */
  demo?: () => unknown;
}

export interface StructuredResponse {
  raw: string;
  usage: AIUsage;
  model: string;
}

export interface TextRequest {
  messages: ChatMessage[];
  model: string;
  temperature: number | null;
  maxOutputTokens: number | null;
  demo?: () => string;
}

export interface AIProvider {
  readonly id: "demo" | "openai_compatible";
  readonly label: string;
  readonly isDemo: boolean;
  generateStructured(req: StructuredRequest): Promise<StructuredResponse>;
  generateText(req: TextRequest): Promise<StructuredResponse>;
}

/** Rough token estimate (≈4 characters per token) used when a provider returns no usage. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function estimateCostUsd(usage: Pick<AIUsage, "inputTokens" | "outputTokens">, pricing: { inputPerMTok: number; outputPerMTok: number }): number {
  return Math.round(((usage.inputTokens * pricing.inputPerMTok + usage.outputTokens * pricing.outputPerMTok) / 1_000_000) * 1_000_000) / 1_000_000;
}
