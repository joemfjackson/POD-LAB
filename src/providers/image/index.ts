import "server-only";
import { serverEnv } from "@/lib/env";
import { ProviderNotConfiguredError, ProviderTransientError, fetchWithTimeout } from "../errors";

export interface GeneratedImage {
  bytes: Uint8Array;
  mimeType: "image/png";
  provider: string;
  model: string;
  revisedPrompt: string | null;
}

export interface ImageProvider {
  readonly id: "none" | "openai_compatible";
  readonly label: string;
  readonly configured: boolean;
  generate(prompt: string, opts?: { size?: "1024x1024" | "1024x1536" | "1536x1024" }): Promise<GeneratedImage>;
}

class NoImageProvider implements ImageProvider {
  readonly id = "none" as const;
  readonly label = "Manual upload (no image generation configured)";
  readonly configured = false;
  async generate(): Promise<GeneratedImage> {
    throw new ProviderNotConfiguredError("image generation", "set IMAGE_PROVIDER and IMAGE_API_KEY, or upload artwork manually");
  }
}

class OpenAICompatibleImageProvider implements ImageProvider {
  readonly id = "openai_compatible" as const;
  readonly label = "OpenAI-compatible images";
  readonly configured: boolean;
  constructor(private readonly cfg: { apiKey?: string; baseUrl: string; model: string }) {
    this.configured = Boolean(cfg.apiKey);
  }
  async generate(prompt: string, opts: { size?: "1024x1024" | "1024x1536" | "1536x1024" } = {}): Promise<GeneratedImage> {
    if (!this.cfg.apiKey) throw new ProviderNotConfiguredError("image generation", "set IMAGE_API_KEY");
    const res = await fetchWithTimeout(`${this.cfg.baseUrl.replace(/\/+$/, "")}/images/generations`, {
      method: "POST",
      timeoutMs: 180_000,
      headers: { "content-type": "application/json", authorization: `Bearer ${this.cfg.apiKey}` },
      body: JSON.stringify({ model: this.cfg.model, prompt: prompt.slice(0, 4000), size: opts.size ?? "1024x1024", n: 1 }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      data?: Array<{ b64_json?: string; revised_prompt?: string }>;
      error?: { message?: string };
    };
    if (res.status === 429 || res.status >= 500) throw new ProviderTransientError(`Image provider returned ${res.status}`);
    if (!res.ok) throw new Error(`Image provider returned ${res.status}: ${json.error?.message ?? ""}`);
    const b64 = json.data?.[0]?.b64_json;
    if (!b64) throw new Error("Image provider returned no image data");
    return {
      bytes: Uint8Array.from(Buffer.from(b64, "base64")),
      mimeType: "image/png",
      provider: this.id,
      model: this.cfg.model,
      revisedPrompt: json.data?.[0]?.revised_prompt ?? null,
    };
  }
}

export function getImageProvider(): ImageProvider {
  const env = serverEnv();
  if (env.IMAGE_PROVIDER === "openai_compatible") {
    return new OpenAICompatibleImageProvider({ apiKey: env.IMAGE_API_KEY, baseUrl: env.IMAGE_BASE_URL, model: env.IMAGE_MODEL });
  }
  return new NoImageProvider();
}
