import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTimerStore } from "@/features/timer/use-timer-store";
import { formatSeconds } from "@/lib/time";
import { isTauri } from "@/lib/tauri";

const PHASE_ICONS: Record<string, string> = {
  work: "\u{1F345}",
  short_break: "\u2615",
  long_break: "\u2615",
};

export function useNativeUI() {
  const secondsRemaining = useTimerStore((s) => s.secondsRemaining);
  const phase = useTimerStore((s) => s.phase);
  const status = useTimerStore((s) => s.status);

  useEffect(() => {
    if (!isTauri()) return;

    if (status === "idle") {
      invoke("menubar_hide").catch(() => {});
      invoke("plugin:tray|set_tooltip", { tooltip: "" }).catch(() => {});
      return;
    }

    const icon = PHASE_ICONS[phase as keyof typeof PHASE_ICONS] || "\u{1F345}";

    const title = `${icon} ${formatSeconds(secondsRemaining)}`;

    invoke("menubar_show").catch(() => {});
    invoke("menubar_set_title", { title }).catch(() => {});

    const phaseLabel = phase === "work" ? "专注" : "休息";
    const phaseIcon = phase === "work" ? "\u{1F351}" : "\u2615";

    const menubarTooltip = `Time-butler - ${phaseLabel} ${formatSeconds(secondsRemaining)}`;
    invoke("menubar_set_tooltip", { tooltip: menubarTooltip }).catch(() => {});

    const trayTooltip = `${formatSeconds(secondsRemaining)} ${phaseIcon}`;
    invoke("plugin:tray|set_tooltip", { tooltip: trayTooltip }).catch(() => {});

    return () => {
      invoke("plugin:tray|set_tooltip", { tooltip: "" }).catch(() => {});
    };
  }, [secondsRemaining, phase, status]);
}
