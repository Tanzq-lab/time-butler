import { invoke } from "@tauri-apps/api/core";

export { invoke };

export const invokeHotkey = (key: string) =>
  invoke("register_hotkey", { key });

export const invokeUnregisterHotkey = (key: string) =>
  invoke("unregister_hotkey", { key });

export const invokeTimerScheduleDeadline = (deadlineAtMs: number) =>
  invoke<number>("timer_schedule_deadline", { deadlineAtMs });

export const invokeTimerCancelDeadline = () =>
  invoke("timer_cancel_deadline");

export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}
