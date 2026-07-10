import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IdleActions } from "@/components/timer/idle-actions";
import { useTimerStore } from "@/features/timer/use-timer-store";
import {
  DEFAULT_LONG_BREAK_SEC,
  DEFAULT_SHORT_BREAK_SEC,
  DEFAULT_WORK_SEC,
} from "@/lib/constants";

const mockWorker = {
  postMessage: vi.fn(),
  terminate: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  onmessage: null as ((e: MessageEvent) => void) | null,
};

vi.mock("@/features/timer/use-timer-worker", () => ({
  createTimerWorker: vi.fn(() => mockWorker),
}));

vi.mock("@/features/timer/focus-music", () => ({
  playFocusMusic: vi.fn(),
  stopFocusMusic: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getTasks: vi.fn().mockResolvedValue([]),
  getCategory: vi.fn().mockResolvedValue(null),
  startSession: vi.fn().mockResolvedValue(1),
  finishSession: vi.fn().mockResolvedValue(undefined),
  updateSessionAttribution: vi.fn().mockResolvedValue(undefined),
  abandonSession: vi.fn().mockResolvedValue(undefined),
  incrementTaskPomos: vi.fn().mockResolvedValue(undefined),
  recordAppEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/notifications", () => ({
  playBreakOverSound: vi.fn(),
  prepareNotificationAudio: vi.fn(),
  stopBreakOverSound: vi.fn(),
  sendNotification: vi.fn(),
  canSendNotification: vi.fn().mockResolvedValue(true),
  playChime: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  useTimerStore.setState({
    phase: "short_break",
    status: "idle",
    secondsRemaining: DEFAULT_SHORT_BREAK_SEC,
    totalSeconds: DEFAULT_SHORT_BREAK_SEC,
    completedPomos: 1,
    activeTaskId: null,
    currentSessionId: null,
    currentSessionTaskId: null,
    selectedCategory: null,
    deadlineAtMs: null,
    pendingFocusReview: {
      sessionId: 12,
      durationSec: DEFAULT_WORK_SEC,
      ready: false,
    },
    breakReminderActive: false,
    durations: {
      work: DEFAULT_WORK_SEC,
      short: DEFAULT_SHORT_BREAK_SEC,
      long: DEFAULT_LONG_BREAK_SEC,
    },
  });
});

describe("IdleActions", () => {
  it("shows quick controls while a break is ready to start", () => {
    render(
      <IdleActions
        phase="short_break"
        secondsRemaining={DEFAULT_SHORT_BREAK_SEC}
        durations={{
          work: DEFAULT_WORK_SEC,
          short: DEFAULT_SHORT_BREAK_SEC,
          long: DEFAULT_LONG_BREAK_SEC,
        }}
        isFullscreenFocus={false}
        breakReminderActive={false}
      />,
    );

    expect(screen.getByRole("button", { name: "开始休息" })).toBeVisible();
    expect(screen.getByRole("button", { name: "延长 5 分钟" })).toBeVisible();
    expect(screen.getByRole("button", { name: "跳过休息" })).toBeVisible();
  });

  it("extends the pending break duration by five minutes", () => {
    render(
      <IdleActions
        phase="short_break"
        secondsRemaining={DEFAULT_SHORT_BREAK_SEC}
        durations={{
          work: DEFAULT_WORK_SEC,
          short: DEFAULT_SHORT_BREAK_SEC,
          long: DEFAULT_LONG_BREAK_SEC,
        }}
        isFullscreenFocus={false}
        breakReminderActive={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "延长 5 分钟" }));

    expect(useTimerStore.getState().secondsRemaining).toBe(
      DEFAULT_SHORT_BREAK_SEC + 300,
    );
    expect(useTimerStore.getState().durations.short).toBe(
      DEFAULT_SHORT_BREAK_SEC + 300,
    );
  });

  it("skips an idle break and keeps the focus review available", async () => {
    render(
      <IdleActions
        phase="short_break"
        secondsRemaining={DEFAULT_SHORT_BREAK_SEC}
        durations={{
          work: DEFAULT_WORK_SEC,
          short: DEFAULT_SHORT_BREAK_SEC,
          long: DEFAULT_LONG_BREAK_SEC,
        }}
        isFullscreenFocus={false}
        breakReminderActive={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "跳过休息" }));

    await waitFor(() => expect(useTimerStore.getState().phase).toBe("work"));
    expect(useTimerStore.getState().pendingFocusReview?.ready).toBe(true);
  });
});
