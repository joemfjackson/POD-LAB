import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import type { Database } from "../src/lib/supabase/database.types";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable ${name} (see .env.example)`);
  return v;
}

export function adminClient(): SupabaseClient<Database> {
  return createClient<Database>(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });
}

export const DEMO_EMAIL = process.env.DEMO_USER_EMAIL ?? "demo@podlab.local";
export const DEMO_PASSWORD = process.env.DEMO_USER_PASSWORD ?? "podlab-demo-password";

/** Ensures the demo user exists and returns a signed-in client for it. */
export async function demoUser() {
  const admin = adminClient();
  const list = await admin.auth.admin.listUsers({ perPage: 1000 });
  let user = list.data.users.find((u) => u.email === DEMO_EMAIL);
  if (!user) {
    const created = await admin.auth.admin.createUser({ email: DEMO_EMAIL, password: DEMO_PASSWORD, email_confirm: true, user_metadata: { display_name: "Demo Operator" } });
    if (created.error || !created.data.user) throw new Error(`Could not create demo user: ${created.error?.message}`);
    user = created.data.user;
  }
  const client = createClient<Database>(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });
  const signIn = await client.auth.signInWithPassword({ email: DEMO_EMAIL, password: DEMO_PASSWORD });
  if (signIn.error) throw new Error(`Demo sign-in failed: ${signIn.error.message}. Set DEMO_USER_PASSWORD to the demo user's password.`);
  return { admin, client, userId: user.id };
}

export async function demoWorkspace(client: SupabaseClient<Database>, userId: string) {
  const existing = await client.from("workspace_members").select("workspace_id, workspaces(name)").eq("user_id", userId).eq("role", "owner");
  const found = existing.data?.find((m) => m.workspaces?.name === "POD Lab (demo)");
  if (found) return found.workspace_id;
  const ws = await client.rpc("create_workspace", { p_name: "POD Lab (demo)", p_slug: `pod-lab-demo-${Math.random().toString(36).slice(2, 7)}` });
  if (ws.error) throw new Error(ws.error.message);
  return ws.data.id;
}
