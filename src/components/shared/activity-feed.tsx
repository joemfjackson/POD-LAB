import { Bot, Cpu, User } from "lucide-react";
import Link from "next/link";
import { Time } from "@/components/ui/time";
import type { Tables } from "@/lib/supabase/database.types";

type Entry = Pick<Tables<"audit_log">, "id" | "actor_type" | "agent_key" | "summary" | "created_at" | "brand_id" | "subject_type" | "subject_id">;

const ICONS = { human: User, agent: Bot, system: Cpu } as const;

function href(e: Entry): string | null {
  if (e.subject_type === "agent_job" && e.subject_id) return `/agents/jobs/${e.subject_id}`;
  if (e.brand_id) return `/brands/${e.brand_id}`;
  return null;
}

export function ActivityFeed({ entries, empty = "No activity yet." }: { entries: Entry[]; empty?: string }) {
  if (entries.length === 0) return <p className="text-xs text-muted">{empty}</p>;
  return (
    <ol className="space-y-2.5">
      {entries.map((e) => {
        const Icon = ICONS[e.actor_type as keyof typeof ICONS] ?? Cpu;
        const link = href(e);
        return (
          <li key={e.id} className="flex gap-2.5">
            <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded bg-surface-2" title={e.actor_type}>
              <Icon className="h-3 w-3 text-muted" aria-hidden />
              <span className="sr-only">{e.actor_type}</span>
            </span>
            <div className="min-w-0 flex-1">
              {link ? (
                <Link href={link} className="text-xs text-ink-2 hover:text-ink">
                  {e.summary}
                </Link>
              ) : (
                <p className="text-xs text-ink-2">{e.summary}</p>
              )}
              <p className="text-[11px] text-muted">
                <Time value={e.created_at} />
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
