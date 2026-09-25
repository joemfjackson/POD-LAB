/**
 * Runs PL-0001 through the full POD Lab pipeline with the configured agents
 * (demo provider by default), approving gates as the demo operator.
 * Paid spend is never approved. Usage: npm run demo:walkthrough
 */
import { runWalkthrough } from "../src/server/seed/walkthrough";
import { seedBaseline } from "../src/server/seed/baseline";
import { demoUser, demoWorkspace } from "./lib";

async function main() {
  const { admin, client, userId } = await demoUser();
  const workspaceId = await demoWorkspace(client, userId);
  const { brandId } = await seedBaseline(admin, workspaceId, userId);
  console.log(`Running the first end-to-end workflow on PL-0001 (${brandId})…`);
  await runWalkthrough({ admin, user: client, userId, workspaceId, brandId, log: (m) => console.log(m) });
  const brand = await admin.from("brands").select("code, official_name, stage").eq("id", brandId).single();
  console.log(`\n✓ Done: ${brand.data?.code} ${brand.data?.official_name ?? ""} is now "${brand.data?.stage}".`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.stack : e);
  process.exit(1);
});
