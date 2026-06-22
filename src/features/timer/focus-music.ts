import { invoke, isTauri } from "@/lib/tauri";

type NeteaseMusicAction = "play" | "stop";

async function controlNeteaseMusic(action: NeteaseMusicAction): Promise<void> {
  if (!isTauri()) return;

  try {
    await invoke("control_netease_music", { action });
  } catch (err) {
    console.warn(`[FocusMusic] Failed to ${action} NetEase Cloud Music:`, err);
  }
}

export function playFocusMusic(): Promise<void> {
  return controlNeteaseMusic("play");
}

export function stopFocusMusic(): Promise<void> {
  return controlNeteaseMusic("stop");
}
