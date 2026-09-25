import { ActionForm } from "@/components/ui/action-form";
import { StatusChip } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/fields";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Time } from "@/components/ui/time";
import { assignableRoles, roleAtLeast } from "@/domain/permissions";
import { addMemberAction, updateMemberAction } from "@/server/actions/settings";
import { getContext } from "@/server/context";

export default async function MembersPage() {
  const ctx = await getContext();
  const members = await ctx.db.from("workspace_members").select("id, role, created_at, user_id, users(email, display_name)").eq("workspace_id", ctx.workspace.id).order("created_at");
  const canManage = roleAtLeast(ctx.role, "admin");
  const roles = assignableRoles(ctx.role);
  return (
    <div className="grid gap-5 xl:grid-cols-3">
      <Card className="xl:col-span-2">
        <CardHeader title="Members" description="Owner · admin (settings, sensitive approvals) · editor (run agents, edit, standard approvals) · viewer (read-only)." />
        <Table>
          <THead>
            <tr>
              <TH>Member</TH>
              <TH>Role</TH>
              <TH>Joined</TH>
              {canManage ? <TH>Manage</TH> : null}
            </tr>
          </THead>
          <TBody>
            {(members.data ?? []).map((m) => (
              <TR key={m.id}>
                <TD>
                  <p className="text-ink">{m.users?.display_name ?? "—"}</p>
                  <p className="text-xs text-muted">{m.users?.email}</p>
                </TD>
                <TD>
                  <StatusChip status={m.role === "owner" ? "final" : "active"} label={m.role} />
                </TD>
                <TD className="text-xs">
                  <Time value={m.created_at} />
                </TD>
                {canManage ? (
                  <TD>
                    {m.role !== "owner" && m.user_id !== ctx.user.id ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <ActionForm action={updateMemberAction} submitLabel="Change" size="sm" variant="secondary" hidden={{ member_id: m.id, op: "role" }} inline>
                          <label htmlFor={`role-${m.id}`} className="sr-only">
                            Role
                          </label>
                          <Select id={`role-${m.id}`} name="role" defaultValue={m.role} className="h-7 w-28 text-xs">
                            {roles.map((r) => (
                              <option key={r} value={r}>
                                {r}
                              </option>
                            ))}
                          </Select>
                        </ActionForm>
                        <ActionForm action={updateMemberAction} submitLabel="Remove" size="sm" variant="ghost" hidden={{ member_id: m.id, op: "remove" }} confirm="Remove this member from the workspace?" inline />
                      </div>
                    ) : null}
                  </TD>
                ) : null}
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
      {canManage ? (
        <Card>
          <CardHeader title="Add member" description="They must already have a POD Lab account." />
          <CardBody>
            <ActionForm action={addMemberAction} submitLabel="Add member" resetOnSuccess>
              <Field label="Email" htmlFor="mem-email">
                <Input id="mem-email" name="email" type="email" required />
              </Field>
              <Field label="Role" htmlFor="mem-role">
                <Select id="mem-role" name="role" defaultValue="editor">
                  {roles.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </Select>
              </Field>
            </ActionForm>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
