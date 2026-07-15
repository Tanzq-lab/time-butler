import { useSettingsStore } from "@/features/settings/use-settings-store";
import { useNotificationStore } from "@/features/notifications/use-notification-store";
import { recordAppEvent } from "@/lib/db";
import { invoke, isTauri } from "@/lib/tauri";
import breakOverChimeUrl from "@/assets/sounds/simple-happy-beep.ogg";

type NotificationType =
  | "session-complete"
  | "break-over"
  | "focus-start"
  | "focus-complete";

export interface NotificationDeliveryContext {
  trigger?: string;
  sessionId?: number | null;
  phase?: string | null;
  deadlineLagMs?: number | null;
}

interface DiagnosticAttempt {
  attemptId: string;
  notificationType: NotificationType | null;
  trigger: string;
  sessionId: number | null;
  phase: string | null;
  deadlineLagMs: number | null;
  startedAtMs: number;
  eventSequence: number;
}

const NOTIFICATION_TITLES: Record<NotificationType, string> = {
  "session-complete": "专注已完成",
  "break-over": "休息结束了",
  "focus-start": "该专注了",
  "focus-complete": "专注时间到",
};

const BREAK_OVER_SOUND_NAME = "simple-happy-beep.ogg";
const BREAK_OVER_SOUND_GAIN = 1.45;

function getSettings() {
  return useSettingsStore.getState().settings;
}

let audioCtx: AudioContext | null = null;
let breakOverBufferPromise: Promise<AudioBuffer> | null = null;
let breakOverLoopSource: AudioBufferSourceNode | null = null;
let breakOverLoopGain: GainNode | null = null;
let breakOverNativeActive = false;
let breakOverLoopStartPromise: Promise<void> | null = null;
let breakOverLoopAttempt: DiagnosticAttempt | null = null;
let breakOverLoopPendingAttempt: DiagnosticAttempt | null = null;
let breakOverLoopStartedAtMs: number | null = null;
let breakOverLoopToken = 0;
let diagnosticAttemptSequence = 0;

function createDiagnosticAttempt(
  notificationType: NotificationType | null,
  context: NotificationDeliveryContext = {},
  defaultTrigger: string,
): DiagnosticAttempt {
  diagnosticAttemptSequence = (diagnosticAttemptSequence + 1) % 1_000_000;
  const startedAtMs = Date.now();

  return {
    attemptId: `${startedAtMs.toString(36)}-${diagnosticAttemptSequence.toString(36)}`,
    notificationType,
    trigger: context.trigger ?? defaultTrigger,
    sessionId: context.sessionId ?? null,
    phase: context.phase ?? null,
    deadlineLagMs: context.deadlineLagMs ?? null,
    startedAtMs,
    eventSequence: 0,
  };
}

function describeError(error: unknown): Record<string, string> {
  const errorName = error instanceof Error ? error.name : typeof error;
  const errorMessage = error instanceof Error ? error.message : String(error);
  return {
    errorName,
    errorMessage: errorMessage.slice(0, 500),
  };
}

function getRuntimeAudioMetadata(): Record<string, unknown> {
  const activation =
    typeof navigator !== "undefined" ? navigator.userActivation : undefined;

  return {
    documentVisibility:
      typeof document !== "undefined" ? document.visibilityState : "unavailable",
    userActivationIsActive: activation?.isActive ?? null,
    userActivationHasBeenActive: activation?.hasBeenActive ?? null,
    audioContextState: audioCtx?.state ?? "missing",
  };
}

function recordNotificationDiagnostic(
  eventName: string,
  attempt: DiagnosticAttempt,
  metadata: Record<string, unknown> = {},
): void {
  const occurredAtMs = Date.now();
  attempt.eventSequence += 1;
  void recordAppEvent({
    eventName,
    route:
      typeof window !== "undefined" ? window.location.pathname || "/" : null,
    entityType: attempt.sessionId == null ? "notification" : "session",
    entityId: attempt.sessionId ?? attempt.attemptId,
    metadata: {
      attemptId: attempt.attemptId,
      notificationType: attempt.notificationType,
      trigger: attempt.trigger,
      phase: attempt.phase,
      deadlineLagMs: attempt.deadlineLagMs,
      occurredAtMs,
      eventSequence: attempt.eventSequence,
      attemptElapsedMs: Math.max(0, occurredAtMs - attempt.startedAtMs),
      ...metadata,
    },
  });
}

async function getReadyAudioContext(
  attempt: DiagnosticAttempt,
  purpose: string,
): Promise<AudioContext> {
  const contextStartedAtMs = Date.now();
  const stateBefore = audioCtx?.state ?? "missing";
  let operation = "reuse";

  try {
    if (typeof AudioContext === "undefined") {
      throw new Error("AudioContext is unavailable.");
    }

    if (!audioCtx) {
      operation = "create";
      audioCtx = new AudioContext();
    }

    if (audioCtx.state === "suspended") {
      operation = "resume";
      await audioCtx.resume();
    }

    const stateAfter = audioCtx.state;
    recordNotificationDiagnostic("notification_audio_context_result", attempt, {
      purpose,
      operation,
      outcome: stateAfter === "running" ? "ready" : "not_running",
      stateBefore,
      stateAfter,
      durationMs: Math.max(0, Date.now() - contextStartedAtMs),
      ...getRuntimeAudioMetadata(),
    });
    return audioCtx;
  } catch (error) {
    recordNotificationDiagnostic("notification_audio_context_result", attempt, {
      purpose,
      operation,
      outcome: "failed",
      stateBefore,
      stateAfter: audioCtx?.state ?? "missing",
      durationMs: Math.max(0, Date.now() - contextStartedAtMs),
      ...getRuntimeAudioMetadata(),
      ...describeError(error),
    });
    throw error;
  }
}

async function playChimeForAttempt(
  attempt: DiagnosticAttempt,
  mode: "generated_chime" | "fallback_chime",
): Promise<void> {
  const playbackStartedAtMs = Date.now();

  if (isTauri()) {
    try {
      const nativeAudioToken = await invoke<number>("notification_audio_play", {
        kind: "chime",
        repeat: false,
      });
      recordNotificationDiagnostic(
        "notification_audio_playback_result",
        attempt,
        {
          mode: "native_system_sound",
          outcome: "started",
          nativeAudioToken,
          durationMs: Math.max(0, Date.now() - playbackStartedAtMs),
          ...getRuntimeAudioMetadata(),
        },
      );
    } catch (error) {
      recordNotificationDiagnostic(
        "notification_audio_playback_result",
        attempt,
        {
          mode: "native_system_sound",
          outcome: "failed",
          durationMs: Math.max(0, Date.now() - playbackStartedAtMs),
          ...getRuntimeAudioMetadata(),
          ...describeError(error),
        },
      );
      console.error("[Notification] Native audio chime failed:", error);
    }
    return;
  }

  try {
    const ctx = await getReadyAudioContext(attempt, mode);
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

    recordNotificationDiagnostic("notification_audio_playback_result", attempt, {
      mode,
      outcome: "started",
      oscillatorCount: frequencies.length,
      durationMs: Math.max(0, Date.now() - playbackStartedAtMs),
      ...getRuntimeAudioMetadata(),
    });
  } catch (error) {
    recordNotificationDiagnostic("notification_audio_playback_result", attempt, {
      mode,
      outcome: "failed",
      durationMs: Math.max(0, Date.now() - playbackStartedAtMs),
      ...getRuntimeAudioMetadata(),
      ...describeError(error),
    });
    console.error("[Notification] Audio chime failed:", error);
  }
}

export async function playChime(
  context: NotificationDeliveryContext = {},
): Promise<void> {
  const attempt = createDiagnosticAttempt(
    "session-complete",
    context,
    "direct_chime",
  );
  await playChimeForAttempt(attempt, "generated_chime");
}

async function getBreakOverBuffer(
  ctx: AudioContext,
  attempt: DiagnosticAttempt,
): Promise<AudioBuffer> {
  const cacheState = breakOverBufferPromise ? "reused" : "new";
  const bufferStartedAtMs = Date.now();

  if (!breakOverBufferPromise) {
    breakOverBufferPromise = (async () => {
      const fetchStartedAtMs = Date.now();
      let response: Response;
      let bytes: ArrayBuffer;

      try {
        response = await fetch(breakOverChimeUrl);
        if (!response.ok) {
          throw new Error(`Failed to load break-over sound: ${response.status}`);
        }
        bytes = await response.arrayBuffer();
        recordNotificationDiagnostic("notification_audio_asset_result", attempt, {
          stage: "fetch",
          outcome: "succeeded",
          httpStatus: response.status,
          byteLength: bytes.byteLength,
          durationMs: Math.max(0, Date.now() - fetchStartedAtMs),
        });
      } catch (error) {
        recordNotificationDiagnostic("notification_audio_asset_result", attempt, {
          stage: "fetch",
          outcome: "failed",
          durationMs: Math.max(0, Date.now() - fetchStartedAtMs),
          ...describeError(error),
        });
        throw error;
      }

      const decodeStartedAtMs = Date.now();
      try {
        const buffer = await ctx.decodeAudioData(bytes);
        recordNotificationDiagnostic("notification_audio_asset_result", attempt, {
          stage: "decode",
          outcome: "succeeded",
          audioDurationSec: buffer.duration,
          durationMs: Math.max(0, Date.now() - decodeStartedAtMs),
        });
        return buffer;
      } catch (error) {
        recordNotificationDiagnostic("notification_audio_asset_result", attempt, {
          stage: "decode",
          outcome: "failed",
          durationMs: Math.max(0, Date.now() - decodeStartedAtMs),
          ...describeError(error),
        });
        throw error;
      }
    })();
  }

  try {
    const buffer = await breakOverBufferPromise;
    recordNotificationDiagnostic("notification_audio_buffer_result", attempt, {
      outcome: "ready",
      cacheState,
      audioDurationSec: buffer.duration,
      durationMs: Math.max(0, Date.now() - bufferStartedAtMs),
    });
    return buffer;
  } catch (error) {
    breakOverBufferPromise = null;
    recordNotificationDiagnostic("notification_audio_buffer_result", attempt, {
      outcome: "failed",
      cacheState,
      durationMs: Math.max(0, Date.now() - bufferStartedAtMs),
      ...describeError(error),
    });
    throw error;
  }
}

export async function prepareNotificationAudio(
  context: NotificationDeliveryContext = {},
): Promise<void> {
  const attempt = createDiagnosticAttempt(
    null,
    context,
    "notification_audio_prepare",
  );
  const settings = getSettings();
  if (!settings.soundEnabled) {
    recordNotificationDiagnostic("notification_audio_prepare_result", attempt, {
      outcome: "skipped_disabled",
    });
    return;
  }

  if (isTauri()) {
    recordNotificationDiagnostic("notification_audio_prepare_result", attempt, {
      outcome: "native_ready",
      mode: "native_system_sound",
      ...getRuntimeAudioMetadata(),
    });
    return;
  }

  try {
    const ctx = await getReadyAudioContext(attempt, "prepare");
    await getBreakOverBuffer(ctx, attempt);
    recordNotificationDiagnostic("notification_audio_prepare_result", attempt, {
      outcome: "ready",
      ...getRuntimeAudioMetadata(),
    });
  } catch (error) {
    recordNotificationDiagnostic("notification_audio_prepare_result", attempt, {
      outcome: "failed",
      ...getRuntimeAudioMetadata(),
      ...describeError(error),
    });
    console.warn("[Notification] Failed to prepare audio:", error);
  }
}

async function playBreakOverSoundForAttempt(
  attempt: DiagnosticAttempt,
): Promise<void> {
  const nativeRuntime = isTauri();
  if (breakOverLoopSource || breakOverNativeActive) {
    recordNotificationDiagnostic("notification_audio_playback_result", attempt, {
      mode: breakOverNativeActive
        ? "native_break_reminder"
        : "break_over_loop",
      outcome: "already_playing",
      activeAttemptId: breakOverLoopAttempt?.attemptId ?? null,
      ...getRuntimeAudioMetadata(),
    });
    return;
  }
  if (breakOverLoopStartPromise) {
    recordNotificationDiagnostic("notification_audio_playback_result", attempt, {
      mode: nativeRuntime
        ? "native_break_reminder"
        : "break_over_loop",
      outcome: "joined_pending_start",
      activeAttemptId: breakOverLoopPendingAttempt?.attemptId ?? null,
      ...getRuntimeAudioMetadata(),
    });
    return breakOverLoopStartPromise;
  }

  const token = breakOverLoopToken;
  const playbackStartedAtMs = Date.now();
  breakOverLoopPendingAttempt = attempt;
  breakOverLoopStartPromise = (async () => {
    try {
      if (nativeRuntime) {
        const nativeAudioToken = await invoke<number>("notification_audio_play", {
          kind: "break_over",
          repeat: true,
        });
        if (
          token !== breakOverLoopToken ||
          breakOverLoopSource ||
          breakOverNativeActive
        ) {
          await invoke("notification_audio_stop");
          recordNotificationDiagnostic(
            "notification_audio_playback_result",
            attempt,
            {
              mode: "native_break_reminder",
              outcome: "cancelled_before_start",
              tokenChanged: token !== breakOverLoopToken,
              reminderAlreadyActive: Boolean(
                breakOverLoopSource || breakOverNativeActive,
              ),
              durationMs: Math.max(0, Date.now() - playbackStartedAtMs),
              ...getRuntimeAudioMetadata(),
            },
          );
          return;
        }

        breakOverNativeActive = true;
        breakOverLoopAttempt = attempt;
        breakOverLoopStartedAtMs = Date.now();
        recordNotificationDiagnostic(
          "notification_audio_playback_result",
          attempt,
          {
            mode: "native_break_reminder",
            outcome: "started",
            nativeAudioToken,
            audioAsset: BREAK_OVER_SOUND_NAME,
            loop: true,
            gain: BREAK_OVER_SOUND_GAIN,
            repeatStrategy: "continuous",
            durationMs: Math.max(0, Date.now() - playbackStartedAtMs),
            ...getRuntimeAudioMetadata(),
          },
        );
        return;
      }

      const ctx = await getReadyAudioContext(attempt, "break_over_loop");
      const buffer = await getBreakOverBuffer(ctx, attempt);
      if (token !== breakOverLoopToken || breakOverLoopSource) {
        recordNotificationDiagnostic("notification_audio_playback_result", attempt, {
          mode: "break_over_loop",
          outcome: "cancelled_before_start",
          tokenChanged: token !== breakOverLoopToken,
          sourceAlreadyActive: Boolean(breakOverLoopSource),
          durationMs: Math.max(0, Date.now() - playbackStartedAtMs),
          ...getRuntimeAudioMetadata(),
        });
        return;
      }

      const source = ctx.createBufferSource();
      const gain = ctx.createGain();

      source.buffer = buffer;
      source.loop = true;
      source.onended = () => {
        if (breakOverLoopSource !== source) return;
        recordNotificationDiagnostic("notification_audio_playback_result", attempt, {
          mode: "break_over_loop",
          outcome: "ended_unexpectedly",
          playDurationMs:
            breakOverLoopStartedAtMs == null
              ? null
              : Math.max(0, Date.now() - breakOverLoopStartedAtMs),
          ...getRuntimeAudioMetadata(),
        });
        source.disconnect();
        gain.disconnect();
        breakOverLoopSource = null;
        breakOverLoopGain = null;
        breakOverLoopAttempt = null;
        breakOverLoopStartedAtMs = null;
      };
      gain.gain.value = 1.45;

      source.connect(gain);
      gain.connect(ctx.destination);
      breakOverLoopSource = source;
      breakOverLoopGain = gain;
      breakOverLoopAttempt = attempt;
      breakOverLoopStartedAtMs = Date.now();
      source.start();

      recordNotificationDiagnostic("notification_audio_playback_result", attempt, {
        mode: "break_over_loop",
        outcome: "started",
        loop: true,
        gain: gain.gain.value,
        audioDurationSec: buffer.duration,
        durationMs: Math.max(0, Date.now() - playbackStartedAtMs),
        ...getRuntimeAudioMetadata(),
      });
    } catch (error) {
      recordNotificationDiagnostic("notification_audio_playback_result", attempt, {
        mode: nativeRuntime
          ? "native_break_reminder"
          : "break_over_loop",
        outcome: "failed",
        durationMs: Math.max(0, Date.now() - playbackStartedAtMs),
        ...getRuntimeAudioMetadata(),
        ...describeError(error),
      });
      console.error("[Notification] Break-over sound failed:", error);
      if (!nativeRuntime) {
        await playChimeForAttempt(attempt, "fallback_chime");
      }
    } finally {
      if (breakOverLoopPendingAttempt?.attemptId === attempt.attemptId) {
        breakOverLoopStartPromise = null;
        breakOverLoopPendingAttempt = null;
      }
    }
  })();

  return breakOverLoopStartPromise;
}

export async function playBreakOverSound(
  context: NotificationDeliveryContext = {},
): Promise<void> {
  const attempt = createDiagnosticAttempt(
    "break-over",
    context,
    "direct_break_over_playback",
  );
  return playBreakOverSoundForAttempt(attempt);
}

export function stopBreakOverSound(reason = "unspecified"): void {
  const source = breakOverLoopSource;
  const gain = breakOverLoopGain;
  const nativeActive = breakOverNativeActive;
  const attempt =
    breakOverLoopAttempt ??
    breakOverLoopPendingAttempt ??
    createDiagnosticAttempt(
      "break-over",
      { trigger: "break_reminder_stop_without_attempt" },
      "break_reminder_stop_without_attempt",
    );
  const hadPendingStart = Boolean(breakOverLoopStartPromise);
  const playDurationMs =
    breakOverLoopStartedAtMs == null
      ? null
      : Math.max(0, Date.now() - breakOverLoopStartedAtMs);

  breakOverLoopToken += 1;
  breakOverLoopStartPromise = null;
  breakOverLoopPendingAttempt = null;
  breakOverLoopSource = null;
  breakOverLoopGain = null;
  breakOverNativeActive = false;
  breakOverLoopAttempt = null;
  breakOverLoopStartedAtMs = null;

  if (nativeActive) {
    void invoke("notification_audio_stop")
      .then(() => {
        recordNotificationDiagnostic("notification_audio_stopped", attempt, {
          reason,
          outcome: "stopped",
          mode: "native_break_reminder",
          hadPendingStart,
          playDurationMs,
          ...getRuntimeAudioMetadata(),
        });
      })
      .catch((error) => {
        recordNotificationDiagnostic("notification_audio_stopped", attempt, {
          reason,
          outcome: "stop_failed",
          mode: "native_break_reminder",
          hadPendingStart,
          playDurationMs,
          ...describeError(error),
          ...getRuntimeAudioMetadata(),
        });
        console.error("[Notification] Failed to stop native audio:", error);
      });
    return;
  }

  if (!source) {
    recordNotificationDiagnostic("notification_audio_stopped", attempt, {
      reason,
      outcome: hadPendingStart ? "cancelled_pending_start" : "no_active_source",
      hadPendingStart,
      playDurationMs,
      ...getRuntimeAudioMetadata(),
    });
    return;
  }

  let stopError: Record<string, string> | null = null;
  try {
    source.stop();
  } catch (error) {
    stopError = describeError(error);
  }

  source.disconnect();
  gain?.disconnect();
  recordNotificationDiagnostic("notification_audio_stopped", attempt, {
    reason,
    outcome: stopError ? "stop_failed" : "stopped",
    hadPendingStart,
    playDurationMs,
    ...(stopError ?? {}),
    ...getRuntimeAudioMetadata(),
  });
}

export async function sendNotification(
  type: NotificationType,
  body?: string,
  context: NotificationDeliveryContext = {},
): Promise<void> {
  const settings = getSettings();
  const tauriRuntime = isTauri();
  const attempt = createDiagnosticAttempt(type, context, "notification_send");
  recordNotificationDiagnostic("notification_delivery_requested", attempt, {
    soundEnabled: settings.soundEnabled,
    tauriRuntime,
    hasBody: Boolean(body),
    ...getRuntimeAudioMetadata(),
  });

  if (tauriRuntime) {
    const systemStartedAtMs = Date.now();
    let permissionRequested = false;
    try {
      const {
        sendNotification: sendNativeNotification,
        isPermissionGranted,
        requestPermission,
      } = await import("@tauri-apps/plugin-notification");

      let granted = await isPermissionGranted();
      if (!granted) {
        permissionRequested = true;
        const permission = await requestPermission();
        granted = permission === "granted";

        useNotificationStore.getState().reset();
        useNotificationStore
          .getState()
          .checkPermission()
          .catch(() => {});
      }

      if (granted) {
        await sendNativeNotification({
          title: NOTIFICATION_TITLES[type],
          body: body || "",
        });
        recordNotificationDiagnostic("notification_system_delivery_result", attempt, {
          outcome: "sent",
          permissionGranted: true,
          permissionRequested,
          durationMs: Math.max(0, Date.now() - systemStartedAtMs),
        });
      } else {
        recordNotificationDiagnostic("notification_system_delivery_result", attempt, {
          outcome: "permission_denied",
          permissionGranted: false,
          permissionRequested,
          durationMs: Math.max(0, Date.now() - systemStartedAtMs),
        });
        console.warn(
          "[Notification] Permission denied, notification not sent.",
        );
      }
    } catch (error) {
      recordNotificationDiagnostic("notification_system_delivery_result", attempt, {
        outcome: "failed",
        permissionRequested,
        durationMs: Math.max(0, Date.now() - systemStartedAtMs),
        ...describeError(error),
      });
      console.error("[Notification] Failed to send:", error);
    }
  } else {
    recordNotificationDiagnostic("notification_system_delivery_result", attempt, {
      outcome: "not_applicable",
      permissionRequested: false,
      durationMs: 0,
    });
  }

  if (!settings.soundEnabled) {
    recordNotificationDiagnostic("notification_audio_skipped", attempt, {
      outcome: "sound_disabled",
      ...getRuntimeAudioMetadata(),
    });
    return;
  }

  if (type === "break-over") {
    await playBreakOverSoundForAttempt(attempt);
  } else {
    await playChimeForAttempt(attempt, "generated_chime");
  }
}
