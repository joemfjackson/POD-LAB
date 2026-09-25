import { readFileSync } from "node:fs";
import { expect, type Page } from "@playwright/test";

export interface E2EState {
  email: string;
  password: string;
  workspaceId: string;
  brandId: string;
}

export function state(): E2EState {
  return JSON.parse(readFileSync("test-results/e2e-state.json", "utf8")) as E2EState;
}

export async function login(page: Page, s: E2EState = state()) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(s.email);
  await page.getByLabel("Password").fill(s.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}
