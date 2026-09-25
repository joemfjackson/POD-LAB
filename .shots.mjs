import { chromium } from "@playwright/test";
const [out, ...paths] = process.argv.slice(2);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 300)); });
await page.goto("http://localhost:3000/login");
await page.fill("#email", "demo@podlab.local");
await page.fill("#password", "podlab-demo-password");
await page.click("button[type=submit]:has-text('Sign in')");
await page.waitForURL("**/dashboard", { timeout: 60000 });
for (const p of paths) {
  const [url, name, w] = p.split("|");
  if (w) await page.setViewportSize({ width: Number(w), height: 900 });
  const res = await page.goto(`http://localhost:3000${url}`, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: true });
  console.log(url, res?.status());
  if (w) await page.setViewportSize({ width: 1440, height: 1000 });
}
console.log("errors:", JSON.stringify(errors, null, 1));
await browser.close();
