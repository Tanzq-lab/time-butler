import { test, expect } from "./helpers";

test.describe("Navigation", () => {
  test("starts on the Timer page", async ({ page }) => {
    await expect(page.locator("#main-content").getByRole("button", { name: "开始专注" })).toBeVisible();
    await expect(page.getByText("Time Butler")).toBeVisible();
  });

  test("navigates to Tasks page via sidebar", async ({ page }) => {
    await page.getByRole("link", { name: "任务" }).click();
    await expect(page).toHaveURL(/\/#\/tasks/);
    await expect(page.getByRole("heading", { name: "我的任务" })).toBeVisible();
  });

  test("navigates to Calendar page via sidebar", async ({ page }) => {
    await page.getByRole("link", { name: "日历" }).click();
    await expect(page).toHaveURL(/\/#\/calendar/);
    await expect(page.getByRole("heading", { name: "每周时间线" })).toBeVisible();
  });

  test("navigates to Records page via sidebar", async ({ page }) => {
    await page.getByRole("link", { name: "记录" }).click();
    await expect(page).toHaveURL(/\/#\/notes/);
    await expect(page.getByRole("heading", { name: "时间计划工作台" })).toBeVisible();
  });

  test("navigates to Analytics page via sidebar", async ({ page }) => {
    await page.getByRole("link", { name: "分析" }).click();
    await expect(page).toHaveURL(/\/#\/analytics/);
    await expect(page.getByRole("heading", { name: "专注洞察" })).toBeVisible();
  });

  test("navigates to Settings page via sidebar", async ({ page }) => {
    await page.getByRole("link", { name: "设置" }).click();
    await expect(page).toHaveURL(/\/#\/settings/);
    await expect(page.getByRole("heading", { name: "应用设置" })).toBeVisible();
  });

  test("navigates to Help/Onboarding page", async ({ page }) => {
    await page.getByRole("link", { name: "帮助" }).click();
    await expect(page).toHaveURL(/\/#\/onboarding/);
    await expect(page.getByRole("heading", { name: "欢迎使用 Time Butler" })).toBeVisible();
  });

  test("navigates back to Timer via sidebar START SESSION button", async ({ page }) => {
    await page.getByRole("link", { name: "任务" }).click();
    await expect(page).toHaveURL(/\/#\/tasks/);

    await page.locator("aside").getByRole("button", { name: "开始专注" }).click();
    await expect(page).toHaveURL(/\/#\/$/);
  });

  test("running session replaces the sidebar start action with a timer", async ({ page }) => {
    await page.getByRole("link", { name: "任务" }).click();
    await page.locator("aside").getByRole("button", { name: "开始专注" }).click();
    await expect(page).toHaveURL(/\/#\/$/);

    await page.getByRole("link", { name: "任务" }).click();
    const status = page.getByRole("region", { name: "当前专注状态" });
    await expect(status.getByRole("timer")).toHaveText(/\d{2}:\d{2}/);
    await expect(status.getByRole("button", { name: "暂停专注" })).toBeVisible();
  });
});
