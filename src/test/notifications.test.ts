import { beforeEach, describe, expect, it, vi } from "vitest";

const notificationState = vi.hoisted(() => ({
  soundEnabled: true,
}));

const runtimeState = vi.hoisted(() => ({
  tauri: false,
}));

const tauriMocks = vi.hoisted(() => ({
  invoke: vi.fn().mockResolvedValue(41),
}));

const systemNotificationMocks = vi.hoisted(() => ({
  isPermissionGranted: vi.fn().mockResolvedValue(true),
  requestPermission: vi.fn().mockResolvedValue("granted"),
  sendNotification: vi.fn().mockResolvedValue(undefined),
}));

const appEventMocks = vi.hoisted(() => ({
  recordAppEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/db", () => appEventMocks);

vi.mock("@/features/settings/use-settings-store", () => ({
  useSettingsStore: {
    getState: vi.fn(() => ({
      settings: {
        soundEnabled: notificationState.soundEnabled,
      },
    })),
  },
}));

vi.mock("@/features/notifications/use-notification-store", () => ({
  useNotificationStore: {
    getState: vi.fn(() => ({
      reset: vi.fn(),
      checkPermission: vi.fn().mockResolvedValue(undefined),
    })),
  },
}));

vi.mock("@/lib/tauri", () => ({
  invoke: tauriMocks.invoke,
  isTauri: vi.fn(() => runtimeState.tauri),
}));

vi.mock("@tauri-apps/plugin-notification", () => systemNotificationMocks);

function installAudioMocks() {
  const decodeAudioData = vi.fn().mockResolvedValue({ duration: 4.6 });
  const bufferSource = {
    buffer: null as unknown,
    loop: false,
    onended: null as (() => void) | null,
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  };
  const oscillator = {
    type: "sine",
    frequency: {
      setValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  };
  const gain = {
    gain: {
      value: 0,
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
    disconnect: vi.fn(),
  };
  const audioContext = {
    state: "running",
    currentTime: 0,
    destination: {},
    decodeAudioData,
    createBufferSource: vi.fn(() => bufferSource),
    createOscillator: vi.fn(() => oscillator),
    createGain: vi.fn(() => gain),
    resume: vi.fn().mockResolvedValue(undefined),
  };

  vi.stubGlobal(
    "AudioContext",
    vi.fn(function AudioContextMock() {
      return audioContext;
    }),
  );
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    }),
  );

  return { audioContext, bufferSource, oscillator };
}

describe("notifications", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    notificationState.soundEnabled = true;
    runtimeState.tauri = false;
    tauriMocks.invoke.mockResolvedValue(41);
    systemNotificationMocks.isPermissionGranted.mockResolvedValue(true);
    systemNotificationMocks.requestPermission.mockResolvedValue("granted");
    systemNotificationMocks.sendNotification.mockResolvedValue(undefined);
  });

  it("plays the downloaded todo-style chime for browser break-over notifications", async () => {
    const { audioContext, bufferSource } = installAudioMocks();
    const { sendNotification } = await import("@/lib/notifications");

    await sendNotification("break-over", "休息结束了。");

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("simple-happy-beep.ogg"),
    );
    expect(audioContext.decodeAudioData).toHaveBeenCalledOnce();
    expect(audioContext.createBufferSource).toHaveBeenCalledOnce();
    expect(bufferSource.loop).toBe(true);
    expect(bufferSource.start).toHaveBeenCalledOnce();
    expect(audioContext.createOscillator).not.toHaveBeenCalled();
    expect(appEventMocks.recordAppEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "notification_delivery_requested",
        metadata: expect.objectContaining({
          notificationType: "break-over",
          soundEnabled: true,
        }),
      }),
    );
    expect(appEventMocks.recordAppEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "notification_audio_asset_result",
        metadata: expect.objectContaining({
          stage: "decode",
          outcome: "succeeded",
        }),
      }),
    );
    expect(appEventMocks.recordAppEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "notification_audio_playback_result",
        metadata: expect.objectContaining({
          mode: "break_over_loop",
          outcome: "started",
        }),
      }),
    );
  });

  it("starts a repeating native reminder in Tauri without WebAudio", async () => {
    runtimeState.tauri = true;
    const { sendNotification, stopBreakOverSound } = await import(
      "@/lib/notifications"
    );

    await sendNotification("break-over", "休息结束了。");

    expect(tauriMocks.invoke).toHaveBeenCalledWith("notification_audio_play", {
      kind: "break_over",
      repeat: true,
    });
    expect(globalThis.AudioContext).toBeUndefined();
    expect(appEventMocks.recordAppEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "notification_audio_playback_result",
        metadata: expect.objectContaining({
          mode: "native_break_reminder",
          outcome: "started",
          nativeAudioToken: 41,
          audioAsset: "simple-happy-beep.ogg",
          loop: true,
          gain: 1.45,
          gapless: true,
          repeatStrategy: "persistent_native_stream",
        }),
      }),
    );

    stopBreakOverSound("reminder_button");
    expect(tauriMocks.invoke).toHaveBeenCalledWith("notification_audio_stop");
    await Promise.resolve();
    expect(appEventMocks.recordAppEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "notification_audio_stopped",
        metadata: expect.objectContaining({
          mode: "native_break_reminder",
          outcome: "stopped",
          reason: "reminder_button",
        }),
      }),
    );
  });

  it("prepares and preloads browser notification audio", async () => {
    const { audioContext } = installAudioMocks();
    const { prepareNotificationAudio } = await import("@/lib/notifications");

    await prepareNotificationAudio();

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("simple-happy-beep.ogg"),
    );
    expect(audioContext.decodeAudioData).toHaveBeenCalledOnce();
    expect(appEventMocks.recordAppEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "notification_audio_prepare_result",
        metadata: expect.objectContaining({ outcome: "ready" }),
      }),
    );
  });

  it("does not prepare WebAudio in Tauri", async () => {
    runtimeState.tauri = true;
    const { prepareNotificationAudio } = await import("@/lib/notifications");

    await prepareNotificationAudio();

    expect(globalThis.AudioContext).toBeUndefined();
    expect(tauriMocks.invoke).not.toHaveBeenCalled();
    expect(appEventMocks.recordAppEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "notification_audio_prepare_result",
        metadata: expect.objectContaining({
          outcome: "native_ready",
          mode: "native_system_sound",
        }),
      }),
    );
  });

  it("stops the looping browser break-over chime when acknowledged", async () => {
    const { bufferSource } = installAudioMocks();
    const { sendNotification, stopBreakOverSound } = await import(
      "@/lib/notifications"
    );

    await sendNotification("break-over", "休息结束了。");
    stopBreakOverSound("reminder_button");

    expect(bufferSource.stop).toHaveBeenCalledOnce();
    expect(bufferSource.disconnect).toHaveBeenCalledOnce();
    expect(appEventMocks.recordAppEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "notification_audio_stopped",
        metadata: expect.objectContaining({
          reason: "reminder_button",
          outcome: "stopped",
        }),
      }),
    );
  });

  it("keeps the light generated browser chime for focus-complete notifications", async () => {
    const { audioContext, oscillator } = installAudioMocks();
    const { sendNotification } = await import("@/lib/notifications");

    await sendNotification("focus-complete", "专注时间到。");

    expect(fetch).not.toHaveBeenCalled();
    expect(audioContext.createBufferSource).not.toHaveBeenCalled();
    expect(audioContext.createOscillator).toHaveBeenCalledTimes(3);
    expect(oscillator.start).toHaveBeenCalledTimes(3);
  });

  it("uses one native sound for focus-complete notifications in Tauri", async () => {
    runtimeState.tauri = true;
    const { sendNotification } = await import("@/lib/notifications");

    await sendNotification("focus-complete", "专注时间到。");

    expect(tauriMocks.invoke).toHaveBeenCalledWith("notification_audio_play", {
      kind: "chime",
      repeat: false,
    });
    expect(globalThis.AudioContext).toBeUndefined();
    expect(appEventMocks.recordAppEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "notification_audio_playback_result",
        metadata: expect.objectContaining({
          mode: "native_system_sound",
          outcome: "started",
        }),
      }),
    );
  });

  it("records sound-disabled skips without creating an AudioContext", async () => {
    notificationState.soundEnabled = false;
    const { sendNotification } = await import("@/lib/notifications");

    await sendNotification("break-over", "休息结束了。", {
      trigger: "timer_natural_completion",
      sessionId: 513,
      phase: "short_break",
    });

    expect(globalThis.AudioContext).toBeUndefined();
    expect(appEventMocks.recordAppEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "notification_audio_skipped",
        entityType: "session",
        entityId: 513,
        metadata: expect.objectContaining({
          trigger: "timer_natural_completion",
          phase: "short_break",
          outcome: "sound_disabled",
        }),
      }),
    );
  });

  it("records browser asset failures and the generated fallback chime", async () => {
    const { oscillator } = installAudioMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        arrayBuffer: vi.fn(),
      }),
    );
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { sendNotification } = await import("@/lib/notifications");

    await sendNotification("break-over", "休息结束了。");

    expect(appEventMocks.recordAppEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "notification_audio_asset_result",
        metadata: expect.objectContaining({
          stage: "fetch",
          outcome: "failed",
          errorMessage: expect.stringContaining("404"),
        }),
      }),
    );
    expect(appEventMocks.recordAppEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "notification_audio_playback_result",
        metadata: expect.objectContaining({
          mode: "break_over_loop",
          outcome: "failed",
        }),
      }),
    );
    expect(appEventMocks.recordAppEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "notification_audio_playback_result",
        metadata: expect.objectContaining({
          mode: "fallback_chime",
          outcome: "started",
        }),
      }),
    );
    expect(oscillator.start).toHaveBeenCalledTimes(3);
    errorSpy.mockRestore();
  });
});
