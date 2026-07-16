export type { Session } from "@/lib/db";
import type { Session } from "@/lib/db";

export function countCompletedPomos(sessions: Session[]): number {
  return sessions.filter(
    (session) =>
      session.phase === "work" &&
      session.completed === 1 &&
      session.pomo_counted === 1,
  ).length;
}

export function formatPomoCount(count: number): string {
  return `${count} 个番茄`;
}

export function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}秒`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs > 0 ? `${mins}分钟 ${secs}秒` : `${mins}分钟`;
}

export function formatTotalTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}小时 ${mins}分钟`;
  return `${mins}分钟`;
}
