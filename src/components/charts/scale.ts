/** "Nice" axis ticks: 0 / 1,000 / 2,000 style. */
export function niceTicks(max: number, count = 4): number[] {
  if (!Number.isFinite(max) || max <= 0) return [0, 1];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return ticks;
}

export function compact(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (a >= 1e4) return `${(v / 1e3).toFixed(0)}K`;
  if (a >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return Number.isInteger(v) ? v.toLocaleString("en-US") : v.toFixed(2);
}

export type ValueFormat = "number" | "usd" | "usd_compact" | "percent";

/** Serializable formatter keys (server components cannot pass functions to client charts). */
export function formatValue(v: number, f: ValueFormat = "number"): string {
  switch (f) {
    case "usd":
      return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    case "usd_compact":
      return `$${compact(v)}`;
    case "percent":
      return `${v.toFixed(1)}%`;
    default:
      return compact(v);
  }
}
