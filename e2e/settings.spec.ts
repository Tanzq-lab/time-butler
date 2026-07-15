import { test, expect } from "./helpers";

test.describe("Settings", () => {
  test.beforeEach(async ({ page }) => {
    await page.getByRole("link", { name: "设置" }).click();
    await expect(page).toHaveURL(/\/#\/settings/);
  });

  test("shows all settings tabs", async ({ page }) => {
    await expect(page.getByRole("button", { name: "通用" })).toBeVisible();
    await expect(page.getByRole("button", { name: "专注节奏" })).toBeVisible();
    await expect(page.getByRole("button", { name: "通知" })).toBeVisible();
    await expect(page.getByRole("button", { name: "快捷键" })).toBeVisible();
    await expect(page.getByRole("button", { name: "隐私与数据" })).toBeVisible();
  });

  test("General tab shows theme picker and toggles", async ({ page }) => {
    await page.getByRole("button", { name: "通用" }).click();
    await expect(page.getByText("外观")).toBeVisible();
    await expect(page.getByRole("button", { name: "浅色" })).toBeVisible();
    await expect(page.getByRole("button", { name: "深色" })).toBeVisible();
    await expect(page.getByRole("button", { name: "跟随系统" })).toBeVisible();
  });

  test("Focus Rhythm tab shows duration inputs", async ({ page }) => {
    await page.getByRole("button", { name: "专注节奏" }).click();
    await expect(page.getByRole("heading", { name: "专注节奏" })).toBeVisible();
    await expect(page.getByText("专注时长")).toBeVisible();
  });

  test("Hotkeys tab shows keyboard shortcuts", async ({ page }) => {
    await page.getByRole("button", { name: "快捷键" }).click();
    await expect(page.getByText("键盘快捷键")).toBeVisible();
    await expect(page.getByText("开始 / 暂停计时")).toBeVisible();
    await expect(page.getByText("重置计时")).toBeVisible();
    await expect(page.getByText("完成本轮")).toBeVisible();
  });

  test("Privacy & Data tab shows clear data option", async ({ page }) => {
    await page.getByRole("button", { name: "隐私与数据" }).click();
    await page.getByRole("button", { name: "清除所有数据" }).click();
    await expect(page.getByRole("dialog", { name: "清除所有数据？" })).toBeVisible();
    await page.getByRole("button", { name: "取消" }).click();
    await expect(page.getByRole("dialog", { name: "清除所有数据？" })).not.toBeVisible();
  });

  test("Notifications tab shows notification controls", async ({ page }) => {
    await page.getByRole("button", { name: "通知" }).click();
    await expect(page.getByText("通知与声音")).toBeVisible();
  });
});
