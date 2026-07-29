import { test, expect } from "./helpers";

async function contrastRatio(locator: import("@playwright/test").Locator) {
  return locator.evaluate((element) => {
    const parseRgb = (value: string) => {
      const channels = value.match(/[\d.]+/g)?.slice(0, 3).map(Number) ?? [0, 0, 0];
      return channels.map((channel) => {
        const normalized = channel / 255;
        return normalized <= 0.03928
          ? normalized / 12.92
          : ((normalized + 0.055) / 1.055) ** 2.4;
      });
    };
    const luminance = (rgb: number[]) =>
      0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
    const style = getComputedStyle(element);
    const foreground = luminance(parseRgb(style.color));
    const background = luminance(parseRgb(style.backgroundColor));
    return {
      color: style.color,
      backgroundColor: style.backgroundColor,
      className: element.className,
      ratio: (Math.max(foreground, background) + 0.05) /
        (Math.min(foreground, background) + 0.05),
    };
  });
}

test.describe("Responsive and accessibility", () => {
  test("all pages stay inside the supported viewport matrix", async ({ page }) => {
    const viewports = [
      { width: 1280, height: 720 },
      { width: 1268, height: 768 },
      { width: 1024, height: 768 },
      { width: 768, height: 700 },
      { width: 390, height: 844 },
      { width: 320, height: 700 },
    ];
    const routes = ["/", "/tasks", "/notes", "/calendar", "/analytics", "/settings", "/onboarding"];

    for (const viewport of viewports) {
        await page.setViewportSize(viewport);
      for (const route of routes) {
        await page.goto(`/#${route}`);
        await expect(page).toHaveURL(new RegExp(`#${route === "/" ? "/$" : route}`));
        const pageMain = route === "/onboarding"
          ? page.getByRole("main")
          : page.locator("#main-content");
        await expect(pageMain).toBeVisible();

        const overflow = await page.evaluate(() => {
          const root = document.documentElement;
          const main = document.querySelector<HTMLElement>("#main-content")
            ?? document.querySelector<HTMLElement>("main");
          return {
            documentOverflow: root.scrollWidth - root.clientWidth,
            mainOverflow: main ? main.scrollWidth - main.clientWidth : 0,
          };
        });
        expect(overflow.documentOverflow, `${viewport.width}×${viewport.height} ${route}`).toBeLessThanOrEqual(1);
        expect(overflow.mainOverflow, `${viewport.width}×${viewport.height} ${route}`).toBeLessThanOrEqual(1);
      }
    }
  });

  test("mobile layout has no horizontal page overflow", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await page.reload();

    await expect(page.getByRole("navigation", { name: "移动端导航" })).toBeVisible();
    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(dimensions.scrollWidth).toBe(dimensions.clientWidth);

    const clippedControls = await page.locator("button, a, input, select, textarea").evaluateAll((elements) =>
      elements.filter((element) => {
        const style = getComputedStyle(element);
        if (style.display === "none" || style.visibility === "hidden") return false;
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && (rect.left < -1 || rect.right > window.innerWidth + 1);
      }).length,
    );
    expect(clippedControls).toBe(0);
  });

  test("recurring task dialog stays operable at the minimum window size", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await page.getByRole("link", { name: "任务" }).click();
    await page.getByRole("button", { name: "添加循环任务" }).click();

    const dialog = page.getByRole("dialog", { name: "添加循环任务" });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("任务名称").fill("每日整理最小窗口");
    const bounds = await dialog.boundingBox();
    expect(bounds?.x ?? -1).toBeGreaterThanOrEqual(0);
    expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThanOrEqual(320);

    const overflow = await dialog.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(overflow.scrollWidth).toBe(overflow.clientWidth);

    await dialog.getByRole("button", { name: /编辑模板子任务/ }).click();
    const subtasksDialog = page.getByRole("dialog", {
      name: "设置模板子任务",
    });
    await subtasksDialog.getByLabel("新增模板子任务").fill("准备每日材料");
    await subtasksDialog.getByRole("button", { name: "添加" }).click();
    const subtaskOverflow = await subtasksDialog.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(subtaskOverflow.scrollWidth).toBe(subtaskOverflow.clientWidth);
    await subtasksDialog
      .getByRole("button", { name: "完成子任务设置" })
      .click();

    const scheduleButton = dialog.getByRole("button", {
      name: /编辑循环设置/,
    });
    await scheduleButton.click();
    const scheduleDialog = page.getByRole("dialog", {
      name: "设置循环时间",
    });
    await expect(scheduleDialog).toBeVisible();
    await page.keyboard.press("Escape");

    const returnedDialog = page.getByRole("dialog", {
      name: "添加循环任务",
    });
    await expect(returnedDialog).toBeVisible();
    await expect(
      returnedDialog.getByRole("button", { name: /编辑循环设置/ }),
    ).toBeFocused();

    const createButton = returnedDialog.getByRole("button", {
      name: "创建循环任务",
    });
    await expect(createButton).toBeVisible();
    await createButton.click();

    await page.getByRole("button", { name: "添加循环任务" }).click();
    const reopenedDialog = page.getByRole("dialog", {
      name: "添加循环任务",
    });
    await reopenedDialog.getByRole("button", { name: /管理已配置规则/ }).click();
    const rulesDialog = page.getByRole("dialog", { name: "管理循环规则" });
    const deleteRuleButton = rulesDialog.getByRole("button", {
      name: "删除循环规则：每日整理最小窗口",
    });
    await expect(deleteRuleButton).toBeVisible();
    const clippedRuleControls = await rulesDialog
      .locator("button")
      .evaluateAll((elements) =>
        elements.filter((element) => {
          const rect = element.getBoundingClientRect();
          return (
            rect.width > 0
            && (rect.left < -1 || rect.right > window.innerWidth + 1)
          );
        }).length,
      );
    expect(clippedRuleControls).toBe(0);

    await deleteRuleButton.click();
    const deleteDialog = page.getByRole("dialog", {
      name: "确认删除循环任务",
    });
    const deleteBounds = await deleteDialog.boundingBox();
    expect(deleteBounds?.x ?? -1).toBeGreaterThanOrEqual(0);
    expect(
      (deleteBounds?.x ?? 0) + (deleteBounds?.width ?? 0),
    ).toBeLessThanOrEqual(320);
    await deleteDialog.getByRole("button", { name: "取消" }).click();
    await expect(
      page.getByRole("dialog", { name: "管理循环规则" }),
    ).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("dialog", { name: "添加循环任务" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("dialog", { name: "添加循环任务" }),
    ).not.toBeVisible();
    await expect(page.getByRole("button", { name: "添加循环任务" })).toBeFocused();
  });

  test("mobile navigation keeps five items and exposes secondary pages through More", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await page.reload();

    const navigation = page.getByRole("navigation", { name: "移动端导航" });
    await expect(navigation.locator("a, button")).toHaveCount(5);
    await expect(navigation.getByRole("link", { name: "计时" })).toBeVisible();
    await expect(navigation.getByRole("link", { name: "任务" })).toBeVisible();
    await expect(navigation.getByRole("link", { name: "记录" })).toBeVisible();
    await expect(navigation.getByRole("link", { name: "日历" })).toBeVisible();

    await navigation.getByRole("button", { name: "更多导航" }).click();
    const more = page.getByRole("dialog", { name: "更多导航" });
    await expect(more.getByRole("link", { name: /分析/ })).toBeVisible();
    await expect(more.getByRole("link", { name: /设置/ })).toBeVisible();
    await expect(more.getByRole("link", { name: /帮助/ })).toBeVisible();

    await more.getByRole("link", { name: /设置/ }).click();
    await expect(page).toHaveURL(/\/#\/settings/);
    await expect(navigation.getByRole("button", { name: "更多导航" })).toHaveAttribute("aria-current", "page");
  });

  test("tablet uses the compact sidebar and preserves the macOS titlebar safe area", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 700 });
    await page.reload();

    const sidebar = page.locator("aside").first();
    await expect(sidebar).toBeVisible();
    expect((await sidebar.boundingBox())?.width).toBe(64);

    const expandButton = sidebar.getByRole("button", { name: "展开侧边栏" });
    await expect(expandButton).toHaveAttribute("aria-expanded", "false");
    await expect(expandButton.locator("svg")).toHaveClass(/lucide-chevrons-right/);
    const toggleBounds = await expandButton.boundingBox();
    expect(toggleBounds?.width).toBeGreaterThanOrEqual(32);
    expect(toggleBounds?.height).toBeGreaterThanOrEqual(32);

    await expandButton.hover();
    await expect(expandButton.locator('[role="tooltip"]')).toBeVisible();

    await expandButton.click();
    expect((await sidebar.boundingBox())?.width).toBe(224);
    const collapseButton = sidebar.getByRole("button", { name: "收起侧边栏" });
    await expect(collapseButton).toHaveAttribute("aria-expanded", "true");
    await expect(collapseButton.locator("svg")).toHaveClass(/lucide-chevrons-left/);

    const safeArea = sidebar.locator("[data-tauri-drag-region]").first();
    expect((await safeArea.boundingBox())?.height).toBeGreaterThanOrEqual(32);
  });

  test("active focus moves from the floating player into the desktop sidebar", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.getByRole("link", { name: "任务" }).click();
    await page.getByRole("button", { name: "添加专注任务" }).click();
    await page.getByPlaceholder("你现在要做什么？").fill("跨页面专注状态测试");
    await page.getByRole("button", { name: "预计 4 个番茄" }).click();
    await page.getByRole("button", { name: "创建任务" }).click();
    await page
      .getByRole("button", { name: "开始专注：跨页面专注状态测试" })
      .click();

    await page
      .locator("#main-content")
      .getByRole("button", { name: "开始专注", exact: true })
      .click();
    await expect(page).toHaveURL(/\/#\/$/);
    await page.getByRole("button", { name: "退出专注模式" }).first().click();
    await page.getByRole("link", { name: "任务" }).click();

    const runningCard = page.locator("article").filter({
      hasText: "跨页面专注状态测试",
    });
    await expect(
      runningCard.getByRole("button", { name: "回到专注：跨页面专注状态测试" }),
    ).toBeVisible();
    await expect(runningCard.getByLabel("专注进行中")).toBeVisible();

    const sidebarStatus = page.getByRole("region", { name: "当前专注状态" });
    await expect(sidebarStatus.getByText("跨页面专注状态测试")).toBeVisible();
    await expect(sidebarStatus.getByRole("timer")).toHaveText(/\d{2}:\d{2}/);
    await expect(sidebarStatus.getByRole("button", { name: "暂停专注" })).toBeVisible();
    await expect(page.getByRole("button", { name: "缩小计时横条" })).toHaveCount(0);

    await sidebarStatus.getByRole("button", { name: "暂停专注" }).click();
    await expect(sidebarStatus.getByRole("button", { name: "继续专注" })).toBeVisible();
    await expect(runningCard.getByLabel("专注已暂停")).toBeVisible();
    await expect(page).toHaveURL(/\/#\/tasks/);
  });

  test("selected task stays readable in light and dark themes", async ({ page }) => {
    await page.getByRole("link", { name: "任务" }).click();
    await page.getByRole("button", { name: "添加专注任务" }).click();
    await page.getByPlaceholder("你现在要做什么？").fill("选择态对比度任务");
    await page.getByRole("button", { name: "预计 4 个番茄" }).click();
    await page.getByRole("button", { name: "创建任务" }).click();
    await page.getByRole("button", {
      name: "开始专注：选择态对比度任务",
    }).click();
    await expect(page).toHaveURL(/\/#\/$/);
    await expect(page.getByRole("textbox", { name: "设置计时时长" })).toBeVisible();

    const selectedTask = page.locator('button[aria-pressed="true"]').filter({ hasText: "选择态对比度任务" });
    await expect(selectedTask).toBeVisible();
    const lightContrast = await contrastRatio(selectedTask);
    expect(lightContrast.ratio, JSON.stringify(lightContrast)).toBeGreaterThanOrEqual(4.5);

    await page.getByRole("link", { name: "设置" }).click();
    await expect(page).toHaveURL(/\/#\/settings/);
    await page.getByRole("button", { name: "深色" }).click();
    await page.getByRole("link", { name: "计时" }).click();
    await expect(page).toHaveURL(/\/#\/$/);
    await expect(selectedTask).toBeVisible();
    const darkContrast = await contrastRatio(selectedTask);
    expect(darkContrast.ratio, JSON.stringify(darkContrast)).toBeGreaterThanOrEqual(4.5);
  });

  test("mobile records opens the page tree as a dismissible drawer", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await page.getByRole("navigation", { name: "移动端导航" }).getByRole("link", { name: "记录" }).click();

    await expect(page.getByRole("textbox", { name: "记录内容" })).toBeVisible();
    await expect(page.locator("#main-content aside")).toBeHidden();
    await page.getByRole("button", { name: "页面", exact: true }).click();
    const drawer = page.getByRole("dialog", { name: "选择记录页面" });
    await expect(drawer).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(drawer).not.toBeVisible();
  });

  test("mobile task actions have names and support keyboard activation", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await page.reload();
    await page.getByRole("navigation", { name: "移动端导航" }).getByRole("link", { name: "任务" }).click();
    await page.getByRole("button", { name: "添加专注任务" }).click();
    await page.getByPlaceholder("你现在要做什么？").fill("手机任务操作测试");
    await page.getByRole("button", { name: "预计 1 个番茄" }).click();
    await page.getByRole("button", { name: "创建任务" }).click();

    await page
      .getByRole("button", { name: "显示任务操作：手机任务操作测试" })
      .click();
    const actions = page.getByRole("group", { name: "任务操作：手机任务操作测试" });
    await expect(actions).toBeVisible();
    const actionOverflow = await actions.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(actionOverflow.scrollWidth).toBe(actionOverflow.clientWidth);
    const recordButton = actions.getByRole("button", {
      name: "记录任务：手机任务操作测试",
    });
    await recordButton.focus();
    await page.keyboard.press("Enter");
    const recordDialog = page.getByRole("dialog", { name: "记录任务" });
    await expect(recordDialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(recordDialog).not.toBeVisible();
    await expect(recordButton).toBeFocused();
    await expect(
      page.getByRole("button", { name: "更多操作：手机任务操作测试" }),
    ).toHaveCount(0);
  });

  test("reduced-motion preference minimizes transitions and animations", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.reload();

    const motion = await page
      .locator("#main-content")
      .getByRole("button", { name: "开始专注" })
      .evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          animationDuration: style.animationDuration,
          transitionDuration: style.transitionDuration,
        };
      });

    expect(motion.animationDuration).toBe("1e-05s");
    expect(motion.transitionDuration).toBe("1e-05s");
  });

  test("dark theme applies the semantic canvas and can return to light", async ({ page }) => {
    await page.getByRole("link", { name: "设置" }).click();
    await page.getByRole("button", { name: "深色" }).click();

    await expect(page.locator("html")).toHaveClass(/dark/);
    await expect
      .poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor))
      .toBe("rgb(25, 25, 25)");

    await page.getByRole("button", { name: "浅色" }).click();
    await expect(page.locator("html")).not.toHaveClass(/dark/);
  });

  test("desktop calendar timeline can scroll to later hours", async ({ page }) => {
    await page.setViewportSize({ width: 1128, height: 742 });
    await page.goto("/#/calendar");
    await expect(page.getByRole("heading", { name: "每周时间线" })).toBeVisible();

    const timeline = page.getByRole("region", { name: "日历时间轴" });
    await expect(timeline).toBeVisible();
    const dimensions = await timeline.evaluate((element) => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
    }));
    expect(dimensions.scrollHeight).toBeGreaterThan(dimensions.clientHeight);

    await timeline.hover();
    await page.mouse.wheel(0, 640);
    await expect.poll(() => timeline.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);

    await page.mouse.wheel(0, 2_000);
    await expect(timeline.getByText("22:00", { exact: true })).toBeInViewport();

    const savedScrollTop = await timeline.evaluate((element) => element.scrollTop);
    await page.getByRole("link", { name: "任务" }).click();
    await page.getByRole("link", { name: "日历" }).click();

    const restoredTimeline = page.getByRole("region", { name: "日历时间轴" });
    await expect(restoredTimeline).toBeVisible();
    await expect
      .poll(() => restoredTimeline.evaluate((element) => element.scrollTop))
      .toBe(savedScrollTop);
  });

  test("page navigation restores the previous working position", async ({ page }) => {
    await page.setViewportSize({ width: 1128, height: 742 });
    await page.goto("/#/tasks");
    const main = page.locator("#main-content");

    await main.evaluate((element) => {
      const spacer = document.createElement("div");
      spacer.dataset.scrollMemoryTest = "true";
      spacer.style.height = "1600px";
      element.append(spacer);
      element.scrollTop = 520;
      element.dispatchEvent(new Event("scroll"));
    });
    await expect.poll(() => main.evaluate((element) => element.scrollTop)).toBe(520);

    await page.getByRole("link", { name: "计时" }).click();
    await page.getByRole("link", { name: "任务" }).click();
    await expect(page.getByRole("heading", { name: "我的任务" })).toBeVisible();

    const restoredMain = page.locator("#main-content");
    await restoredMain.evaluate((element) => {
      const spacer = document.createElement("div");
      spacer.dataset.scrollMemoryTest = "true";
      spacer.style.height = "1600px";
      element.append(spacer);
    });
    await expect
      .poll(() => restoredMain.evaluate((element) => element.scrollTop))
      .toBe(520);
  });
});
