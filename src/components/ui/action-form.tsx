"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/server/actions/result";
import { Button } from "./button";
import { cn } from "./cn";

type Action = (prev: ActionResult<unknown>, formData: FormData) => Promise<ActionResult<unknown>>;

/**
 * Progressive-enhancement form bound to a server action. Shows the action's
 * success/error message inline (aria-live) and refreshes server data on success.
 */
export function ActionForm({
  action,
  children,
  submitLabel,
  pendingLabel,
  variant = "primary",
  size = "md",
  className,
  resetOnSuccess = false,
  confirm,
  hidden,
  inline = false,
}: {
  action: Action;
  children?: ReactNode;
  submitLabel: string;
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  className?: string;
  resetOnSuccess?: boolean;
  confirm?: string;
  hidden?: Record<string, string | number | null | undefined>;
  inline?: boolean;
}) {
  const [state, formAction, pending] = useActionState<ActionResult<unknown>, FormData>(action, { ok: true });
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const lastState = useRef(state);

  useEffect(() => {
    if (state === lastState.current) return;
    lastState.current = state;
    if (state.ok) {
      if (resetOnSuccess) formRef.current?.reset();
      router.refresh();
    }
  }, [state, resetOnSuccess, router]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className={cn(inline ? "inline-flex flex-wrap items-center gap-2" : "space-y-3", className)}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {hidden
        ? Object.entries(hidden).map(([k, v]) => (v === null || v === undefined ? null : <input key={k} type="hidden" name={k} value={String(v)} />))
        : null}
      {children}
      <div className={cn("flex flex-wrap items-center gap-2", inline && "contents")}>
        <Button type="submit" variant={variant} size={size} disabled={pending} aria-busy={pending}>
          {pending ? (pendingLabel ?? "Working…") : submitLabel}
        </Button>
        <p aria-live="polite" className={cn("text-xs", state.ok ? "text-good-ink" : "text-critical-ink")}>
          {state.ok ? (state.message ?? "") : state.error}
        </p>
      </div>
      {!state.ok && state.fieldErrors ? (
        <ul className="sr-only">
          {Object.entries(state.fieldErrors).map(([k, v]) => (
            <li key={k}>{`${k}: ${v}`}</li>
          ))}
        </ul>
      ) : null}
    </form>
  );
}
