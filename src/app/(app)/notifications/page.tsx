import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/ui/action-form";
import { Badge, StatusChip } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { Time } from "@/components/ui/time";
import { markNotificationsReadAction } from "@/server/actions/knowledge";
import { getContext } from "@/server/context";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const ctx = await getContext();
  const notes = await ctx.db.from("notifications").select("*").eq("workspace_id", ctx.workspace.id).order("created_at", { ascending: false }).limit(200);
  const unread = (notes.data ?? []).filter((n) => !n.read_at).length;
  return (
    <>
      <PageHeader
        title="Notifications"
        description="Approvals needed, agent failures, stage readiness, experiment thresholds, margin problems, compliance flags and store builds. Email delivery can be added later."
        actions={unread ? <ActionForm action={markNotificationsReadAction} submitLabel={`Mark all ${unread} read`} variant="secondary" inline /> : null}
      />
      {notes.data?.length ? (
        <Card>
          <ul className="divide-y divide-line">
            {notes.data.map((n) => (
              <li key={n.id} className={`flex flex-wrap items-start gap-3 px-4 py-3 ${n.read_at ? "opacity-60" : ""}`}>
                <StatusChip status={n.severity === "critical" ? "critical" : n.severity === "warning" ? "medium" : "neutral"} label={n.severity} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink">
                    {n.link ? (
                      <Link href={n.link} className="hover:text-accent">
                        {n.title}
                      </Link>
                    ) : (
                      n.title
                    )}{" "}
                    <Badge tone="muted">{n.type.replace(/_/g, " ")}</Badge>
                  </p>
                  {n.body ? <p className="mt-0.5 text-xs text-muted">{n.body}</p> : null}
                </div>
                <Time value={n.created_at} />
                {!n.read_at ? <ActionForm action={markNotificationsReadAction} submitLabel="Mark read" size="sm" variant="ghost" hidden={{ notification_id: n.id }} inline /> : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <EmptyState title="No notifications" />
      )}
    </>
  );
}
