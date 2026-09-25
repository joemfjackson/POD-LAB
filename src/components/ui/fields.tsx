import type { ComponentProps, ReactNode } from "react";
import { cn } from "./cn";

const control =
  "w-full rounded-md border border-line-strong bg-bg px-2.5 py-1.5 text-sm text-ink placeholder:text-muted/70 focus:border-accent focus:outline-none disabled:opacity-60";

export function Field({ label, htmlFor, hint, error, children, className }: { label: string; htmlFor: string; hint?: ReactNode; error?: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1", className)}>
      <label htmlFor={htmlFor} className="block text-xs font-medium text-ink-2">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="text-xs text-critical-ink">
          {error}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(control, "h-9", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(control, "min-h-20", className)} {...props} />;
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <select className={cn(control, "h-9", className)} {...props}>
      {children}
    </select>
  );
}

export function Checkbox({ label, className, ...props }: ComponentProps<"input"> & { label: ReactNode }) {
  return (
    <label className={cn("inline-flex items-center gap-2 text-sm text-ink-2", className)}>
      <input type="checkbox" className="h-4 w-4 rounded border-line-strong bg-bg accent-[var(--color-accent)]" {...props} />
      {label}
    </label>
  );
}
