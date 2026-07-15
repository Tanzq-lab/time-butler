import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { TimerControls } from "@/components/containers/timer-controls";
import { useTimerStore } from "@/features/timer/use-timer-store";
import {
  DEFAULT_LONG_BREAK_SEC,
  DEFAULT_SHORT_BREAK_SEC,
  DEFAULT_WORK_SEC,
} from "@/lib/constants";

vi.mock("@/components/base/timer-display", () => ({
  TimerDisplay: () => <div data-testid="timer-display" />,
}));

vi.mock("@/components/intention-selector", () => ({
  IntentionSelector: () => <div data-testid="intention-selector" />,
}));

vi.mock("@/components/task-selector", () => ({
  TaskSelector: () => <div data-testid="task-selector" />,
}));

vi.mock("@/components/base/preset-selector", () => ({
  PresetSelector: () => <div data-testid="preset-selector" />,
}));

vi.mock("@/components/timer/idle-actions", () => ({
  IdleActions: () => <div data-testid="idle-actions" />,
  FullscreenButton: () => <button type="button">全屏</button>,
}));

vi.mock("@/components/timer/running-actions", () => ({
  RunningActions: ({ onFinish }: { onFinish: () => void }) => (
    <button type="button" onClick={onFinish}>
      完成
    </button>
  ),
}));

vi.mock("@/components/timer/fullscreen-task-label", () => ({
  FullscreenTaskLabel: () => <div data-testid="fullscreen-task-label" />,
}));

vi.mock("@/features/timer/focus-music", () => ({
  playFocusMusic: vi.fn(),
  stopFocusMusic: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getSetting: vi.fn().mockResolvedValue(null),
  setSetting: vi.fn().mockResolvedValue(undefined),
  getTasks: vi.fn().mockResolvedValue([]),
  getCategory: vi.fn().mockResolvedValue(null),
  addSession: vi.fn().mockResolvedValue(1),
  startSession: vi.fn().mockResolvedValue(1),
  finishSession: vi.fn().mockResolvedValue(undefined),
  updateSessionReflection: vi.fn().mockResolvedValue(undefined),
  abandonSession: vi.fn().mockResolvedValue(undefined),
  recordAppEvent: vi.fn().mockResolvedValue(undefined),
}));

beforeEach(() => {
  vi.clearAllMocks();
  useTimerStore.setState({
    phase: "work",
    status: "idle",
    secondsRemaining: DEFAULT_WORK_SEC,
    totalSeconds: DEFAULT_WORK_SEC,
    completedPomos: 1,
    activeTaskId: null,
    currentSessionId: null,
    selectedCategory: null,
    deadlineAtMs: null,
    breakReminderActive: false,
    pendingFocusReview: {
      sessionId: 9,
      durationSec: DEFAULT_WORK_SEC,
      ready: true,
    },
    durations: {
      work: DEFAULT_WORK_SEC,
      short: DEFAULT_SHORT_BREAK_SEC,
      long: DEFAULT_LONG_BREAK_SEC,
    },
  });
});

describe("TimerControls", () => {
  it("opens the submit-record modal when a break leaves a focus review ready", () => {
    render(<TimerControls />);

    expect(screen.getByText("这次专注有什么收获？")).toBeInTheDocument();
    expect(screen.getByText("25 分钟")).toBeInTheDocument();
  });

  it("keeps the pending focus review hidden while the break reminder awaits acknowledgement", () => {
    useTimerStore.setState({ breakReminderActive: true });

    render(<TimerControls />);

    expect(screen.queryByText("这次专注有什么收获？")).not.toBeInTheDocument();
    expect(screen.getByTestId("idle-actions")).toBeInTheDocument();
  });

  it("submits the ready focus review to the completed work session", async () => {
    render(<TimerControls />);

    fireEvent.change(
      screen.getByPlaceholderText("写下这次的收获、卡点或分心原因…"),
      {
        target: { value: "休息后补交，状态不错。" },
      },
    );
    fireEvent.click(screen.getByRole("button", { name: "提交记录" }));

    const { updateSessionReflection } = await import("@/lib/db");
    await waitFor(() =>
      expect(updateSessionReflection).toHaveBeenCalledWith(
        9,
        "neutral",
        "休息后补交，状态不错。",
      ),
    );
    expect(useTimerStore.getState().pendingFocusReview).toBeNull();
  });
});
