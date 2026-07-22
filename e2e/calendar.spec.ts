import { test, expect } from "./helpers";

test.describe("Calendar other-time records", () => {
  test("drags a time range, saves its meaning, edits it, and deletes it", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/#/calendar");
    await expect(page.getByRole("heading", { name: "每周时间线" })).toBeVisible();

    const todayKey = await page.evaluate(() => {
      const date = new Date();
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    });
    const day = page.getByTestId(`calendar-day-${todayKey}`);
    await expect(day).toBeAttached();

    const timeline = page.getByRole("region", { name: "日历时间轴" });
    await timeline.evaluate((element) => { element.scrollTop = 300; });

    const box = await day.boundingBox();
    expect(box).not.toBeNull();
    const x = box!.x + box!.width / 2;
    const startY = box!.y + 4 * 96;
    const endY = box!.y + 5 * 96;
    await page.mouse.move(x, startY);
    await page.mouse.down();
    await page.mouse.move(x, endY, { steps: 4 });
    await expect(page.getByRole("status", { name: "已选择 10:00 – 11:00" })).toBeVisible();
    await page.mouse.up();

    const editor = page.getByRole("dialog", { name: "添加时间记录" });
    await expect(editor).toBeVisible();
    await expect(editor.getByLabel("开始")).toHaveValue("10:00");
    await expect(editor.getByLabel("结束")).toHaveValue("11:00");
    await editor.getByLabel("结束").fill("11:10");
    await editor.getByLabel("内容").fill("产品周会");
    await editor.getByLabel(/备注/).fill("确认下一轮实验");
    await editor.getByRole("button", { name: "保存时间" }).click();

    const block = page.getByRole("button", { name: /编辑时间：产品周会，10:00 – 11:10/ });
    await expect(block).toBeVisible();
    await expect(page.getByText("1 项 · 1小时10分钟")).toBeVisible();

    await block.click();
    const editDialog = page.getByRole("dialog", { name: "编辑时间记录" });
    await editDialog.getByLabel("内容").fill("团队周会");
    await editDialog.getByRole("button", { name: "保存时间" }).click();
    await expect(page.getByRole("button", { name: /编辑时间：团队周会，10:00 – 11:10/ })).toBeVisible();

    await page.getByRole("button", { name: /编辑时间：团队周会，10:00 – 11:10/ }).click();
    await page.getByRole("button", { name: "删除记录" }).click();
    const confirm = page.getByRole("dialog", { name: "删除这段时间？" });
    await expect(confirm).toBeVisible();
    await confirm.getByRole("button", { name: "删除时间" }).click();
    await expect(page.getByRole("button", { name: /编辑时间：团队周会/ })).not.toBeVisible();
  });

  test("mobile keeps an explicit add-time path instead of hijacking timeline scrolling", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto("/#/calendar");

    const addButton = page.getByRole("button", { name: "添加时间" });
    await expect(addButton).toBeVisible();
    await addButton.click();
    await expect(page.getByRole("dialog", { name: "添加时间记录" })).toBeVisible();
  });
});
