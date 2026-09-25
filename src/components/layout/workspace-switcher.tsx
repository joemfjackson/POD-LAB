"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { switchWorkspaceAction } from "@/server/actions/workspace";

export function WorkspaceSwitcher({ current, workspaces }: { current: string; workspaces: Array<{ id: string; name: string; role: string }> }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <label className="flex min-w-0 items-center gap-2">
      <span className="sr-only">Workspace</span>
      <select
        className="h-8 max-w-[180px] truncate rounded-md border border-line bg-surface-2 px-2 text-xs text-ink"
        value={current}
        disabled={pending}
        onChange={(e) => {
          const id = e.target.value;
          if (id === "__new") {
            router.push("/onboarding");
            return;
          }
          start(async () => {
            await switchWorkspaceAction(id);
          });
        }}
      >
        {workspaces.map((w) => (
          <option key={w.id} value={w.id}>
            {w.name} ({w.role})
          </option>
        ))}
        <option value="__new">+ New workspace…</option>
      </select>
    </label>
  );
}
