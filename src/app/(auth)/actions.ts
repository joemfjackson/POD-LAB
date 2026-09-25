"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { publicEnv } from "@/lib/public-env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/server/actions/result";

const credentials = z.object({
  email: z.email("Enter a valid email").max(254),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
});

function safeNext(next: FormDataEntryValue | null): string {
  const v = typeof next === "string" ? next : "";
  // only allow same-site relative paths
  return v.startsWith("/") && !v.startsWith("//") ? v : "/dashboard";
}

export async function signInAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const parsed = credentials.safeParse({ email: fd.get("email"), password: fd.get("password") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { ok: false, error: "Invalid email or password." };
  redirect(safeNext(fd.get("next")));
}

export async function signUpAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const parsed = credentials.extend({ display_name: z.string().trim().min(1, "Enter your name").max(80) }).safeParse({
    email: fd.get("email"),
    password: fd.get("password"),
    display_name: fd.get("display_name"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { display_name: parsed.data.display_name }, emailRedirectTo: `${publicEnv.siteUrl}/auth/callback?next=/onboarding` },
  });
  if (error) return { ok: false, error: error.message };
  if (data.session) redirect("/onboarding");
  return { ok: true, message: "Check your email to confirm your account, then sign in." };
}

export async function magicLinkAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const email = z.email().safeParse(fd.get("email"));
  if (!email.success) return { ok: false, error: "Enter a valid email" };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({ email: email.data, options: { emailRedirectTo: `${publicEnv.siteUrl}/auth/callback`, shouldCreateUser: true } });
  if (error) return { ok: false, error: error.message };
  return { ok: true, message: "Magic link sent — check your inbox." };
}
