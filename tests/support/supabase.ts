import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import type { AdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";
import { ensureWorkspaceDefaults } from "@/server/services/workspace";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const PUBLISHABLE = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
export const DB_URL = process.env.SUPABASE_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

export function admin(): AdminClient {
  return createClient<Database>(SUPABASE_URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function supabaseAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/health`, { headers: { apikey: PUBLISHABLE } });
    return res.ok;
  } catch {
    return false;
  }
}

export interface TestUser {
  id: string;
  email: string;
  client: SupabaseClient<Database>;
}

export async function createTestUser(label = "user"): Promise<TestUser> {
  const email = `${label}-${randomUUID().slice(0, 8)}@podlab.test`;
  const password = `Test-${randomUUID()}`;
  const a = admin();
  const created = await a.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: label } });
  if (created.error || !created.data.user) throw new Error(`createUser: ${created.error?.message}`);
  const client = createClient<Database>(SUPABASE_URL, PUBLISHABLE, { auth: { persistSession: false, autoRefreshToken: false } });
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error) throw new Error(`signIn: ${signIn.error.message}`);
  return { id: created.data.user.id, email, client };
}

export async function createWorkspace(user: TestUser, name = "Test Lab") {
  const slug = `test-${randomUUID().slice(0, 8)}`;
  const res = await user.client.rpc("create_workspace", { p_name: name, p_slug: slug });
  if (res.error) throw new Error(`create_workspace: ${res.error.message}`);
  await ensureWorkspaceDefaults(admin(), res.data.id);
  return res.data;
}

export async function addMember(workspaceId: string, userId: string, role: Database["public"]["Enums"]["workspace_role"]) {
  const res = await admin().from("workspace_members").insert({ workspace_id: workspaceId, user_id: userId, role });
  if (res.error) throw new Error(`addMember: ${res.error.message}`);
}
