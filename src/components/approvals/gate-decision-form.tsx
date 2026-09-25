"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/fields";
import type { ActionResult } from "@/server/actions/result";

type Action = (prev: ActionResult<unknown>, fd: FormData) => Promise<ActionResult<unknown>>;

/** Approve / Reject / Request revision with a reason; comment-only via a second form. */
export function GateDecisionForm({ gateId, decide, comment, minRoleNote }: { gateId: string; decide: Action; comment: Action; minRoleNote: string }) {
  const [state, action, pending] = useActionState(decide, { ok: true });
  const [cState, cAction, cPending] = useActionState(comment, { ok: true });
  const router = useRouter();
  const seen = useRef<unknown>(null);
  useEffect(() => {
    for (const s of [state, cState]) {
      if (s !== seen.current && s.ok && s.message) {
        seen.current = s;
        router.refresh();
      }
    }
  }, [state, cState, router]);

  return (
    <div className="space-y-5">
      <form action={action} className="space-y-3">
        <input type="hidden" name="gate_id" value={gateId} />
        <Field label="Reason" htmlFor="gate-reason" hint="Required when rejecting or requesting revision. Recorded with your name and the time.">
          <Textarea id="gate-reason" name="reason" rows={3} maxLength={2000} />
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" name="decision" value="approved" variant="primary" disabled={pending}>
            Approve
          </Button>
          <Button type="submit" name="decision" value="revision_requested" disabled={pending}>
            Request revision
          </Button>
          <Button type="submit" name="decision" value="rejected" variant="danger" disabled={pending}>
            Reject
          </Button>
        </div>
        <p className="text-[11px] text-muted">{minRoleNote}</p>
        <p aria-live="polite" className={state.ok ? "text-xs text-good-ink" : "text-xs text-critical-ink"}>
          {state.ok ? state.message : state.error}
        </p>
      </form>
      <form action={cAction} className="space-y-2 border-t border-line pt-4">
        <input type="hidden" name="gate_id" value={gateId} />
        <Field label="Comment" htmlFor="gate-comment">
          <Textarea id="gate-comment" name="body" rows={2} maxLength={5000} required />
        </Field>
        <Button type="submit" size="sm" disabled={cPending}>
          Add comment
        </Button>
        <p aria-live="polite" className={cState.ok ? "text-xs text-good-ink" : "text-xs text-critical-ink"}>
          {cState.ok ? cState.message : cState.error}
        </p>
      </form>
    </div>
  );
}
