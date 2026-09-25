import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { can, type Permission, type WorkspaceRole } from "@/domain/permissions";
import { createSupabaseServerClient, type UserSupabaseClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";
import { UserFacingError } from "./services/errors";

export const WORKSPACE_COOKIE = "podlab_ws";

export interface AppContext {
  db: UserSupabaseClient;
  user: { id: string; email: string; displayName: string };
  workspace: Tables<"workspaces">;
  role: WorkspaceRole;
  memberships: Array<{ workspace: Pick<Tables<"workspaces">, "id" | "name" | "slug">; role: WorkspaceRole }>;
}

/** Signed-in user or null (claims are verified by Supabase). */
export const getUser = cache(async () => {
  const db = await createSupabaseServerClient();
  const { data } = await db.auth.getUser();
  if (!data.user) return null;
  return { db, user: data.user };
});

/**
 * Resolves the signed-in user and their active workspace. Redirects to /login
 * or /onboarding when either is missing. Cached per request.
 */
export const getContext = cache(async (): Promise<AppContext> => {
  const session = await getUser();
  if (!session) redirect("/login");
  const { db, user } = session;
  const members = await db
    .from("workspace_members")
    .select("role, workspaces(id, name, slug)")
    .eq("user_id", user.id)
    .order("created_at");
  const memberships = (members.data ?? [])
    .filter((m): m is typeof m & { workspaces: NonNullable<typeof m.workspaces> } => Boolean(m.workspaces))
    .map((m) => ({ workspace: m.workspaces, role: m.role as WorkspaceRole }));
  if (memberships.length === 0) redirect("/onboarding");

  const store = await cookies();
  const preferred = store.get(WORKSPACE_COOKIE)?.value;
  const active = memberships.find((m) => m.workspace.id === preferred) ?? memberships[0]!;
  const ws = await db.from("workspaces").select("*").eq("id", active.workspace.id).single();
  if (ws.error) redirect("/onboarding");
  const profile = await db.from("users").select("display_name, email").eq("id", user.id).maybeSingle();

  return {
    db,
    user: {
      id: user.id,
      email: user.email ?? profile.data?.email ?? "",
      displayName: profile.data?.display_name ?? user.email?.split("@")[0] ?? "You",
    },
    workspace: ws.data,
    role: active.role,
    memberships,
  };
});

export function assertCan(ctx: Pick<AppContext, "role">, permission: Permission) {
  if (!can(ctx.role, permission)) throw new UserFacingError("Your role does not allow this action.");
}

export async function requireContext(permission?: Permission): Promise<AppContext> {
  const ctx = await getContext();
  if (permission) assertCan(ctx, permission);
  return ctx;
}
