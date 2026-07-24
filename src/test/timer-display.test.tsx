import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TimerDisplay } from "@/components/base/timer-display";
import { getTaskPomoProgressVisual } from "@/lib/task-pomo-progress";

describe("TimerDisplay task pomodoro progress", () => {
  it("uses energetic green for the first pomodoro", () => {
    render(
      <TimerDisplay
        secondsRemaining={1200}
        totalSeconds={1500}
        phase="work"
        taskPomoProgress={getTaskPomoProgressVisual(0, 1, true)}
      />,
    );

    expect(screen.getByLabelText("任务进度：第 1 个番茄，预计 1 个番茄")).toBeVisible();
    expect(screen.getByText(/第/)).toHaveTextContent("第 1 个番茄·预计 1 个");
    expect(
      document.querySelectorAll(".timer-task-progress-ring"),
    ).toHaveLength(2);
    expect(document.querySelector(".timer-task-pomo-start")).toBeVisible();
    expect(document.querySelectorAll("linearGradient")).toHaveLength(0);
  });

  it("uses the same red tone for a pomodoro beyond the estimate", () => {
    render(
      <TimerDisplay
        secondsRemaining={1200}
        totalSeconds={1500}
        phase="work"
        taskPomoProgress={getTaskPomoProgressVisual(1, 1, true)}
      />,
    );

    expect(
      screen.getByLabelText(
        "任务进度：第 2 个番茄，预计 1 个番茄，超出预计中",
      ),
    ).toBeVisible();
    expect(screen.getByText("超出预计中")).toHaveClass(
      "timer-task-budget-danger",
    );
    expect(
      document.querySelectorAll(".timer-task-progress-ring"),
    ).toHaveLength(2);
    expect(document.querySelector(".timer-task-pomo-overrun")).toBeVisible();
  });

  it("uses a distinct solid color for each position in a four-pomodoro budget", () => {
    const { rerender } = render(
      <TimerDisplay
        secondsRemaining={1200}
        totalSeconds={1500}
        phase="work"
        taskPomoProgress={getTaskPomoProgressVisual(0, 4, true)}
      />,
    );

    for (const [completedPomos, tone] of [
      [0, "start"],
      [1, "progress"],
      [2, "caution"],
      [3, "limit"],
    ] as const) {
      rerender(
        <TimerDisplay
          secondsRemaining={1200}
          totalSeconds={1500}
          phase="work"
          taskPomoProgress={getTaskPomoProgressVisual(
            completedPomos,
            4,
            true,
          )}
        />,
      );
      expect(document.querySelector(`.timer-task-pomo-${tone}`)).toBeVisible();
      expect(document.querySelectorAll("linearGradient")).toHaveLength(0);
    }
  });

  it("reports completed overrun separately when no pomodoro is active", () => {
    render(
      <TimerDisplay
        secondsRemaining={1500}
        totalSeconds={1500}
        phase="work"
        editable
        taskPomoProgress={getTaskPomoProgressVisual(2, 1)}
      />,
    );

    expect(
      screen.getByLabelText(
        "任务进度：已完成 2/1 个番茄，已超 1 个番茄",
      ),
    ).toBeVisible();
    expect(screen.getByText(/已完成/)).toHaveTextContent(
      "已完成 2/1 个番茄· 已超 1 个",
    );
    expect(screen.getByText(/已超 1 个/)).toHaveClass(
      "timer-task-budget-danger",
    );
  });

  it("keeps the pomodoro ring color when the countdown reaches zero", () => {
    render(
      <TimerDisplay
        secondsRemaining={0}
        totalSeconds={1500}
        phase="work"
        taskPomoProgress={getTaskPomoProgressVisual(3, 4, true)}
      />,
    );

    expect(
      document.querySelectorAll(".timer-task-progress-ring"),
    ).toHaveLength(2);
    expect(document.querySelector(".timer-task-pomo-limit")).toBeVisible();
    expect(document.querySelectorAll(".timer-complete-ring")).toHaveLength(0);
    expect(document.querySelector(".timer-complete-text")).toBeVisible();
  });

  it("keeps break rings neutral and hides the task budget signal", () => {
    render(
      <TimerDisplay
        secondsRemaining={240}
        totalSeconds={300}
        phase="short_break"
        taskPomoProgress={getTaskPomoProgressVisual(5, 4, true)}
      />,
    );

    expect(screen.queryByLabelText(/任务进度/)).not.toBeInTheDocument();
    expect(document.querySelectorAll(".timer-task-overrun-ring")).toHaveLength(0);
  });
});
