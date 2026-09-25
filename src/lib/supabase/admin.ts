import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env";
import type { Database } from "./database.types";

export type AdminClient = SupabaseClient<Database>;

let adminClient: AdminClient | null = null;

/**
 * Service-role client. SERVER ONLY — bypasses RLS. Used exclusively by the
 * agent worker and system tasks, which always scope queries by workspace_id.
 */
export function createSupabaseAdminClient(): AdminClient {
  if (adminClient) return adminClient;
  const env = serverEnv();
  adminClient = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return adminClient;
}
