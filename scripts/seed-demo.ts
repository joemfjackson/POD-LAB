/**
 * Seeds DEMO data (clearly labelled) into a "POD Lab (demo)" workspace owned by
 * the demo user. Usage: npm run seed
 */
import { seedBaseline } from "../src/server/seed/baseline";
import { demoUser, demoWorkspace, DEMO_EMAIL } from "./lib";

async function main() {
  const { admin, client, userId } = await demoUser();
  const workspaceId = await demoWorkspace(client, userId);
  const result = await seedBaseline(admin, workspaceId, userId);
  console.log(result.created ? "✓ Seeded baseline demo data (PL-0001 AI / Superintelligence, researching)" : "• Baseline demo data already present");
  console.log(`  workspace ${workspaceId}\n  sign in as ${DEMO_EMAIL}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
