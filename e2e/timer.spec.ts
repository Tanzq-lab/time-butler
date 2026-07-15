import { test, expect, waitForApp } from "./helpers";

test.describe("Timer", () => {
  test("shows default 25:00 timer with START FOCUS button", async ({ page }) => {
    await expect(page.getByRole("textbox", { name: "设置计时时长" })).toHaveValue("25:00");
    await expect(page.locator("#main-content").getByRole("button", { name: "开始专注" })).toBeVisible();
  });

  test("switches to Break phase", async ({ page }) => {
    await page.getByRole("button", { name: "休息", exact: true }).click();
    await expect(page.getByRole("textbox", { name: "设置计时时长" })).toHaveValue("05:00");
  });

  test("switches back to Focus phase from Break", async ({ page }) => {
    await page.getByRole("button", { name: "休息", exact: true }).click();
    await expect(page.getByRole("textbox", { name: "设置计时时长" })).toHaveValue("05:00");

    await page.getByRole("button", { name: "专注", exact: true }).click();
    await expect(page.getByRole("textbox", { name: "设置计时时长" })).toHaveValue("25:00");
  });

  test("starts and pauses timer", async ({ page }) => {
    await page.locator("#main-content").getByRole("button", { name: "开始专注" }).click();
    await expect(page.getByRole("button", { name: "暂停" })).toBeVisible();

    await page.getByRole("button", { name: "暂停" }).click();
    await expect(page.getByRole("button", { name: "继续" })).toBeVisible();
  });

  test("abandon session returns to idle", async ({ page }) => {
    await page.locator("#main-content").getByRole("button", { name: "开始专注" }).click();
    await expect(page.getByRole("button", { name: "放弃" })).toBeVisible();

    await page.getByRole("button", { name: "放弃" }).click();
    await expect(page.locator("#main-content").getByRole("button", { name: "开始专注" })).toBeVisible();
  });

  test("phase selector buttons are hidden in fullscreen while running", async ({ page }) => {
    await page.locator("#main-content").getByRole("button", { name: "开始专注" }).click();

    await expect(page.getByRole("button", { name: "专注", exact: true })).not.toBeVisible();
    await expect(page.getByRole("button", { name: "休息", exact: true })).not.toBeVisible();
  });

  test("reset button returns timer to idle", async ({ page }) => {
    await page.getByRole("button", { name: "休息", exact: true }).click();
    await page.locator("#main-content").getByRole("button", { name: "开始休息" }).click();
    await expect(page.getByRole("button", { name: "暂停" })).toBeVisible();

    await page.getByRole("button", { name: "重置", exact: true }).click();
    await expect(page.locator("#main-content").getByRole("button", { name: "开始休息" })).toBeVisible();
  });

  test("starts focus directly when a completed break is acknowledged", async ({ page }) => {
    await page.evaluate(() => {
      window.localStorage.setItem(
        "time-butler:timer-state:v1",
        JSON.stringify({
          phase: "work",
          status: "idle",
          secondsRemaining: 25 * 60,
          totalSeconds: 25 * 60,
          completedPomos: 1,
          activeTaskId: null,
          currentSessionId: null,
          currentSessionTaskId: null,
          selectedCategory: null,
          durations: { work: 25 * 60, short: 5 * 60, long: 15 * 60 },
          deadlineAtMs: null,
          pendingFocusReview: {
            sessionId: 9,
            durationSec: 25 * 60,
            ready: true,
          },
          breakReminderActive: true,
          savedAt: Date.now(),
        }),
      );
    });
    await page.reload();
    await waitForApp(page);

    await expect(page.getByRole("status")).toContainText("休息结束");
    await expect(page.getByRole("status")).toContainText("准备好就开始下一轮专注");
    await expect(page.getByRole("button", { name: "稍后开始" })).toBeVisible();

    await page.locator("#main-content").getByRole("button", { name: "开始专注" }).click();

    await expect(page.getByRole("button", { name: "暂停" })).toBeVisible();
    await expect(page.getByText("这次专注有什么收获？")).not.toBeVisible();
  });
});
