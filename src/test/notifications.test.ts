import { beforeEach, describe, expect, it, vi } from "vitest";

const notificationState = vi.hoisted(() => ({
  soundEnabled: true,
}));

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
  });

  it("prepares the notification audio context and preloads the break-over sound", async () => {
    const { audioContext } = installAudioMocks();
    const { prepareNotificationAudio } = await import("@/lib/notifications");

    await prepareNotificationAudio();

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("simple-happy-beep.ogg"),
    );
    expect(audioContext.decodeAudioData).toHaveBeenCalledOnce();
  });

  it("stops the looping break-over chime when acknowledged", async () => {
    const { bufferSource } = installAudioMocks();
    const { sendNotification, stopBreakOverSound } = await import("@/lib/notifications");

    await sendNotification("break-over", "休息结束了。");
    stopBreakOverSound();

    expect(bufferSource.stop).toHaveBeenCalledOnce();
    expect(bufferSource.disconnect).toHaveBeenCalledOnce();
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
});
