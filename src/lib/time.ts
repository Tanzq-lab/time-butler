import type { TimerPhase } from "@/features/timer/timer-types";

export function formatSeconds(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

const PHASE_CONFIG = {
  work:        { color: "text-sahara-primary",       bg: "bg-sahara-primary", label: "专注" },
  short_break: { color: "text-sahara-text-secondary", bg: "bg-sahara-card",   label: "短休息" },
  long_break:  { color: "text-sahara-text-muted",     bg: "bg-sahara-card",   label: "长休息" },
} as const;

export function getPhaseColor(phase: TimerPhase): string {
  return PHASE_CONFIG[phase].color;
}

export function getPhaseBg(phase: TimerPhase): string {
  return PHASE_CONFIG[phase].bg;
}

export function getPhaseLabel(phase: TimerPhase): string {
  return PHASE_CONFIG[phase].label;
}

export function parseLocalDateTime(value: string): Date {
  return new Date(value.includes("T") ? value : value.replace(" ", "T"));
}

export function formatTimeAmPm(date: Date): string {
  const h = date.getHours();
  const m = date.getMinutes();
  return `${String(h).padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}
