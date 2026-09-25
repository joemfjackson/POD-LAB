import { expect, test } from "@playwright/test";
import { login, state } from "./helpers";

test.describe("POD Lab smoke", () => {
  test("sign up, create a workspace and land on the dashboard", async ({ page }) => {
    await page.goto("/signup");
    await page.getByLabel("Name").fill("New Operator");
    await page.getByLabel("Email", { exact: true }).fill(`signup-${Date.now()}@podlab.test`);
    await page.getByLabel("Password").fill("Signup-password-1");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/onboarding/);
    await page.getByLabel("Workspace name").fill("Signup Lab");
    await page.getByRole("button", { name: "Create workspace" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("heading", { name: "Command center" })).toBeVisible();
  });

  test("login redirects anonymous users and signs in", async ({ page }) => {
    await page.goto("/brands");
    await expect(page).toHaveURL(/\/login\?next=%2Fbrands/);
    await login(page);
    await expect(page.getByText("Stage pipeline")).toBeVisible();
    await expect(page.getByText("Opportunities discovered")).toBeVisible();
  });

  test("dashboard shows the pipeline, approvals and activity", async ({ page }) => {
    await login(page);
    await expect(page.getByRole("list", { name: "Brand pipeline by stage" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Approval requests" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Recent agent activity" })).toBeVisible();
    await expect(page.getByText("Demo AI provider active.")).toBeVisible();
  });

  test("create a research mission and see scored candidates", async ({ page }) => {
    await login(page);
    await page.goto("/opportunities?new=1");
    const dialog = page.getByRole("dialog", { name: "New research mission" });
    await dialog.getByLabel("Title").fill("Research 4 balloon artist niches");
    await dialog.getByLabel("Mission brief").fill("Find 4 balloon artist niches");
    await dialog.getByLabel("Max candidates").fill("4");
    await dialog.getByRole("button", { name: "Create mission & run Scout" }).click();
    await expect(dialog.getByText(/MIS-\d{4}: Generated 4 opportunities/)).toBeVisible({ timeout: 30_000 });
    await page.keyboard.press("Escape");
    await page.goto("/opportunities?view=candidates");
    await expect(page.getByRole("heading", { name: /Balloon Artist/ }).first()).toBeVisible();
  });

  test("approve an opportunity and get a Brand Record", async ({ page }) => {
    await login(page);
    await page.goto("/opportunities?view=candidates");
    await page.getByRole("heading", { name: /Balloon Artist/ }).first().getByRole("link").click();
    await expect(page.getByRole("heading", { name: "Scores" })).toBeVisible();
    await page.getByLabel("Reason (optional)").fill("Strong identity, worth a test");
    await page.getByRole("button", { name: "Approve opportunity" }).click();
    // The page re-renders into the approved state: status chip, approval history and the new brand link.
    await expect(page.getByRole("link", { name: /Open PL-\d{4}/ })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("button", { name: "Send to Brand Architect" })).toBeVisible();
    await expect(page.getByText("Strong identity, worth a test")).toBeVisible();
    await page.getByRole("link", { name: /Open PL-\d{4}/ }).click();
    await expect(page.getByText("Brand Record")).toBeVisible();
  });

  test("open PL-0001 and browse its record", async ({ page }) => {
    await login(page);
    await page.goto(`/brands/${state().brandId}`);
    await expect(page.getByRole("main").getByText("PL-0001", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Brand Record" })).toBeVisible();
    await page.getByRole("link", { name: "Names" }).click();
    await expect(page.getByText("Preliminary research only")).toBeVisible();
    await page.getByRole("link", { name: "Agent History" }).click();
    await expect(page.getByRole("heading", { name: "Agent jobs" })).toBeVisible();
  });

  test("review a design concept", async ({ page }) => {
    await login(page);
    await page.goto("/design-studio?status=production_ready");
    await page.getByRole("link", { name: /RECURSIVE SELF IMPROVEMENT/ }).first().click();
    await expect(page.getByRole("heading", { name: "Production brief" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Compliance" })).toBeVisible();
    await expect(page.getByText("not legal advice").first()).toBeVisible();
    await expect(page.getByText(/Requires provider connection/).first()).toBeVisible();
  });

  test("attach a product manually and get deterministic economics", async ({ page }) => {
    await login(page);
    await page.goto(`/brands/${state().brandId}/products`);
    await page.getByLabel("Title").fill("E2E Hoodie");
    await page.getByLabel("Retail price ($)").fill("64.99");
    await page.getByRole("button", { name: "Add product" }).click();
    await expect(page.getByText(/Added PRD-\d{4}:/)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("cell", { name: /E2E Hoodie/ }).first()).toBeVisible();
  });

  test("view the storefront preview on desktop and mobile", async ({ page }) => {
    await login(page);
    await page.goto("/stores");
    await page.getByRole("link", { name: "Preview" }).first().click();
    const preview = page.getByTestId("storefront-preview");
    await expect(preview.getByRole("navigation", { name: "Store navigation" })).toBeVisible();
    await expect(preview.getByRole("heading", { name: "Shop the drop" })).toBeVisible();
    await page.getByRole("link", { name: "Mobile" }).click();
    await expect(page).toHaveURL(/device=mobile/);
    await preview.getByRole("link", { name: /THE CURVE GOES VERTICAL/ }).first().click();
    await expect(page).toHaveURL(/product=/);
    await expect(preview.getByRole("button", { name: "Add to cart" })).toBeDisabled();
  });

  test("command bar opens records by ID", async ({ page }) => {
    await login(page);
    await page.getByRole("button", { name: "Open command bar" }).click();
    await page.getByLabel("Command", { exact: true }).fill("Open PL-0001");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`/brands/${state().brandId}`));
  });
});
