import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TimerDisplay } from "@/components/base/timer-display";
import { getTaskPomoProgressVisual } from "@/lib/task-pomo-progress";

describe("TimerDisplay task pomodoro progress", () => {
  it("shows task-budget progress as a single neutral ring during focus", () => {
    render(
      <TimerDisplay
        secondsRemaining={1200}
        totalSeconds={1500}
        phase="work"
        taskPomoProgress={getTaskPomoProgressVisual(0, 4)}
      />,
    );

    expect(
      screen.getByLabelText("任务预算：0/4 个番茄"),
    ).toBeVisible();
    expect(document.querySelectorAll(".timer-task-progress-ring")).toHaveLength(2);
    expect(document.querySelector(".timer-task-progress-neutral")).toBeVisible();
    expect(document.querySelectorAll("linearGradient")).toHaveLength(0);
  });

  it("uses a danger tone without a glow after the task exceeds its estimate", () => {
    render(
      <TimerDisplay
        secondsRemaining={1200}
        totalSeconds={1500}
        phase="work"
        taskPomoProgress={getTaskPomoProgressVisual(5, 4)}
      />,
    );

    expect(screen.getByText("· 已超 1 个")).toBeVisible();
    expect(document.querySelector(".timer-task-progress-danger")).toBeVisible();
    expect(document.querySelectorAll(".timer-task-progress-ring")).toHaveLength(2);
    expect(document.querySelectorAll(".timer-task-overrun-ring")).toHaveLength(0);
  });

  it("uses the completion colour when the countdown reaches zero", () => {
    render(
      <TimerDisplay
        secondsRemaining={0}
        totalSeconds={1500}
        phase="work"
        taskPomoProgress={getTaskPomoProgressVisual(3, 4)}
      />,
    );

    expect(document.querySelectorAll(".timer-complete-ring")).toHaveLength(2);
    expect(document.querySelector(".timer-complete-text")).toBeVisible();
  });

  it("keeps break rings neutral and hides the task budget signal", () => {
    render(
      <TimerDisplay
        secondsRemaining={240}
        totalSeconds={300}
        phase="short_break"
        taskPomoProgress={getTaskPomoProgressVisual(5, 4)}
      />,
    );

    expect(screen.queryByLabelText(/任务进度/)).not.toBeInTheDocument();
    expect(document.querySelectorAll(".timer-task-overrun-ring")).toHaveLength(0);
  });
});
