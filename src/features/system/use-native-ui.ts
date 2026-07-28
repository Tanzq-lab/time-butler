import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTimerStore } from "@/features/timer/use-timer-store";
import { useTaskStore } from "@/features/tasks/use-task-store";
import { formatSeconds } from "@/lib/time";
import { invokeTimerSetMenubarFocusTitle, isTauri } from "@/lib/tauri";

export function useNativeUI() {
  const secondsRemaining = useTimerStore((s) => s.secondsRemaining);
  const phase = useTimerStore((s) => s.phase);
  const status = useTimerStore((s) => s.status);
  const focusTaskId = useTimerStore((s) => s.currentSessionTaskId ?? s.activeTaskId);
  const focusTaskTitle = useTaskStore((s) =>
    focusTaskId == null
      ? null
      : s.tasks.find((task) => task.id === focusTaskId)?.name.trim() || null,
  );

  useEffect(() => {
    if (!isTauri()) return;

    if (status === "idle") {
      invoke("menubar_hide").catch(() => {});
      invoke("menubar_set_tooltip", { tooltip: "" }).catch(() => {});
      invoke("plugin:tray|set_tooltip", { tooltip: "" }).catch(() => {});
      return;
    }

    invoke("menubar_show").catch(() => {});
    if (phase === "work") {
      invokeTimerSetMenubarFocusTitle(focusTaskTitle || "专注中").catch(() => {});
      return;
    }

    invokeTimerSetMenubarFocusTitle(null).catch(() => {});
    invoke("menubar_set_title", { title: formatSeconds(secondsRemaining) }).catch(() => {});
  }, [focusTaskTitle, phase, status]);

  useEffect(() => {
    if (!isTauri() || status === "idle") return;

    const menubarTooltip = phase === "work"
      ? `Time-butler - 专注：${focusTaskTitle || "专注中"}`
      : `Time-butler - 休息 ${formatSeconds(secondsRemaining)}`;
    invoke("menubar_set_tooltip", { tooltip: menubarTooltip }).catch(() => {});
    invoke("plugin:tray|set_tooltip", { tooltip: menubarTooltip }).catch(() => {});
  }, [focusTaskTitle, phase, secondsRemaining, status]);

}
