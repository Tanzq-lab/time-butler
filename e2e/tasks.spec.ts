import { test, expect } from "./helpers";

test.describe("Tasks", () => {
  test.beforeEach(async ({ page }) => {
    await page.getByRole("link", { name: "任务" }).click();
    await expect(page).toHaveURL(/\/#\/tasks/);
  });

  test("shows Tasks page with title and Add Focus Task button", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "我的任务" })).toBeVisible();
    const taskActions = page.getByRole("group", { name: "任务操作" });

    await expect(taskActions.getByRole("button", { name: "添加专注任务" })).toBeVisible();
    await expect(taskActions.getByRole("button", { name: "添加循环任务" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "添加任务" })).toBeVisible();
  });

  test("tracks child progress, completes the parent, and reopens it", async ({ page }) => {
    const parent = "发布产品更新";
    const firstChild = "完成回归测试";
    const secondChild = "整理发布说明";
    const quickInput = page.getByRole("textbox", { name: "添加任务" });

    await quickInput.fill(parent);
    await quickInput.press("Enter");

    const parentRow = page.locator("article").filter({ hasText: parent }).first();
    await parentRow.hover();
    await parentRow.getByRole("button", { name: `添加子任务：${parent}` }).click();
    await page.getByRole("textbox", { name: `添加子任务：${parent}` }).fill(firstChild);
    await page.getByRole("textbox", { name: `添加子任务：${parent}` }).press("Enter");

    await parentRow.hover();
    await parentRow.getByRole("button", { name: `添加子任务：${parent}` }).click();
    await page.getByRole("textbox", { name: `添加子任务：${parent}` }).fill(secondChild);
    await page.getByRole("textbox", { name: `添加子任务：${parent}` }).press("Enter");

    const progress = page.getByRole("progressbar", { name: `${parent} 子任务进度` });
    await expect(progress).toHaveAttribute("aria-valuenow", "0");
    await expect(progress).toHaveAttribute("aria-valuemax", "2");

    await page.getByRole("checkbox", { name: `完成待办：${firstChild}` }).click();
    await expect(progress).toHaveAttribute("aria-valuenow", "1");
    const completedChildRow = page
      .locator("article")
      .filter({ hasText: firstChild })
      .first();
    await expect(
      completedChildRow.getByRole("checkbox", {
        name: `恢复待办：${firstChild}`,
      }),
    ).toBeVisible();
    await expect(
      completedChildRow.getByRole("button", {
        name: `编辑任务：${firstChild}`,
      }),
    ).toHaveCount(0);
    await expect(
      completedChildRow.getByRole("button", {
        name: `删除任务：${firstChild}`,
      }),
    ).toHaveCount(0);
    await expect(completedChildRow.getByTitle(firstChild)).not.toHaveClass(
      /line-through/,
    );
    await page.getByRole("checkbox", { name: `完成待办：${secondChild}` }).click();

    await page.getByRole("button", { name: "已完成（1）" }).click();
    await expect(progress).toHaveAttribute("aria-valuenow", "2");
    await page.getByRole("checkbox", { name: `恢复待办：${secondChild}` }).click();
    await expect(page.getByText(parent, { exact: true })).toBeVisible();
    await expect(progress).toHaveAttribute("aria-valuenow", "1");
  });

  test("shows and edits the original recurring rules", async ({ page }) => {
    await page.getByRole("button", { name: "添加循环任务" }).click();

    const dialog = page.getByRole("dialog", { name: "添加循环任务" });
    await expect(
      dialog.getByRole("button", { name: /管理已配置规则，共 4 条/ }),
    ).toBeVisible();
    await dialog.getByRole("button", { name: /管理已配置规则/ }).click();
    const rulesDialog = page.getByRole("dialog", { name: "管理循环规则" });

    for (const ruleName of ["周总结", "月总结", "年总结", "复习 ANKI"]) {
      await expect(
        rulesDialog.getByRole("button", { name: `编辑循环规则：${ruleName}` }),
      ).toBeVisible();
    }

    await rulesDialog.getByRole("button", { name: "编辑循环规则：月总结" }).click();
    const editDialog = page.getByRole("dialog", { name: "编辑循环任务" });
    await expect(editDialog.getByLabel("任务名称")).toHaveValue("月总结");
    await editDialog.getByLabel("任务名称").fill("月度复盘");
    await editDialog.getByRole("button", { name: /编辑循环设置/ }).click();
    const scheduleDialog = page.getByRole("dialog", { name: "设置循环时间" });
    await expect(
      scheduleDialog.getByRole("button", { name: "每月首个休息日", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(scheduleDialog.getByLabel("生效日期")).toHaveValue("2026-01-01");

    await scheduleDialog.getByLabel("提醒时间").fill("10:15");
    await scheduleDialog.getByRole("button", { name: "完成循环设置" }).click();
    await page
      .getByRole("dialog", { name: "编辑循环任务" })
      .getByRole("button", { name: "保存修改" })
      .click();

    const updatedDialog = page.getByRole("dialog", { name: "添加循环任务" });
    await updatedDialog.getByRole("button", { name: /管理已配置规则/ }).click();
    const updatedRulesDialog = page.getByRole("dialog", { name: "管理循环规则" });
    await expect(updatedRulesDialog.getByTitle("月度复盘")).toBeVisible();
    await expect(
      updatedRulesDialog.getByText(/每月首个休息日 10:15 生成任务/),
    ).toBeVisible();
    await updatedRulesDialog.getByRole("button", { name: "关闭对话框" }).click();

    await page.getByRole("button", { name: "添加循环任务" }).click();
    const persistedDialog = page.getByRole("dialog", { name: "添加循环任务" });
    await persistedDialog.getByRole("button", { name: /管理已配置规则/ }).click();
    const persistedRulesDialog = page.getByRole("dialog", {
      name: "管理循环规则",
    });
    await expect(
      persistedRulesDialog.getByRole("button", { name: "编辑循环规则：月度复盘" }),
    ).toBeVisible();
  });

  test("creates a recurring todo through the ordinary task template", async ({ page }) => {
    await page.getByRole("button", { name: "添加循环任务" }).click();

    const dialog = page.getByRole("dialog", { name: "添加循环任务" });
    await dialog.getByLabel("任务名称").fill("每日查看收件箱");
    await dialog.getByRole("button", { name: "创建循环任务" }).click();

    const todo = page
      .locator('article[data-task-kind="todo"]')
      .filter({ hasText: "每日查看收件箱" })
      .first();
    await expect(todo).toBeVisible();
    await expect(
      todo.getByRole("checkbox", { name: "完成待办：每日查看收件箱" }),
    ).toBeVisible();
  });

  test("copies template subtasks into a generated recurring task group", async ({ page }) => {
    await page.getByRole("button", { name: "添加循环任务" }).click();
    const dialog = page.getByRole("dialog", { name: "添加循环任务" });
    await dialog.getByLabel("任务名称").fill("每日阅读流程");
    await dialog.getByRole("button", { name: /编辑模板子任务/ }).click();

    const subtasksDialog = page.getByRole("dialog", {
      name: "设置模板子任务",
    });
    const subtaskDraft = subtasksDialog.getByLabel("新增模板子任务");
    await subtaskDraft.fill("准备材料");
    await subtasksDialog.getByRole("button", { name: "添加" }).click();
    await subtaskDraft.fill("深度阅读");
    await subtasksDialog.getByRole("button", { name: "添加" }).click();
    await subtasksDialog
      .getByRole("button", { name: "设为专注：深度阅读" })
      .click();
    await subtasksDialog
      .getByRole("button", {
        name: "子任务 深度阅读 预计 2 个番茄",
      })
      .click();
    await subtasksDialog
      .getByRole("button", { name: "完成子任务设置" })
      .click();
    await page
      .getByRole("dialog", { name: "添加循环任务" })
      .getByRole("button", { name: "创建循环任务" })
      .click();

    const parentRow = page
      .locator('[data-task-depth="0"]')
      .filter({ hasText: "每日阅读流程" });
    await expect(parentRow).toBeVisible();
    await expect(
      page
        .locator('[data-task-depth="1"][data-task-kind="todo"]')
        .filter({ hasText: "准备材料" }),
    ).toBeVisible();
    const focusChild = page
      .locator('[data-task-depth="1"][data-task-kind="focus"]')
      .filter({ hasText: "深度阅读" });
    await expect(focusChild).toBeVisible();
    await expect(focusChild).toContainText("0/2");
  });

  test("creates, edits, pauses, and deletes a recurring task from the task list", async ({ page }) => {
    await page.getByRole("button", { name: "添加循环任务" }).click();

    const dialog = page.getByRole("dialog", { name: "添加循环任务" });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("任务名称").fill("每日整理收件箱");
    await dialog.getByRole("button", { name: "设为专注" }).click();
    const focusDialog = page.getByRole("dialog", { name: "设置专注任务" });
    await focusDialog.getByRole("button", { name: "预计 1 个番茄" }).click();
    await focusDialog.getByRole("button", { name: "完成专注设置" }).click();
    const mainDialog = page.getByRole("dialog", { name: "添加循环任务" });
    await mainDialog.getByRole("button", { name: /编辑任务属性/ }).click();
    const attributesDialog = page.getByRole("dialog", { name: "设置任务属性" });
    await attributesDialog.getByLabel(/项目/).fill("个人效率");
    await attributesDialog.getByRole("button", { name: "完成任务属性" }).click();
    await page
      .getByRole("dialog", { name: "添加循环任务" })
      .getByRole("button", { name: "创建循环任务" })
      .click();

    await expect(dialog).not.toBeVisible();
    await expect(page.getByText("每日整理收件箱")).toBeVisible();

    await page.getByRole("button", { name: "添加循环任务" }).click();
    const reopenedDialog = page.getByRole("dialog", { name: "添加循环任务" });
    await reopenedDialog.getByRole("button", { name: /管理已配置规则/ }).click();
    const reopenedRulesDialog = page.getByRole("dialog", {
      name: "管理循环规则",
    });
    const editRuleButton = reopenedRulesDialog.getByRole("button", {
      name: "编辑循环规则：每日整理收件箱",
    });
    await editRuleButton.focus();
    await page.keyboard.press("Enter");

    const editDialog = page.getByRole("dialog", { name: "编辑循环任务" });
    await expect(editDialog.getByLabel("任务名称")).toHaveValue("每日整理收件箱");
    await expect(editDialog.getByLabel("任务名称")).toBeFocused();
    await editDialog.getByLabel("任务名称").fill("每周整理收件箱");
    await editDialog.getByRole("button", { name: /编辑任务属性/ }).click();
    const editAttributesDialog = page.getByRole("dialog", {
      name: "设置任务属性",
    });
    await expect(editAttributesDialog.getByLabel(/项目/)).toHaveValue("个人效率");
    await editAttributesDialog.getByRole("button", { name: "完成任务属性" }).click();
    await page
      .getByRole("dialog", { name: "编辑循环任务" })
      .getByRole("button", { name: /编辑循环设置/ })
      .click();
    const editScheduleDialog = page.getByRole("dialog", {
      name: "设置循环时间",
    });
    await editScheduleDialog.getByRole("button", { name: "每周" }).click();
    await editScheduleDialog.getByLabel("提醒时间").fill("10:30");
    await editScheduleDialog.getByRole("button", { name: "完成循环设置" }).click();
    await page
      .getByRole("dialog", { name: "编辑循环任务" })
      .getByRole("button", { name: "保存修改" })
      .click();

    const updatedDialog = page.getByRole("dialog", { name: "添加循环任务" });
    await expect(updatedDialog).toBeVisible();
    await expect(updatedDialog.getByRole("status")).toContainText(
      "修改只影响之后新生成的任务",
    );
    await updatedDialog.getByRole("button", { name: "关闭对话框" }).click();
    await expect(page.getByTitle("每日整理收件箱")).toBeVisible();

    await page.getByRole("button", { name: "添加循环任务" }).click();
    const persistedDialog = page.getByRole("dialog", { name: "添加循环任务" });
    await persistedDialog.getByRole("button", { name: /管理已配置规则/ }).click();
    const persistedRulesDialog = page.getByRole("dialog", {
      name: "管理循环规则",
    });
    await expect(
      persistedRulesDialog.getByRole("button", { name: "编辑循环规则：每周整理收件箱" }),
    ).toBeVisible();
    await expect(
      persistedRulesDialog.getByRole("button", { name: "编辑循环规则：每日整理收件箱" }),
    ).toHaveCount(0);
    await expect(
      persistedRulesDialog.getByText(/每周[一二三四五六日] 10:30 生成任务/),
    ).toBeVisible();
    await persistedRulesDialog
      .getByRole("button", { name: "停用循环规则：每周整理收件箱" })
      .click();
    await expect(
      persistedRulesDialog.getByRole("button", { name: "启用循环规则：每周整理收件箱" }),
    ).toBeVisible();
    await persistedRulesDialog
      .getByRole("button", { name: "删除循环规则：每周整理收件箱" })
      .click();
    const deleteDialog = page.getByRole("dialog", {
      name: "确认删除循环任务",
    });
    await expect(deleteDialog).toContainText(
      "已经生成的普通任务和专注记录会保留",
    );
    await deleteDialog.getByRole("button", { name: "删除循环任务" }).click();
    await expect(
      page
        .getByRole("dialog", { name: "管理循环规则" })
        .getByRole("button", { name: "编辑循环规则：每周整理收件箱" }),
    ).toHaveCount(0);
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

    await page.getByRole("searchbox", { name: "搜索任务" }).fill("设计");
    await expect(page.getByText("设计评审")).toBeVisible();
    await expect(page.getByText("代码重构")).not.toBeVisible();
  });

  test("shows focus capability through a colored title prefix", async ({ page }) => {
    await page.getByRole("button", { name: "添加专注任务" }).click();
    await page.getByPlaceholder("你现在要做什么？").fill("测试进行中任务");
    await page.getByRole("button", { name: "预计 4 个番茄" }).click();
    await page.getByRole("button", { name: "创建任务" }).click();

    const taskRow = page.locator("article").filter({ hasText: "测试进行中任务" }).first();
    await expect(taskRow).toHaveAttribute("data-task-kind", "focus");
    await expect(taskRow).toHaveAttribute("data-pomo-tone", "not-started");
    await expect(taskRow.getByText("专注：", { exact: true })).toBeVisible();
    await expect(taskRow.getByText("0/4", { exact: true })).toBeVisible();
    await expect(
      taskRow.getByRole("checkbox", { name: "完成专注任务：测试进行中任务" }),
    ).toBeVisible();
    await expect(
      taskRow.getByRole("button", { name: "开始专注：测试进行中任务" }),
    ).toBeVisible();
    await expect(taskRow.getByText("专注任务", { exact: true })).toHaveCount(0);

    await taskRow
      .getByRole("checkbox", { name: "完成专注任务：测试进行中任务" })
      .click();
    await expect(
      page.getByRole("dialog", { name: "完成任务复盘" }),
    ).toBeVisible();
    await page
      .getByRole("dialog", { name: "完成任务复盘" })
      .getByRole("button", { name: "取消" })
      .click();
  });

  test("keeps past completion reviews available when a focus task is reopened", async ({
    page,
  }) => {
    const title = "复查历史估时";
    await page.setViewportSize({ width: 320, height: 700 });
    await page.getByRole("button", { name: "添加专注任务" }).click();
    await page.getByPlaceholder("你现在要做什么？").fill(title);
    await page.getByRole("button", { name: "预计 1 个番茄" }).click();
    await page.getByRole("button", { name: "创建任务" }).click();

    await page
      .getByRole("checkbox", { name: `完成专注任务：${title}` })
      .click();
    const firstReview = page.getByRole("dialog", { name: "完成任务复盘" });
    await firstReview.getByLabel("本次复盘原因").fill("第一次资料比预期集中。");
    await firstReview.getByRole("button", { name: "保存完成记录" }).click();

    await page.getByRole("button", { name: "已完成（1）" }).click();
    await page
      .getByRole("checkbox", { name: `重新打开专注任务：${title}` })
      .click();
    await page
      .getByRole("checkbox", { name: `完成专注任务：${title}` })
      .click();

    const reopenedReview = page.getByRole("dialog", {
      name: "完成任务复盘",
    });
    await expect(reopenedReview.getByText("1 条")).toBeVisible();
    await expect(
      reopenedReview.getByText("第一次资料比预期集中。"),
    ).toBeVisible();
    await expect(
      reopenedReview.getByRole("button", { name: "保存完成记录" }),
    ).toBeVisible();

    const dialogBounds = await reopenedReview.boundingBox();
    expect(dialogBounds).not.toBeNull();
    expect(dialogBounds!.x).toBeGreaterThanOrEqual(0);
    expect(dialogBounds!.x + dialogBounds!.width).toBeLessThanOrEqual(320);
    expect(dialogBounds!.y + dialogBounds!.height).toBeLessThanOrEqual(700);
  });

  test("quick-adds, completes, and reopens a todo", async ({ page }) => {
    const title = "购买 E2E 测试用品";
    const input = page.getByRole("textbox", { name: "添加任务" });

    await input.fill(title);
    await input.press("Enter");
    const taskRow = page.locator("article").filter({ hasText: title }).first();
    await expect(taskRow).toBeVisible();

    const [taskBounds, inputBounds] = await Promise.all([
      taskRow.boundingBox(),
      input.boundingBox(),
    ]);
    expect(taskBounds).not.toBeNull();
    expect(inputBounds).not.toBeNull();
    expect(taskBounds!.y).toBeLessThan(inputBounds!.y);

    await page.getByRole("checkbox", { name: `完成待办：${title}` }).click();
    await page.getByRole("button", { name: "已完成（1）" }).click();
    await page.getByRole("checkbox", { name: `恢复待办：${title}` }).click();

    await expect(
      page.getByRole("checkbox", { name: `完成待办：${title}` }),
    ).toBeVisible();
  });

  test("edits a todo and filters it with the shared search", async ({ page }) => {
    const original = "购买旧名称";
    const updated = "购买人体工学键盘";

    const quickInput = page.getByRole("textbox", { name: "添加任务" });
    await quickInput.fill(original);
    await quickInput.press("Enter");
    const taskRow = page.locator("article").filter({ hasText: original }).first();
    await taskRow.hover();
    await taskRow.getByRole("button", { name: `编辑任务：${original}` }).click();
    await page.getByRole("textbox", { name: `编辑任务：${original}` }).fill(updated);
    await page.getByRole("button", { name: `保存任务名称：${original}` }).click();

    await page.getByRole("searchbox", { name: "搜索任务" }).fill("人体工学");
    await expect(page.getByText(updated)).toBeVisible();
    await expect(page.getByText(original)).not.toBeVisible();
  });

  test("converts a todo only after focus-task creation succeeds", async ({ page }) => {
    const title = "整理书桌并规划收纳";

    const quickInput = page.getByRole("textbox", { name: "添加任务" });
    await quickInput.fill(title);
    await quickInput.press("Enter");
    const taskRow = page.locator("article").filter({ hasText: title }).first();
    await taskRow.hover();
    await taskRow.getByRole("button", { name: `设为专注任务：${title}` }).click();

    const taskName = page.getByLabel("任务名称");
    await expect(taskName).toHaveValue(title);
    await page.getByRole("button", { name: "取消" }).click();
    await expect(page.getByRole("checkbox", { name: `完成待办：${title}` })).toBeVisible();

    await taskRow.hover();
    await taskRow.getByRole("button", { name: `设为专注任务：${title}` }).click();
    await page.getByRole("button", { name: "预计 1 个番茄" }).click();
    await page
      .getByRole("dialog", { name: "设为专注任务" })
      .getByRole("button", { name: "设为专注", exact: true })
      .click();

    await expect(page.getByRole("checkbox", { name: `完成待办：${title}` })).not.toBeVisible();
    await expect(page.locator("article").filter({ hasText: title }).first())
      .toHaveAttribute("data-task-kind", "focus");
  });

  test("uses the parent title as focus context for nested focus tasks", async ({ page }) => {
    const parent = "AI 生成 2D 游戏需求";
    const child = "检查任务地图";
    const quickInput = page.getByRole("textbox", { name: "添加任务" });

    await quickInput.fill(parent);
    await quickInput.press("Enter");
    const parentRow = page.locator("article").filter({ hasText: parent }).first();
    await parentRow.hover();
    await parentRow.getByRole("button", { name: `添加子任务：${parent}` }).click();
    const childInput = page.getByRole("textbox", { name: `添加子任务：${parent}` });
    await childInput.fill(child);
    await childInput.press("Enter");

    const childRow = page.locator("article").filter({ hasText: child }).first();
    await childRow.hover();
    await childRow.getByRole("button", { name: `设为专注任务：${child}` }).click();
    await page.getByRole("button", { name: "预计 2 个番茄" }).click();
    await page
      .getByRole("dialog", { name: "设为专注任务" })
      .getByRole("button", { name: "设为专注", exact: true })
      .click();

    await expect(parentRow).toHaveAttribute("data-task-kind", "group");
    await expect(parentRow).toHaveAttribute("data-pomo-tone", "not-started");
    await expect(parentRow.getByText("专注：", { exact: true })).toBeVisible();
    await expect(childRow.getByText("专注：", { exact: true })).toBeVisible();
  });

  test("converts a focus task back to a todo in place", async ({ page }) => {
    const title = "暂时不需要计时的任务";
    await page.getByRole("button", { name: "添加专注任务" }).click();
    await page.getByPlaceholder("你现在要做什么？").fill(title);
    await page.getByRole("button", { name: "预计 2 个番茄" }).click();
    await page.getByRole("button", { name: "创建任务" }).click();

    const taskRow = page.locator("article").filter({ hasText: title }).first();
    await taskRow.hover();
    await taskRow.getByRole("button", { name: `改为普通待办：${title}` }).click();

    await expect(taskRow).toHaveAttribute("data-task-kind", "todo");
    await expect(
      taskRow.getByRole("checkbox", { name: `完成待办：${title}` }),
    ).toBeVisible();
  });

  test("locks focus-to-todo conversion after a pomodoro is recorded", async ({ page }) => {
    const title = "已经开始投入的专注任务";
    await page.getByRole("button", { name: "添加专注任务" }).click();
    await page.getByPlaceholder("你现在要做什么？").fill(title);
    await page.getByRole("button", { name: "预计 2 个番茄" }).click();
    await page.getByRole("button", { name: "创建任务" }).click();

    await page.evaluate(async (taskName) => {
      const storeModulePath = "/src/features/tasks/use-task-store.ts";
      const { useTaskStore } = await import(
        /* @vite-ignore */ storeModulePath
      );
      const state = useTaskStore.getState();
      useTaskStore.setState({
        tasks: state.tasks.map((task) =>
          task.name === taskName
            ? { ...task, completed_pomos: 1 }
            : task,
        ),
      });
    }, title);

    const taskRow = page.locator("article").filter({ hasText: title }).first();
    await expect(taskRow.getByText("1/2", { exact: true })).toBeVisible();
    await taskRow.hover();
    await expect(
      taskRow.getByRole("button", { name: `改为普通待办：${title}` }),
    ).toHaveCount(0);
  });

  test("shows todo actions inline on mobile", async ({ page }) => {
    const title = "移动端待办操作";
    await page.setViewportSize({ width: 390, height: 844 });
    const quickInput = page.getByRole("textbox", { name: "添加任务" });
    await quickInput.fill(title);
    await quickInput.press("Enter");

    await page
      .getByRole("button", { name: `显示任务操作：${title}` })
      .click();
    const actions = page.getByRole("group", { name: `任务操作：${title}` });
    await expect(actions).toBeVisible();
    await expect(actions.getByRole("button", { name: `编辑任务：${title}` })).toBeVisible();
    await expect(
      actions.getByRole("button", { name: `设为专注任务：${title}` }),
    ).toBeVisible();
    await expect(actions.getByRole("button", { name: `删除任务：${title}` })).toBeVisible();
    await expect(page.getByRole("button", { name: `更多操作：${title}` })).toHaveCount(0);
  });

  test("keeps todos out of the timer task selector", async ({ page }) => {
    const title = "不应进入计时器的待办";
    const quickInput = page.getByRole("textbox", { name: "添加任务" });
    await quickInput.fill(title);
    await quickInput.press("Enter");
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
