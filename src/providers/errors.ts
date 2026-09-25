/** Raised when a capability needs credentials/configuration that are not present. */
export class ProviderNotConfiguredError extends Error {
  readonly provider: string;
  constructor(provider: string, detail?: string) {
    super(`Requires provider connection: ${provider}${detail ? ` — ${detail}` : ""}`);
    this.name = "ProviderNotConfiguredError";
    this.provider = provider;
  }
}

/** Raised for upstream failures that are worth retrying (rate limits, 5xx, timeouts). */
export class ProviderTransientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderTransientError";
  }
}

export async function fetchWithTimeout(url: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<Response> {
  const { timeoutMs = 60_000, ...rest } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...rest, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") throw new ProviderTransientError(`Request to ${new URL(url).host} timed out`);
    throw new ProviderTransientError(`Network error calling ${new URL(url).host}: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    clearTimeout(timer);
  }
}
