"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input } from "@/components/ui/fields";
import { createWorkspaceAction } from "./actions";

export function OnboardingForm() {
  const [state, action, pending] = useActionState(createWorkspaceAction, { ok: true });
  return (
    <form action={action} className="space-y-4">
      <Field label="Workspace name" htmlFor="name">
        <Input id="name" name="name" defaultValue="POD Lab" required minLength={2} maxLength={120} />
      </Field>
      <Checkbox
        name="demo"
        defaultChecked
        label={
          <span>
            Load demo data — <span className="text-ink">PL-0001 AI / Superintelligence</span> (researching), a mock catalog and sample records. All demo data is labelled.
          </span>
        }
      />
      <Button type="submit" variant="primary" className="w-full" disabled={pending}>
        {pending ? "Creating…" : "Create workspace"}
      </Button>
      <p aria-live="polite" className="text-xs text-critical-ink">
        {state.ok ? "" : state.error}
      </p>
    </form>
  );
}
