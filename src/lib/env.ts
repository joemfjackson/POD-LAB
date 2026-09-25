import "server-only";
import { z } from "zod";

/**
 * Server-side environment. Parsed lazily so that builds succeed without
 * optional provider credentials; each accessor validates what it needs.
 */
const serverEnvSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(10),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(10),
  POD_LAB_ENCRYPTION_KEY: z.string().optional(),
  CRON_SECRET: z.string().optional(),

  AI_PROVIDER: z.enum(["demo", "openai_compatible"]).default("demo"),
  AI_API_KEY: z.string().optional(),
  AI_BASE_URL: z.string().url().default("https://api.openai.com/v1"),
  AI_DEFAULT_MODEL: z.string().default("gpt-4.1-mini"),
  AI_PRICE_INPUT_PER_MTOK: z.coerce.number().nonnegative().default(0.4),
  AI_PRICE_OUTPUT_PER_MTOK: z.coerce.number().nonnegative().default(1.6),
  AI_RESPONSE_FORMAT: z.enum(["json_schema", "json_object"]).default("json_schema"),
  AGENT_EXECUTION_MODE: z.enum(["inline", "deferred"]).default("inline"),
  AI_MAX_TOKENS_PARAM: z.enum(["max_tokens", "max_completion_tokens"]).default("max_tokens"),

  IMAGE_PROVIDER: z.enum(["none", "openai_compatible"]).default("none"),
  IMAGE_API_KEY: z.string().optional(),
  IMAGE_BASE_URL: z.string().url().default("https://api.openai.com/v1"),
  IMAGE_MODEL: z.string().default("gpt-image-1"),

  RESEARCH_PROVIDER: z.enum(["none", "tavily"]).default("none"),
  RESEARCH_API_KEY: z.string().optional(),
  DOMAIN_RDAP_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),

  SHOPIFY_STORE_DOMAIN: z.string().optional(),
  SHOPIFY_ADMIN_ACCESS_TOKEN: z.string().optional(),
  SHOPIFY_API_VERSION: z.string().default("2025-07"),
  FULFILL_ENGINE_API_BASE_URL: z.string().optional(),
  FULFILL_ENGINE_API_KEY: z.string().optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | null = null;

function blankToUndefined(source: NodeJS.ProcessEnv): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(source)) out[k] = v === "" ? undefined : v;
  return out;
}

export function serverEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = serverEnvSchema.safeParse(blankToUndefined(process.env));
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid server environment configuration: ${issues}`);
  }
  cached = parsed.data;
  return cached;
}

/** Per-agent model override: AI_MODEL_<AGENT_KEY>. */
export function agentModelOverride(agentKey: string): string | undefined {
  const v = process.env[`AI_MODEL_${agentKey.toUpperCase()}`];
  return v && v.length > 0 ? v : undefined;
}
