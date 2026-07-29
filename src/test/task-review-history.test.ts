import { describe, expect, it } from "vitest";
import {
  buildTaskReviewHistory,
  parseTaskOverrunHistory,
} from "@/features/tasks/task-review-history";
import { buildCompletionLogEntry } from "@/features/tasks/pomodoro-estimation-log";
import type { Task } from "@/features/tasks/task-types";

const task: Task = {
  id: 412,
  name: "写总结",
  item_type: "focus",
  estimated_pomos: 1,
  completed_pomos: 2,
  completion_review: null,
  notes:
    "**2026-07-29 16:05**\n\n**超额番茄路线复核**\n\n第 2 个番茄：超预期了，还得要一个番茄。",
  created_at: "2026-07-29 07:39:42",
  archived: 0,
};

describe("task review history", () => {
  it("combines legacy overrun notes and estimation log entries", () => {
    const rawEstimationLog = JSON.stringify({
      event: "completion",
      completedAt: "2026-07-29T08:30:38.497Z",
      taskName: "写总结",
      estimatedPomos: 1,
      actualPomos: 2,
      delta: 1,
      lesson: "实际比预估多 1 个番茄，后续类似任务应提高预估或提前拆分。",
    });

    const history = buildTaskReviewHistory({
      task,
      tasks: [task],
      completionReviews: [],
      rawEstimationLog,
    });

    expect(history).toHaveLength(2);
    expect(history[0]).toMatchObject({
      kind: "estimate",
      actual_pomos: 2,
      review: "实际比预估多 1 个番茄，后续类似任务应提高预估或提前拆分。",
    });
    expect(history[1]).toMatchObject({
      kind: "overrun",
      actual_pomos: 1,
      next_pomo: 2,
      review: "超预期了，还得要一个番茄。",
    });
  });

  it("ignores normal task notes and extracts every structured overrun review", () => {
    const taskWithMixedNotes: Task = {
      ...task,
      notes:
        "**2026-07-29 15:00**\n\n普通任务记录\n\n"
        + "**2026-07-29 16:05**\n\n**超额番茄路线复核**\n\n第 2 个番茄：先核对资料\n\n"
        + "**2026-07-29 16:40**\n\n**超额番茄路线复核**\n\n第 3 个番茄：完成最终校对",
    };

    expect(parseTaskOverrunHistory(taskWithMixedNotes)).toEqual([
      expect.objectContaining({
        next_pomo: 2,
        review: "先核对资料",
      }),
      expect.objectContaining({
        next_pomo: 3,
        review: "完成最终校对",
      }),
    ]);
  });

  it("deduplicates an estimation log written alongside a completion record", () => {
    const history = buildTaskReviewHistory({
      task: { ...task, notes: null },
      tasks: [task],
      completionReviews: [
        {
          id: 9,
          task_id: 412,
          estimated_pomos: 1,
          actual_pomos: 2,
          review: null,
          completed_at: "2026-07-29 16:30:38",
        },
      ],
      rawEstimationLog: JSON.stringify({
        event: "completion",
        completedAt: "2026-07-29T08:30:38.497Z",
        taskName: "写总结",
        estimatedPomos: 1,
        actualPomos: 2,
        delta: 1,
        lesson: "保留这条估时经验。",
      }),
    });

    expect(history).toEqual([
      expect.objectContaining({
        kind: "completion",
        review: "保留这条估时经验。",
      }),
    ]);
  });

  it("assigns an id-less legacy log to the newest matching task", () => {
    const olderTask = {
      ...task,
      id: 400,
      notes: null,
      created_at: "2026-07-28 07:00:00",
    };
    const newerTask = {
      ...task,
      id: 412,
      notes: null,
      created_at: "2026-07-29 07:39:42",
    };
    const rawEstimationLog = JSON.stringify({
      event: "completion",
      completedAt: "2026-07-29T08:30:38.497Z",
      taskName: "写总结",
      estimatedPomos: 1,
      actualPomos: 2,
      delta: 1,
      lesson: "属于新任务。",
    });

    expect(
      buildTaskReviewHistory({
        task: olderTask,
        tasks: [olderTask, newerTask],
        completionReviews: [],
        rawEstimationLog,
      }),
    ).toEqual([]);
    expect(
      buildTaskReviewHistory({
        task: newerTask,
        tasks: [olderTask, newerTask],
        completionReviews: [],
        rawEstimationLog,
      }),
    ).toHaveLength(1);
  });

  it("keeps note history visible when the estimation log is unavailable", () => {
    const history = buildTaskReviewHistory({
      task,
      tasks: [task],
      completionReviews: [],
      rawEstimationLog: null,
    });

    expect(history).toEqual([
      expect.objectContaining({
        kind: "overrun",
        review: "超预期了，还得要一个番茄。",
      }),
    ]);
  });

  it("writes task ids into future estimation completion logs", () => {
    expect(buildCompletionLogEntry(task)).toMatchObject({
      event: "completion",
      taskId: 412,
      taskName: "写总结",
    });
  });
});
