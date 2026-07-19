import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TaskOverrunReviewModal } from "@/components/base/task-overrun-review-modal";
import { useTimerStore } from "@/features/timer/use-timer-store";
import { useUIStore } from "@/features/ui/use-ui-store";
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
  onmessage: null as ((event: MessageEvent) => void) | null,
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
  startSession: vi.fn().mockResolvedValue(701),
  finishSession: vi.fn().mockResolvedValue(undefined),
  updateSessionAttribution: vi.fn().mockResolvedValue(undefined),
  updateSessionReflection: vi.fn().mockResolvedValue(undefined),
  abandonSession: vi.fn().mockResolvedValue(undefined),
  incrementTaskPomos: vi.fn().mockResolvedValue(undefined),
  appendTaskNote: vi.fn().mockResolvedValue(
    "**2026-07-19 09:00**\n\n**超额番茄路线复核**",
  ),
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
  useUIStore.setState({ isFullscreenFocus: false });
  useTimerStore.setState({
    phase: "work",
    status: "idle",
    secondsRemaining: DEFAULT_WORK_SEC,
    totalSeconds: DEFAULT_WORK_SEC,
    completedPomos: 4,
    activeTaskId: 42,
    currentSessionId: null,
    currentSessionTaskId: null,
    selectedCategory: null,
    deadlineAtMs: null,
    pendingFocusReview: null,
    pendingOverrunStart: {
      taskId: 42,
      taskName: "排查缓存问题",
      estimatedPomos: 4,
      completedPomos: 4,
      source: "timer_button",
      enterFullscreen: true,
    },
    breakReminderActive: false,
    durations: {
      work: DEFAULT_WORK_SEC,
      short: DEFAULT_SHORT_BREAK_SEC,
      long: DEFAULT_LONG_BREAK_SEC,
    },
  });
});

describe("TaskOverrunReviewModal", () => {
  it("explains the overrun and requires a concrete next goal", () => {
    render(<TaskOverrunReviewModal />);

    expect(
      screen.getByRole("dialog", { name: "超额番茄路线复核" }),
    ).toBeVisible();
    expect(screen.getByText("排查缓存问题")).toBeVisible();
    expect(screen.getByText(/你即将开始第 5 个番茄/)).toBeVisible();
    expect(
      screen.getByRole("button", { name: "记录下一步并开始" }),
    ).toBeDisabled();

    fireEvent.change(
      screen.getByLabelText("这一个番茄要验证或产出什么？"),
      { target: { value: "先验证清空缓存后能否复现" } },
    );

    expect(
      screen.getByRole("button", { name: "记录下一步并开始" }),
    ).toBeEnabled();
  });

  it("starts only after saving the goal and then enters fullscreen", async () => {
    render(<TaskOverrunReviewModal />);

    fireEvent.change(
      screen.getByLabelText("这一个番茄要验证或产出什么？"),
      { target: { value: "先验证清空缓存后能否复现" } },
    );
    fireEvent.click(
      screen.getByRole("button", { name: "记录下一步并开始" }),
    );

    const { appendTaskNote, startSession } = await import("@/lib/db");
    await waitFor(() =>
      expect(appendTaskNote).toHaveBeenCalledWith(
        42,
        "**超额番茄路线复核**\n\n第 5 个番茄：先验证清空缓存后能否复现",
      ),
    );
    await waitFor(() =>
      expect(startSession).toHaveBeenCalledWith(
        42,
        "work",
        undefined,
        undefined,
      ),
    );
    expect(useTimerStore.getState().pendingOverrunStart).toBeNull();
    expect(useTimerStore.getState().status).toBe("running");
    expect(useUIStore.getState().isFullscreenFocus).toBe(true);
  });

  it("leaves the timer idle when the user pauses instead", async () => {
    render(<TaskOverrunReviewModal />);

    fireEvent.click(screen.getByRole("button", { name: "先暂停，不继续" }));

    const { startSession, recordAppEvent } = await import("@/lib/db");
    expect(startSession).not.toHaveBeenCalled();
    expect(useTimerStore.getState().status).toBe("idle");
    expect(useTimerStore.getState().pendingOverrunStart).toBeNull();
    expect(recordAppEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "task_overrun_review_cancelled",
        entityId: 42,
      }),
    );
  });

  it("keeps the review open when the next goal cannot be saved", async () => {
    const { appendTaskNote, startSession } = await import("@/lib/db");
    vi.mocked(appendTaskNote).mockRejectedValueOnce(new Error("write failed"));
    render(<TaskOverrunReviewModal />);

    fireEvent.change(
      screen.getByLabelText("这一个番茄要验证或产出什么？"),
      { target: { value: "先验证最小路径" } },
    );
    fireEvent.click(
      screen.getByRole("button", { name: "记录下一步并开始" }),
    );

    expect(
      await screen.findByRole("alert"),
    ).toHaveTextContent("下一步保存失败，计时尚未开始，请再试一次。");
    expect(startSession).not.toHaveBeenCalled();
    expect(useTimerStore.getState().status).toBe("idle");
    expect(useTimerStore.getState().pendingOverrunStart).not.toBeNull();
  });
});
