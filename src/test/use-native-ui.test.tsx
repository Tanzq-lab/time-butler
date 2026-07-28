import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useNativeUI } from "@/features/system/use-native-ui";
import { useTaskStore } from "@/features/tasks/use-task-store";
import { useTimerStore } from "@/features/timer/use-timer-store";

const tauriMocks = vi.hoisted(() => ({
  invoke: vi.fn().mockResolvedValue(undefined),
  isTauri: vi.fn(() => false),
  invokeTimerScheduleDeadline: vi.fn().mockResolvedValue(undefined),
  invokeTimerCancelDeadline: vi.fn().mockResolvedValue(undefined),
  invokeTimerSetMenubarFocusTitle: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: tauriMocks.invoke,
}));

vi.mock("@/lib/tauri", () => ({
  isTauri: tauriMocks.isTauri,
  invokeTimerScheduleDeadline: tauriMocks.invokeTimerScheduleDeadline,
  invokeTimerCancelDeadline: tauriMocks.invokeTimerCancelDeadline,
  invokeTimerSetMenubarFocusTitle: tauriMocks.invokeTimerSetMenubarFocusTitle,
}));

describe("useNativeUI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tauriMocks.isTauri.mockReturnValue(true);
    useTaskStore.setState({
      tasks: [{
        id: 42,
        name: "梳理 AI 生成 2D 游戏需求原点",
        item_type: "focus",
        estimated_pomos: 2,
        completed_pomos: 0,
        created_at: "2026-07-28T00:00:00.000Z",
        archived: 0,
      }],
    });
    useTimerStore.setState({
      phase: "work",
      status: "idle",
      secondsRemaining: 25 * 60,
      totalSeconds: 25 * 60,
      activeTaskId: 42,
      currentSessionTaskId: null,
    });
  });

  it("shows the focus task title instead of a countdown during work", async () => {
    useTimerStore.setState({
      status: "running",
      currentSessionTaskId: 42,
    });

    renderHook(() => useNativeUI());

    await waitFor(() => {
      expect(tauriMocks.invokeTimerSetMenubarFocusTitle).toHaveBeenCalledWith(
        "梳理 AI 生成 2D 游戏需求原点",
      );
    });
    expect(tauriMocks.invoke).toHaveBeenCalledWith("menubar_show");
    expect(tauriMocks.invoke).not.toHaveBeenCalledWith(
      "menubar_set_title",
      expect.anything(),
    );
    expect(tauriMocks.invoke).toHaveBeenCalledWith("menubar_set_tooltip", {
      tooltip: "Time-butler - 专注：梳理 AI 生成 2D 游戏需求原点",
    });
  });

  it("shows the countdown and clears the focus title during a break", async () => {
    useTimerStore.setState({
      phase: "short_break",
      status: "running",
      secondsRemaining: 221,
      totalSeconds: 5 * 60,
      activeTaskId: null,
      currentSessionTaskId: null,
    });

    renderHook(() => useNativeUI());

    await waitFor(() => {
      expect(tauriMocks.invokeTimerSetMenubarFocusTitle).toHaveBeenCalledWith(null);
    });
    expect(tauriMocks.invoke).toHaveBeenCalledWith("menubar_set_title", {
      title: "03:41",
    });
  });
});
