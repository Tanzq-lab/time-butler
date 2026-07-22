import { describe, expect, it } from "vitest";
import { parseTaskDraft } from "@/features/tasks/task-intake";

describe("parseTaskDraft", () => {
  it("estimates quick email replies as one pomo without breakdown", () => {
    const draft = parseTaskDraft("加任务：快速回复 OpenAI 客服邮件。");

    expect(draft.name).toBe("快速回复 OpenAI 客服邮件");
    expect(draft.estimatedPomos).toBe(1);
    expect(draft.needsBreakdown).toBe(false);
  });

  it("estimates Dalian travel research as two or three pomos with a reason", () => {
    const draft = parseTaskDraft("加任务：整理大连旅行攻略资料。");

    expect([2, 3]).toContain(draft.estimatedPomos);
    expect(draft.needsBreakdown).toBe(false);
    expect(draft.estimationReason).toContain("旅行攻略整理");
  });

  it("classifies memorization tasks as memory review", () => {
    const draft = parseTaskDraft("加任务：背诵：赛车 UGC 的产品内核是什么？");

    expect(draft.categoryName).toBe("记忆复习");
  });

  it("classifies interview answers as writing output", () => {
    const draft = parseTaskDraft("加任务：回答面试题：UGC 业务最难的地方在哪里？");

    expect(draft.categoryName).toBe("写作输出");
  });

  it.each([
    "优化问题：讲讲你做功能时的决策方法",
    "优化题目：赛车 UGC 执行中最大的难题是什么？",
  ])("classifies interview-question refinements as writing output: %s", (name) => {
    expect(parseTaskDraft(name).categoryName).toBe("写作输出");
  });

  it("requires breakdown for complete Codex task intake implementation", () => {
    const draft = parseTaskDraft(
      "加任务：完整实现 Codex 自然语言加任务入口、番茄预估、任务分解提醒、备忘录和日志机制。",
    );

    expect(draft.estimatedPomos).toBeGreaterThan(4);
    expect(draft.needsBreakdown).toBe(true);
    expect(draft.breakdownReason).toContain("超过 4 个番茄");
    expect(draft.suggestedSubtasks?.length).toBeGreaterThan(1);
  });
});
