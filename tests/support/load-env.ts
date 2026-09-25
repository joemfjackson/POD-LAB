import { config } from "dotenv";

config({ path: ".env.test", quiet: true });
config({ path: ".env.local", quiet: true });
// Integration tests always exercise the deterministic demo provider.
process.env.AI_PROVIDER = "demo";
process.env.RESEARCH_PROVIDER = "none";
process.env.IMAGE_PROVIDER = "none";
