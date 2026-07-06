import { useSettingsStore } from "@/features/settings/use-settings-store";
import { useNotificationStore } from "@/features/notifications/use-notification-store";
import { isTauri } from "@/lib/tauri";
import breakOverChimeUrl from "@/assets/sounds/simple-happy-beep.ogg";

type NotificationType =
  | "session-complete"
  | "break-over"
  | "focus-start"
  | "focus-complete";

const NOTIFICATION_TITLES: Record<NotificationType, string> = {
  "session-complete": "专注已完成",
  "break-over": "休息结束了",
  "focus-start": "该专注了",
  "focus-complete": "专注时间到",
};

function getSettings() {
  return useSettingsStore.getState().settings;
}

let audioCtx: AudioContext | null = null;
let breakOverBufferPromise: Promise<AudioBuffer> | null = null;
let breakOverLoopSource: AudioBufferSourceNode | null = null;
let breakOverLoopGain: GainNode | null = null;
let breakOverLoopStartPromise: Promise<void> | null = null;
let breakOverLoopToken = 0;

async function getReadyAudioContext(): Promise<AudioContext> {
  if (typeof AudioContext === "undefined") {
    throw new Error("AudioContext is unavailable.");
  }

  if (!audioCtx) audioCtx = new AudioContext();
  if (audioCtx.state === "suspended") await audioCtx.resume();
  return audioCtx;
}

export async function playChime(): Promise<void> {
  try {
    const ctx = await getReadyAudioContext();
    const now = ctx.currentTime;

    const frequencies = [523.25, 659.25, 783.99];
    const durations = [0.15, 0.15, 0.3];

    frequencies.forEach((freq, i) => {
      const startAt = now + durations.slice(0, i).reduce((a, b) => a + b, 0);
      const stopAt = startAt + durations[i];
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, startAt);

      gain.gain.setValueAtTime(0.3, startAt);
      gain.gain.exponentialRampToValueAtTime(0.001, stopAt);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startAt);
      osc.stop(stopAt);
    });
  } catch (e) {
    console.error("[Notification] Audio chime failed:", e);
  }
}

async function getBreakOverBuffer(ctx: AudioContext): Promise<AudioBuffer> {
  if (!breakOverBufferPromise) {
    breakOverBufferPromise = fetch(breakOverChimeUrl)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load break-over sound: ${response.status}`);
        }
        return response.arrayBuffer();
      })
      .then((bytes) => ctx.decodeAudioData(bytes));
  }

  try {
    return await breakOverBufferPromise;
  } catch (err) {
    breakOverBufferPromise = null;
    throw err;
  }
}

export async function prepareNotificationAudio(): Promise<void> {
  const settings = getSettings();
  if (!settings.soundEnabled) return;

  try {
    const ctx = await getReadyAudioContext();
    await getBreakOverBuffer(ctx);
  } catch (e) {
    console.warn("[Notification] Failed to prepare audio:", e);
  }
}

export async function playBreakOverSound(): Promise<void> {
  if (breakOverLoopSource) return;
  if (breakOverLoopStartPromise) return breakOverLoopStartPromise;

  const token = breakOverLoopToken;
  breakOverLoopStartPromise = (async () => {
    try {
      const ctx = await getReadyAudioContext();
      const buffer = await getBreakOverBuffer(ctx);
      if (token !== breakOverLoopToken || breakOverLoopSource) return;

      const source = ctx.createBufferSource();
      const gain = ctx.createGain();

      source.buffer = buffer;
      source.loop = true;
      source.onended = () => {
        if (breakOverLoopSource !== source) return;
        source.disconnect();
        gain.disconnect();
        breakOverLoopSource = null;
        breakOverLoopGain = null;
      };
      gain.gain.value = 1.45;

      source.connect(gain);
      gain.connect(ctx.destination);
      breakOverLoopSource = source;
      breakOverLoopGain = gain;
      source.start();
    } catch (e) {
      console.error("[Notification] Break-over sound failed:", e);
      await playChime();
    } finally {
      breakOverLoopStartPromise = null;
    }
  })();

  return breakOverLoopStartPromise;
}

export function stopBreakOverSound(): void {
  breakOverLoopToken += 1;
  breakOverLoopStartPromise = null;

  if (!breakOverLoopSource) return;

  const source = breakOverLoopSource;
  const gain = breakOverLoopGain;
  breakOverLoopSource = null;
  breakOverLoopGain = null;

  try {
    source.stop();
  } catch {}

  source.disconnect();
  gain?.disconnect();
}

export async function sendNotification(
  type: NotificationType,
  body?: string,
): Promise<void> {
  const settings = getSettings();

  if (isTauri()) {
    try {
      const { sendNotification, isPermissionGranted, requestPermission } =
        await import("@tauri-apps/plugin-notification");

      let granted = await isPermissionGranted();
      if (!granted) {
        const permission = await requestPermission();
        granted = permission === "granted";

        useNotificationStore.getState().reset();
        useNotificationStore
          .getState()
          .checkPermission()
          .catch(() => {});
      }

      if (granted) {
        await sendNotification({
          title: NOTIFICATION_TITLES[type],
          body: body || "",
        });
      } else {
        console.warn(
          "[Notification] Permission denied, notification not sent.",
        );
      }
    } catch (e) {
      console.error("[Notification] Failed to send:", e);
    }
  }

  if (settings.soundEnabled) {
    if (type === "break-over") {
      await playBreakOverSound();
    } else {
      await playChime();
    }
  }
}
