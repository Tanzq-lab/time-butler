import { test, expect } from "./helpers";

test.describe("Tasks", () => {
  test.beforeEach(async ({ page }) => {
    await page.getByRole("link", { name: "任务" }).click();
    await expect(page).toHaveURL(/\/#\/tasks/);
  });

  test("shows Tasks page with title and Add Focus Task button", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "我的任务" })).toBeVisible();
    await expect(page.getByRole("button", { name: "添加专注任务" })).toBeVisible();
  });

  test("opens add task modal and creates a task", async ({ page }) => {
    await page.getByRole("button", { name: "添加专注任务" }).click();

    await expect(page.getByRole("dialog", { name: "新建任务" })).toBeVisible();
    await expect(page.getByPlaceholder("你现在要做什么？")).toBeVisible();

    await page.getByPlaceholder("你现在要做什么？").fill("我的第一个测试任务");
    await page.getByRole("button", { name: "创建任务" }).click();

    await expect(page.getByText("我的第一个测试任务")).toBeVisible();
  });

  test("validates empty task name — CREATE TASK is disabled", async ({ page }) => {
    await page.getByRole("button", { name: "添加专注任务" }).click();
    await expect(page.getByRole("button", { name: "创建任务" })).toBeDisabled();
  });

  test("cancel button closes modal without creating task", async ({ page }) => {
    await page.getByRole("button", { name: "添加专注任务" }).click();
    await page.getByPlaceholder("你现在要做什么？").fill("不应出现");

    await page.getByRole("button", { name: "取消" }).click();
    await expect(page.getByRole("dialog", { name: "新建任务" })).not.toBeVisible();
    await expect(page.getByText("不应出现")).not.toBeVisible();
  });

  test("search input filters tasks", async ({ page }) => {
    await page.getByRole("button", { name: "添加专注任务" }).click();
    await page.getByPlaceholder("你现在要做什么？").fill("设计评审");
    await page.getByRole("button", { name: "创建任务" }).click();

    await page.getByRole("button", { name: "添加专注任务" }).click();
    await page.getByPlaceholder("你现在要做什么？").fill("代码重构");
    await page.getByRole("button", { name: "创建任务" }).click();

    await expect(page.getByText("设计评审")).toBeVisible();
    await expect(page.getByText("代码重构")).toBeVisible();

    await page.getByPlaceholder("搜索待办和任务…").fill("设计");
    await expect(page.getByText("设计评审")).toBeVisible();
    await expect(page.getByText("代码重构")).not.toBeVisible();
  });

  test("clicking a task sets it as active", async ({ page }) => {
    await page.getByRole("button", { name: "添加专注任务" }).click();
    await page.getByPlaceholder("你现在要做什么？").fill("测试进行中任务");
    await page.getByRole("button", { name: "创建任务" }).click();

    await page.getByRole("button", { name: /^测试进行中任务 0\/4 个番茄$/ }).click();

    // The "Active" badge appears near the task — use exact text match within a badge element
    await expect(page.getByText("进行中", { exact: true }).last()).toBeVisible();
  });

  test("quick-adds, completes, and reopens a todo", async ({ page }) => {
    const title = "购买 E2E 测试用品";
    const input = page.getByPlaceholder("添加待办，按回车保存…");

    await input.fill(title);
    await input.press("Enter");
    await expect(page.getByText(title)).toBeVisible();

    await page.getByRole("checkbox", { name: `完成待办：${title}` }).click();
    await page.getByRole("button", { name: "已完成待办（1）" }).click();
    await page.getByRole("checkbox", { name: `恢复待办：${title}` }).click();

    await expect(
      page.getByRole("checkbox", { name: `完成待办：${title}` }),
    ).toBeVisible();
  });

  test("edits a todo and filters it with the shared search", async ({ page }) => {
    const original = "购买旧名称";
    const updated = "购买人体工学键盘";

    await page.getByPlaceholder("添加待办，按回车保存…").fill(original);
    await page.getByPlaceholder("添加待办，按回车保存…").press("Enter");
    await page.getByRole("button", { name: `编辑待办：${original}` }).click();
    await page.getByRole("textbox", { name: `编辑待办：${original}` }).fill(updated);
    await page.getByRole("button", { name: `保存待办：${original}` }).click();

    await page.getByPlaceholder("搜索待办和任务…").fill("人体工学");
    await expect(page.getByText(updated)).toBeVisible();
    await expect(page.getByText(original)).not.toBeVisible();
  });

  test("converts a todo only after focus-task creation succeeds", async ({ page }) => {
    const title = "整理书桌并规划收纳";

    await page.getByPlaceholder("添加待办，按回车保存…").fill(title);
    await page.getByPlaceholder("添加待办，按回车保存…").press("Enter");
    await page.getByRole("button", { name: `转为专注任务：${title}` }).click();

    const taskName = page.getByLabel("任务名称");
    await expect(taskName).toHaveValue(title);
    await page.getByRole("button", { name: "取消" }).click();
    await expect(page.getByRole("checkbox", { name: `完成待办：${title}` })).toBeVisible();

    await page.getByRole("button", { name: `转为专注任务：${title}` }).click();
    await page.getByRole("button", { name: /创建任务/ }).click();

    await expect(page.getByRole("checkbox", { name: `完成待办：${title}` })).not.toBeVisible();
    await expect(page.getByText(title)).toBeVisible();
  });

  test("offers todo actions from the mobile menu", async ({ page }) => {
    const title = "移动端待办菜单";
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByPlaceholder("添加待办，按回车保存…").fill(title);
    await page.getByPlaceholder("添加待办，按回车保存…").press("Enter");

    await page.getByRole("button", { name: `更多待办操作：${title}` }).click();
    await expect(page.getByRole("dialog", { name: `待办操作：${title}` })).toBeVisible();
    await expect(page.getByRole("button", { name: "编辑待办" })).toBeVisible();
    await expect(page.getByRole("button", { name: "转为专注任务" })).toBeVisible();
    await expect(page.getByRole("button", { name: "删除待办" })).toBeVisible();
  });

  test("keeps todos out of the timer task selector", async ({ page }) => {
    const title = "不应进入计时器的待办";
    await page.getByPlaceholder("添加待办，按回车保存…").fill(title);
    await page.getByPlaceholder("添加待办，按回车保存…").press("Enter");
    await expect(page.getByText(title)).toBeVisible();

    await page.getByRole("link", { name: "计时" }).click();
    await page.getByRole("button", { name: "选择任务" }).click();

    const taskDialog = page.getByRole("dialog").filter({
      has: page.getByRole("heading", { name: "选择任务" }),
    });
    await expect(taskDialog).toBeVisible();
    await expect(taskDialog.getByText(title)).not.toBeVisible();
  });
});
