import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsAiSection } from "@/components/settings/settings-ai-section";

const {
  getAiApiKeyStatusMock,
  saveAiApiKeyMock,
  clearAiApiKeyMock,
  recordAppEventMock,
} = vi.hoisted(() => ({
  getAiApiKeyStatusMock: vi.fn(),
  saveAiApiKeyMock: vi.fn(),
  clearAiApiKeyMock: vi.fn(),
  recordAppEventMock: vi.fn(),
}));

vi.mock("@/lib/ai-category", () => ({
  getAiApiKeyStatus: getAiApiKeyStatusMock,
  saveAiApiKey: saveAiApiKeyMock,
  clearAiApiKey: clearAiApiKeyMock,
}));

vi.mock("@/lib/db", () => ({
  recordAppEvent: recordAppEventMock,
}));

describe("SettingsAiSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAiApiKeyStatusMock.mockResolvedValue({ configured: false });
    saveAiApiKeyMock.mockResolvedValue({ configured: true });
    clearAiApiKeyMock.mockResolvedValue({ configured: false });
    recordAppEventMock.mockResolvedValue(undefined);
  });

  it("saves a key without displaying it again and enables categorization", async () => {
    const onEnabledChange = vi.fn().mockResolvedValue(undefined);
    render(
      <SettingsAiSection
        enabled={false}
        onEnabledChange={onEnabledChange}
      />,
    );

    await screen.findByText("尚未配置");
    fireEvent.change(screen.getByLabelText("OpenAI API 密钥"), {
      target: { value: "sk-proj-example-secret-value" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存并启用" }));

    await waitFor(() => {
      expect(saveAiApiKeyMock).toHaveBeenCalledWith(
        "sk-proj-example-secret-value",
      );
    });
    expect(onEnabledChange).toHaveBeenCalledWith(true);
    expect(screen.getByLabelText("OpenAI API 密钥")).toHaveValue("");
    expect(await screen.findByText("已配置 · 不会回显")).toBeVisible();
  });

  it("clears the local key and disables categorization after confirmation", async () => {
    getAiApiKeyStatusMock.mockResolvedValueOnce({ configured: true });
    const onEnabledChange = vi.fn().mockResolvedValue(undefined);
    render(
      <SettingsAiSection
        enabled
        onEnabledChange={onEnabledChange}
      />,
    );

    await screen.findByText("已配置 · 不会回显");
    fireEvent.click(screen.getByRole("button", { name: "清除本地密钥" }));
    fireEvent.click(screen.getByRole("button", { name: "清除密钥" }));

    await waitFor(() => expect(clearAiApiKeyMock).toHaveBeenCalledTimes(1));
    expect(onEnabledChange).toHaveBeenCalledWith(false);
    expect(await screen.findByText("尚未配置")).toBeVisible();
  });
});
