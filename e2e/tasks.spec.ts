import { test, expect } from "./helpers";

test.describe("Tasks", () => {
  test.beforeEach(async ({ page }) => {
    await page.getByRole("link", { name: "任务" }).click();
    await expect(page).toHaveURL(/\/#\/tasks/);
  });

  test("shows Tasks page with title and Add Task button", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "我的任务" })).toBeVisible();
    await expect(page.getByRole("button", { name: "添加任务" })).toBeVisible();
  });

  test("opens add task modal and creates a task", async ({ page }) => {
    await page.getByRole("button", { name: "添加任务" }).click();

    await expect(page.getByRole("dialog", { name: "新建任务" })).toBeVisible();
    await expect(page.getByPlaceholder("你现在要做什么？")).toBeVisible();

    await page.getByPlaceholder("你现在要做什么？").fill("我的第一个测试任务");
    await page.getByRole("button", { name: "创建任务" }).click();

    await expect(page.getByText("我的第一个测试任务")).toBeVisible();
  });

  test("validates empty task name — CREATE TASK is disabled", async ({ page }) => {
    await page.getByRole("button", { name: "添加任务" }).click();
    await expect(page.getByRole("button", { name: "创建任务" })).toBeDisabled();
  });

  test("cancel button closes modal without creating task", async ({ page }) => {
    await page.getByRole("button", { name: "添加任务" }).click();
    await page.getByPlaceholder("你现在要做什么？").fill("不应出现");

    await page.getByRole("button", { name: "取消" }).click();
    await expect(page.getByRole("dialog", { name: "新建任务" })).not.toBeVisible();
    await expect(page.getByText("不应出现")).not.toBeVisible();
  });

  test("search input filters tasks", async ({ page }) => {
    await page.getByRole("button", { name: "添加任务" }).click();
    await page.getByPlaceholder("你现在要做什么？").fill("设计评审");
    await page.getByRole("button", { name: "创建任务" }).click();

    await page.getByRole("button", { name: "添加任务" }).click();
    await page.getByPlaceholder("你现在要做什么？").fill("代码重构");
    await page.getByRole("button", { name: "创建任务" }).click();

    await expect(page.getByText("设计评审")).toBeVisible();
    await expect(page.getByText("代码重构")).toBeVisible();

    await page.getByPlaceholder("搜索任务…").fill("设计");
    await expect(page.getByText("设计评审")).toBeVisible();
    await expect(page.getByText("代码重构")).not.toBeVisible();
  });

  test("clicking a task sets it as active", async ({ page }) => {
    await page.getByRole("button", { name: "添加任务" }).click();
    await page.getByPlaceholder("你现在要做什么？").fill("测试进行中任务");
    await page.getByRole("button", { name: "创建任务" }).click();

    await page.getByRole("button", { name: /^测试进行中任务 0\/4 个番茄$/ }).click();

    // The "Active" badge appears near the task — use exact text match within a badge element
    await expect(page.getByText("进行中", { exact: true }).last()).toBeVisible();
  });
});
