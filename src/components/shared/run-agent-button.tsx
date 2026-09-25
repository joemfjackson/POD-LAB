import { AGENT_BY_KEY } from "@/agents/registry";
import { ActionForm } from "@/components/ui/action-form";
import type { AgentKey } from "@/domain/lifecycle";
import { runAgentAction } from "@/server/actions/agents";

/** Server-rendered "Run <agent>" button bound to the generic run action. */
export function RunAgentButton({
  agent,
  brandId,
  label,
  variant = "secondary",
  size = "sm",
  params,
  disabled,
}: {
  agent: AgentKey;
  brandId?: string | null;
  label?: string;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md";
  params?: Record<string, string | number>;
  disabled?: string | null;
}) {
  if (disabled) {
    return (
      <span className="inline-flex h-7 items-center rounded-md border border-line px-2.5 text-xs text-muted" title={disabled}>
        {label ?? `Run ${AGENT_BY_KEY[agent].name}`} — {disabled}
      </span>
    );
  }
  const hidden: Record<string, string | number | null | undefined> = { agent, brand_id: brandId ?? undefined };
  for (const [k, v] of Object.entries(params ?? {})) hidden[`p_${k}`] = v;
  return <ActionForm action={runAgentAction} submitLabel={label ?? `Run ${AGENT_BY_KEY[agent].name}`} pendingLabel="Running agent…" variant={variant} size={size} hidden={hidden} inline />;
}
