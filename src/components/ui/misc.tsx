import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "./cn";

export function EmptyState({ title, description, action, className }: { title: string; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-lg border border-dashed border-line px-6 py-10 text-center", className)}>
      <p className="text-sm font-medium text-ink">{title}</p>
      {description ? <p className="mt-1 max-w-md text-xs text-muted">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function StatTile({ label, value, hint, href, tone }: { label: string; value: ReactNode; hint?: ReactNode; href?: string; tone?: "default" | "accent" }) {
  const body = (
    <>
      <p className="text-xs text-muted">{label}</p>
      <p className={cn("mt-1 text-2xl font-semibold tracking-tight", tone === "accent" ? "text-accent-strong" : "text-ink")}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </>
  );
  const cls = "block rounded-lg border border-line bg-surface p-3.5";
  return href ? (
    <Link href={href} className={cn(cls, "transition-colors hover:border-line-strong hover:bg-surface-2")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function KeyValue({ items, columns = 2 }: { items: Array<{ label: string; value: ReactNode }>; columns?: 1 | 2 | 3 }) {
  return (
    <dl className={cn("grid gap-x-6 gap-y-3", columns === 1 ? "grid-cols-1" : columns === 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-3")}>
      {items.map((i) => (
        <div key={i.label} className="min-w-0">
          <dt className="text-xs text-muted">{i.label}</dt>
          <dd className="mt-0.5 text-sm break-words text-ink">{i.value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Notice({ tone = "info", title, children }: { tone?: "info" | "warning" | "critical" | "demo"; title?: string; children: ReactNode }) {
  const styles = {
    info: "border-accent/30 bg-accent/5",
    warning: "border-warning/40 bg-warning/5",
    critical: "border-critical/50 bg-critical/5",
    demo: "border-warning/40 bg-warning/5",
  }[tone];
  const label = { info: "Note", warning: "Warning", critical: "Error", demo: "Demo data" }[tone];
  return (
    <div role={tone === "critical" ? "alert" : "note"} className={cn("rounded-md border px-3 py-2 text-xs text-ink-2", styles)}>
      <span className="font-semibold text-ink">{title ?? label}: </span>
      {children}
    </div>
  );
}

export function SectionTitle({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">{children}</h3>
      {actions}
    </div>
  );
}

export function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("font-mono text-xs text-ink-2", className)}>{children}</span>;
}

export function Pre({ value, className }: { value: unknown; className?: string }) {
  return (
    <pre className={cn("max-h-[480px] overflow-auto rounded-md border border-line bg-bg p-3 font-mono text-[11px] leading-relaxed text-ink-2", className)}>
      {typeof value === "string" ? value : JSON.stringify(value, null, 2)}
    </pre>
  );
}
