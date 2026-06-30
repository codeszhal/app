import { expect, test } from "@playwright/test";
import path from "node:path";
import { pathToFileURL } from "node:url";

const appUrl = pathToFileURL(path.join(process.cwd(), "index.html")).toString();

test.beforeEach(async ({ page }) => {
  await page.goto(appUrl);
});

test("updates calculated columns and totals on every keystroke in table mode", async ({ page }) => {
  const firstRow = page.locator("#tableRows .row-wrap").first();
  const incomeInput = firstRow.locator(".money-input").nth(0);
  const expenseInput = firstRow.locator(".money-input").nth(1);

  await incomeInput.fill("10+5");
  await expect(firstRow.locator(".amount-box").nth(0)).toHaveText("15");
  await expect(page.locator("#totalIncome")).toHaveText("715");

  await expenseInput.fill("10");
  await expect(firstRow.locator(".amount-box").nth(1)).toHaveText("10");
  await expect(page.locator("#totalExpense")).toHaveText("660");
  await expect(firstRow.locator(".pill")).toContainText("差");
});

test("updates calculated columns live in vertical mode", async ({ page }) => {
  await page.locator("#modeBtn").click();

  const firstCard = page.locator("#verticalRows .v-card").first();
  await firstCard.locator(".money-input").nth(0).fill("30*2");

  await expect(firstCard.locator(".v-result").nth(0)).toHaveText("60");
  await expect(page.locator("#totalIncome")).toHaveText("760");
});

test("removes side-send and image buttons from row UI", async ({ page }) => {
  await expect(page.locator("#tableRows button", { hasText: "发" })).toHaveCount(0);
  await expect(page.locator("#tableRows button", { hasText: "图" })).toHaveCount(0);
  await expect(page.locator("#tableRows button", { hasText: "看" })).toHaveCount(0);

  await page.locator("#modeBtn").click();
  await expect(page.locator("#verticalRows button", { hasText: "发" })).toHaveCount(0);
  await expect(page.locator("#verticalRows button", { hasText: "图" })).toHaveCount(0);
  await expect(page.locator("#verticalRows button", { hasText: "看" })).toHaveCount(0);
});

test("uses the requested Telegram contacts", async ({ page }) => {
  await expect(page.locator("#telegramUser option")).toHaveText([
    "Lobeng · 6201817840",
    "Ocha · 5817507946",
    "Faisal · 5137608953",
  ]);
});
