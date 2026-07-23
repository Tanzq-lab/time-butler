import { test, expect } from "./helpers";

test.describe("Tasks", () => {
  test.beforeEach(async ({ page }) => {
    await page.getByRole("link", { name: "任务" }).click();
    await expect(page).toHaveURL(/\/#\/tasks/);
  });

  test("shows Tasks page with title and Add Focus Task button", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "我的任务" })).toBeVisible();
    const focusSection = page.getByRole("region", { name: "专注任务" });
    const focusActions = focusSection.getByRole("group", { name: "专注任务操作" });

    await expect(focusActions.getByRole("button", { name: "添加专注任务" })).toBeVisible();
    await expect(focusActions.getByRole("button", { name: "添加循环任务" })).toBeVisible();
    await expect(focusActions.getByRole("button", { name: "列表视图" })).toBeVisible();
    await expect(focusActions.getByRole("button", { name: "网格视图" })).toBeVisible();
  });

  test("keeps the selected task view after navigating away and back", async ({ page }) => {
    const gridViewButton = page.getByRole("button", { name: "网格视图" });

    await gridViewButton.click();
    await expect(gridViewButton).toHaveAttribute("aria-pressed", "true");

    await page.getByRole("link", { name: "计时" }).click();
    await page.getByRole("link", { name: "任务" }).click();

    await expect(page.getByRole("button", { name: "网格视图" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("shows and edits the original recurring rules", async ({ page }) => {
    await page.getByRole("button", { name: "添加循环任务" }).click();

    const dialog = page.getByRole("dialog", { name: "添加循环任务" });
    const configuredRules = dialog.locator("summary").filter({
      hasText: "已配置规则",
    });
    await expect(configuredRules).toContainText("4");
    await configuredRules.click();

    for (const ruleName of ["周总结", "月总结", "年总结", "复习 ANKI"]) {
      await expect(
        dialog.getByRole("button", { name: `编辑循环规则：${ruleName}` }),
      ).toBeVisible();
    }

    await dialog.getByRole("button", { name: "编辑循环规则：月总结" }).click();
    const editDialog = page.getByRole("dialog", { name: "编辑循环任务" });
    await expect(editDialog.getByLabel("任务名称")).toHaveValue("月总结");
    await expect(
      editDialog.getByRole("button", { name: "每月首个休息日", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(editDialog.getByLabel("生效日期")).toHaveValue("2026-01-01");

    await editDialog.getByLabel("任务名称").fill("月度复盘");
    await editDialog.getByLabel("提醒时间").fill("10:15");
    await editDialog.getByRole("button", { name: "保存修改" }).click();

    const updatedDialog = page.getByRole("dialog", { name: "添加循环任务" });
    await expect(updatedDialog.getByText("月度复盘", { exact: true })).toBeVisible();
    await expect(
      updatedDialog.getByText(/每月首个休息日 10:15 生成任务/),
    ).toBeVisible();
    await updatedDialog.getByRole("button", { name: "关闭对话框" }).click();

    await page.getByRole("button", { name: "添加循环任务" }).click();
    const persistedDialog = page.getByRole("dialog", { name: "添加循环任务" });
    await persistedDialog.getByText("已配置规则").click();
    await expect(
      persistedDialog.getByRole("button", { name: "编辑循环规则：月度复盘" }),
    ).toBeVisible();
  });

  test("creates, edits, and pauses a recurring task from the task list", async ({ page }) => {
    await page.getByRole("button", { name: "添加循环任务" }).click();

    const dialog = page.getByRole("dialog", { name: "添加循环任务" });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("任务名称").fill("每日整理收件箱");
    await dialog.getByRole("button", { name: "循环任务预计 1 个番茄" }).click();
    await dialog.getByLabel(/项目/).fill("个人效率");
    await dialog.getByRole("button", { name: "创建循环任务" }).click();

    await expect(dialog).not.toBeVisible();
    await expect(page.getByText("每日整理收件箱")).toBeVisible();

    await page.getByRole("button", { name: "添加循环任务" }).click();
    const reopenedDialog = page.getByRole("dialog", { name: "添加循环任务" });
    await reopenedDialog.getByText("已配置规则").click();
    const editRuleButton = reopenedDialog.getByRole("button", {
      name: "编辑循环规则：每日整理收件箱",
    });
    await editRuleButton.focus();
    await page.keyboard.press("Enter");

    const editDialog = page.getByRole("dialog", { name: "编辑循环任务" });
    await expect(editDialog.getByLabel("任务名称")).toHaveValue("每日整理收件箱");
    await expect(editDialog.getByLabel("任务名称")).toBeFocused();
    await expect(editDialog.getByLabel(/项目/)).toHaveValue("个人效率");
    await editDialog.getByLabel("任务名称").fill("每周整理收件箱");
    await editDialog.getByRole("button", { name: "每周" }).click();
    await editDialog.getByLabel("提醒时间").fill("10:30");
    await editDialog.getByRole("button", { name: "保存修改" }).click();

    const updatedDialog = page.getByRole("dialog", { name: "添加循环任务" });
    await expect(updatedDialog).toBeVisible();
    await expect(updatedDialog.getByText("每周整理收件箱")).toBeVisible();
    await expect(updatedDialog.getByRole("status")).toContainText(
      "修改只影响之后新生成的任务",
    );
    await updatedDialog.getByRole("button", { name: "关闭对话框" }).click();
    await expect(page.getByText("每日整理收件箱", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "添加循环任务" }).click();
    const persistedDialog = page.getByRole("dialog", { name: "添加循环任务" });
    await persistedDialog.getByText("已配置规则").click();
    await expect(
      persistedDialog.getByRole("button", { name: "编辑循环规则：每周整理收件箱" }),
    ).toBeVisible();
    await expect(
      persistedDialog.getByRole("button", { name: "编辑循环规则：每日整理收件箱" }),
    ).toHaveCount(0);
    await expect(
      persistedDialog.getByText(/每周[一二三四五六日] 10:30 生成任务/),
    ).toBeVisible();
    await persistedDialog
      .getByRole("button", { name: "停用循环规则：每周整理收件箱" })
      .click();
    await expect(
      persistedDialog.getByRole("button", { name: "启用循环规则：每周整理收件箱" }),
    ).toBeVisible();
  });

  test("opens add task modal and creates a task", async ({ page }) => {
    await page.getByRole("button", { name: "添加专注任务" }).click();

    await expect(page.getByRole("dialog", { name: "新建任务" })).toBeVisible();
    await expect(page.getByPlaceholder("你现在要做什么？")).toBeVisible();

    await page.getByPlaceholder("你现在要做什么？").fill("我的第一个测试任务");
    await page.getByRole("button", { name: "预计 1 个番茄" }).click();
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
    await page.getByRole("button", { name: "预计 1 个番茄" }).click();
    await page.getByRole("button", { name: "创建任务" }).click();

    await page.getByRole("button", { name: "添加专注任务" }).click();
    await page.getByPlaceholder("你现在要做什么？").fill("代码重构");
    await page.getByRole("button", { name: "预计 1 个番茄" }).click();
    await page.getByRole("button", { name: "创建任务" }).click();

    await expect(page.getByText("设计评审")).toBeVisible();
    await expect(page.getByText("代码重构")).toBeVisible();

    await page.getByPlaceholder("搜索待办和任务…").fill("设计");
    await expect(page.getByText("设计评审")).toBeVisible();
    await expect(page.getByText("代码重构")).not.toBeVisible();
  });

  test("clicking a task selects it without claiming focus has started", async ({ page }) => {
    await page.getByRole("button", { name: "添加专注任务" }).click();
    await page.getByPlaceholder("你现在要做什么？").fill("测试进行中任务");
    await page.getByRole("button", { name: "预计 4 个番茄" }).click();
    await page.getByRole("button", { name: "创建任务" }).click();

    const taskButton = page.getByRole("button", {
      name: "测试进行中任务 0/4 个番茄，未开始",
    });
    await taskButton.click();

    await expect(taskButton).toHaveAttribute("aria-pressed", "true");
    const taskCard = taskButton.locator("xpath=ancestor::article");
    await expect(taskCard.getByText("未开始", { exact: true })).toBeVisible();
    await expect(taskCard.getByText("进行中", { exact: true })).toHaveCount(0);
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
    await page.getByRole("button", { name: "预计 1 个番茄" }).click();
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
