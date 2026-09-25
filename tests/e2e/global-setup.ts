import { execSync } from "node:child_process";

export default function globalSetup() {
  execSync("npx tsx --conditions=react-server --tsconfig tsconfig.json scripts/e2e-setup.ts", { stdio: "inherit" });
}
