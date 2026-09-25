"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { ActionResult } from "@/server/actions/result";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/fields";

type Action = (prev: ActionResult, fd: FormData) => Promise<ActionResult>;

export function AuthForm({ mode, action, magicAction, next }: { mode: "login" | "signup"; action: Action; magicAction: Action; next?: string }) {
  const [state, formAction, pending] = useActionState(action, { ok: true });
  const [magic, magicFormAction, magicPending] = useActionState(magicAction, { ok: true });
  return (
    <div className="space-y-6">
      <form action={formAction} className="space-y-3" aria-describedby="auth-status">
        {next ? <input type="hidden" name="next" value={next} /> : null}
        {mode === "signup" ? (
          <Field label="Name" htmlFor="display_name">
            <Input id="display_name" name="display_name" autoComplete="name" required />
          </Field>
        ) : null}
        <Field label="Email" htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </Field>
        <Field label="Password" htmlFor="password" hint={mode === "signup" ? "At least 8 characters" : undefined}>
          <Input id="password" name="password" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={8} required />
        </Field>
        <Button type="submit" variant="primary" className="w-full" disabled={pending}>
          {pending ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
        </Button>
        <p id="auth-status" aria-live="polite" className={state.ok ? "text-xs text-good-ink" : "text-xs text-critical-ink"}>
          {state.ok ? state.message : state.error}
        </p>
      </form>

      <div className="border-t border-line pt-4">
        <form action={magicFormAction} className="space-y-2">
          <Field label="Or get a magic link" htmlFor="magic-email">
            <Input id="magic-email" name="email" type="email" autoComplete="email" placeholder="you@company.com" required />
          </Field>
          <Button type="submit" variant="secondary" className="w-full" disabled={magicPending}>
            {magicPending ? "Sending…" : "Email me a sign-in link"}
          </Button>
          <p aria-live="polite" className={magic.ok ? "text-xs text-good-ink" : "text-xs text-critical-ink"}>
            {magic.ok ? magic.message : magic.error}
          </p>
        </form>
      </div>

      <p className="text-center text-xs text-muted">
        {mode === "login" ? (
          <>
            New to POD Lab?{" "}
            <Link href="/signup" className="text-accent hover:underline">
              Create an account
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link href="/login" className="text-accent hover:underline">
              Sign in
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
