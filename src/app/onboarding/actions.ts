"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { slugify } from "@/domain/slug";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { WORKSPACE_COOKIE, getUser } from "@/server/context";
import type { ActionResult } from "@/server/actions/result";
import { seedBaseline } from "@/server/seed/baseline";
import { ensureWorkspaceDefaults } from "@/server/services/workspace";

const schema = z.object({ name: z.string().trim().min(2, "Name must be at least 2 characters").max(120), demo: z.boolean() });

export async function createWorkspaceAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const session = await getUser();
  if (!session) redirect("/login");
  const parsed = schema.safeParse({ name: fd.get("name"), demo: fd.get("demo") === "on" });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const slug = `${slugify(parsed.data.name, 40)}-${Math.random().toString(36).slice(2, 7)}`;
  const res = await session.db.rpc("create_workspace", { p_name: parsed.data.name, p_slug: slug });
  if (res.error) return { ok: false, error: res.error.message };
  const admin = createSupabaseAdminClient();
  await ensureWorkspaceDefaults(admin, res.data.id);
  if (parsed.data.demo) await seedBaseline(admin, res.data.id, session.user.id);
  (await cookies()).set(WORKSPACE_COOKIE, res.data.id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 });
  redirect("/dashboard");
}
