import type { ReactNode } from "react";
import { cn } from "./cn";

export type Tone = "neutral" | "accent" | "good" | "warning" | "serious" | "critical" | "muted";

const tones: Record<Tone, string> = {
  neutral: "border-line-strong bg-surface-2 text-ink-2",
  accent: "border-accent/40 bg-accent/10 text-accent-strong",
  good: "border-good/40 bg-good/10 text-good-ink",
  warning: "border-warning/40 bg-warning/10 text-warning",
  serious: "border-serious/40 bg-serious/10 text-serious",
  critical: "border-critical/50 bg-critical/10 text-critical-ink",
  muted: "border-line bg-transparent text-muted",
};

const dots: Record<Tone, string> = {
  neutral: "bg-ink-2",
  accent: "bg-accent",
  good: "bg-good",
  warning: "bg-warning",
  serious: "bg-serious",
  critical: "bg-critical",
  muted: "bg-muted",
};

export function Badge({ tone = "neutral", children, className, dot = false, title }: { tone?: Tone; children: ReactNode; className?: string; dot?: boolean; title?: string }) {
  return (
    <span title={title} className={cn("inline-flex items-center gap-1.5 rounded border px-1.5 py-0.5 text-[11px] font-medium leading-4 whitespace-nowrap", tones[tone], className)}>
      {dot ? <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", dots[tone])} /> : null}
      {children}
    </span>
  );
}

const STATUS_TONES: Record<string, Tone> = {
  // jobs / runs
  queued: "neutral",
  running: "accent",
  waiting_for_approval: "warning",
  completed: "good",
  succeeded: "good",
  failed: "critical",
  cancelled: "muted",
  // approvals
  pending: "warning",
  approved: "good",
  rejected: "critical",
  revision_requested: "serious",
  // opportunities
  inbox: "neutral",
  researching: "accent",
  candidate: "warning",
  archived: "muted",
  // designs
  idea: "muted",
  brief: "neutral",
  generating: "accent",
  review: "warning",
  revision: "serious",
  production_ready: "good",
  retired: "muted",
  // compliance
  not_reviewed: "muted",
  clear: "good",
  flagged: "critical",
  overridden: "serious",
  // brand stages
  branding: "accent",
  creative: "accent",
  product_selection: "accent",
  store_build: "accent",
  launch_ready: "good",
  testing: "accent",
  iterating: "serious",
  scaling: "good",
  paused: "muted",
  killed: "critical",
  // misc
  draft: "neutral",
  generated: "accent",
  pending_approval: "warning",
  pending_launch_approval: "warning",
  launch_approved: "good",
  live: "good",
  active: "good",
  not_configured: "muted",
  disabled: "muted",
  hypothesis: "muted",
  proposed: "neutral",
  shortlisted: "accent",
  final: "good",
  superseded: "muted",
  // decisions
  insufficient_data: "muted",
  keep_collecting: "neutral",
  kill: "critical",
  iterate: "serious",
  clone: "accent",
  scale: "good",
  // recommendations
  launch: "good",
  avoid: "critical",
  premium_only: "warning",
  bundle_only: "warning",
  upsell: "neutral",
  test: "accent",
  // availability
  unverified: "muted",
  likely_available: "good",
  taken: "critical",
  unknown: "muted",
  error: "critical",
  // confidence / risk
  low: "muted",
  medium: "warning",
  high: "good",
  none: "muted",
  critical: "critical",
};

export function statusTone(status: string | null | undefined): Tone {
  return (status && STATUS_TONES[status]) || "neutral";
}

export function StatusChip({ status, label, className }: { status: string | null | undefined; label?: string; className?: string }) {
  if (!status) return <Badge tone="muted">—</Badge>;
  return (
    <Badge tone={statusTone(status)} dot className={className}>
      {label ?? status.replace(/_/g, " ")}
    </Badge>
  );
}

const RISK_TONES: Record<string, Tone> = { none: "muted", low: "neutral", medium: "warning", high: "serious", critical: "critical" };
export function RiskChip({ level }: { level: string | null | undefined }) {
  return <Badge tone={RISK_TONES[level ?? "none"] ?? "neutral"} dot>{`${level ?? "none"} risk`}</Badge>;
}

const CONF_TONES: Record<string, Tone> = { low: "muted", medium: "warning", high: "good" };
export function ConfidenceChip({ level }: { level: string | null | undefined }) {
  return <Badge tone={CONF_TONES[level ?? "low"] ?? "muted"}>{`${level ?? "unknown"} confidence`}</Badge>;
}

export function DemoBadge({ show = true }: { show?: boolean | null }) {
  if (!show) return null;
  return (
    <Badge tone="warning" title="Demo/sample data — not real business data">
      DEMO
    </Badge>
  );
}
