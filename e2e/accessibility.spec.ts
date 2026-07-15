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

    const safeArea = sidebar.locator("[data-tauri-drag-region]").first();
    expect((await safeArea.boundingBox())?.height).toBeGreaterThanOrEqual(32);
  });

  test("selected task stays readable in light and dark themes", async ({ page }) => {
    await page.getByRole("link", { name: "任务" }).click();
    await page.getByRole("button", { name: "添加任务" }).click();
    await page.getByPlaceholder("你现在要做什么？").fill("选择态对比度任务");
    await page.getByRole("button", { name: "创建任务" }).click();
    await page.getByRole("button", { name: /^选择态对比度任务 0\/4 个番茄$/ }).click();
    await page.getByRole("link", { name: "计时" }).click();
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

  test("mobile task actions have names and can be cancelled with the keyboard", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await page.getByRole("navigation", { name: "移动端导航" }).getByRole("link", { name: "任务" }).click();
    await page.getByRole("button", { name: "添加任务" }).click();
    await page.getByPlaceholder("你现在要做什么？").fill("手机任务菜单测试");
    await page.getByRole("button", { name: "创建任务" }).click();

    const moreButton = page.getByRole("button", { name: "更多操作：手机任务菜单测试" });
    await expect(moreButton).toBeVisible();
    await moreButton.click();
    const menu = page.getByRole("dialog", { name: "任务操作：手机任务菜单测试" });
    await expect(menu).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menu).not.toBeVisible();
    await expect(moreButton).toBeFocused();
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
  });
});
