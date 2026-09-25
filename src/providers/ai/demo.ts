import type { AIProvider, StructuredRequest, StructuredResponse, TextRequest } from "./types";
import { estimateTokens } from "./types";

/**
 * Deterministic demo provider. Makes NO external calls and produces clearly
 * labelled placeholder output via each agent's demo generator. It exists so the
 * whole workflow can be exercised before an AI key is configured.
 */
export class DemoAIProvider implements AIProvider {
  readonly id = "demo" as const;
  readonly label = "Demo provider (deterministic placeholders — no AI, no research)";
  readonly isDemo = true;

  async generateStructured(req: StructuredRequest): Promise<StructuredResponse> {
    if (!req.demo) throw new Error(`Demo provider has no generator for ${req.schemaName}`);
    const raw = JSON.stringify(req.demo());
    return {
      raw,
      model: "demo-deterministic-v1",
      usage: { inputTokens: estimateTokens(req.messages.map((m) => m.content).join("\n")), outputTokens: estimateTokens(raw), estimated: true },
    };
  }

  async generateText(req: TextRequest): Promise<StructuredResponse> {
    const raw = req.demo ? req.demo() : "Demo provider: no text generator configured.";
    return {
      raw,
      model: "demo-deterministic-v1",
      usage: { inputTokens: estimateTokens(req.messages.map((m) => m.content).join("\n")), outputTokens: estimateTokens(raw), estimated: true },
    };
  }
}
