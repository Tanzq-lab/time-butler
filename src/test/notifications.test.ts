import { beforeEach, describe, expect, it, vi } from "vitest";

const notificationState = vi.hoisted(() => ({
  soundEnabled: true,
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
  isTauri: vi.fn(() => false),
}));

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
  });

  it("plays the downloaded todo-style chime for break-over notifications", async () => {
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

  it("prepares the notification audio context and preloads the break-over sound", async () => {
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

  it("stops the looping break-over chime when acknowledged", async () => {
    const { bufferSource } = installAudioMocks();
    const { sendNotification, stopBreakOverSound } = await import("@/lib/notifications");

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

  it("keeps the light generated chime for focus-complete notifications", async () => {
    const { audioContext, oscillator } = installAudioMocks();
    const { sendNotification } = await import("@/lib/notifications");

    await sendNotification("focus-complete", "专注时间到。");

    expect(fetch).not.toHaveBeenCalled();
    expect(audioContext.createBufferSource).not.toHaveBeenCalled();
    expect(audioContext.createOscillator).toHaveBeenCalledTimes(3);
    expect(oscillator.start).toHaveBeenCalledTimes(3);
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

  it("records asset failures and the generated fallback chime", async () => {
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
