/**
 * Prepares E2E state: a fresh owner account whose workspace has the PL-0001
 * walkthrough completed (demo provider). Writes credentials to test-results/.
 */
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import type { Database } from "../src/lib/supabase/database.types";
import { seedBaseline } from "../src/server/seed/baseline";
import { runWalkthrough } from "../src/server/seed/walkthrough";
import { adminClient, requireEnv } from "./lib";

async function main() {
  const admin = adminClient();
  const email = `e2e-${randomUUID().slice(0, 8)}@podlab.test`;
  const password = `E2e-${randomUUID()}`;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: "E2E Operator" } });
  if (created.error || !created.data.user) throw new Error(created.error?.message);
  const client = createClient<Database>(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"), { auth: { persistSession: false } });
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error) throw new Error(signIn.error.message);
  const ws = await client.rpc("create_workspace", { p_name: "E2E Lab", p_slug: `e2e-${randomUUID().slice(0, 8)}` });
  if (ws.error) throw new Error(ws.error.message);
  const { brandId } = await seedBaseline(admin, ws.data.id, created.data.user.id);
  await runWalkthrough({ admin, user: client, userId: created.data.user.id, workspaceId: ws.data.id, brandId });
  mkdirSync("test-results", { recursive: true });
  writeFileSync("test-results/e2e-state.json", JSON.stringify({ email, password, workspaceId: ws.data.id, brandId }));
  console.log(`E2E state ready for ${email}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
