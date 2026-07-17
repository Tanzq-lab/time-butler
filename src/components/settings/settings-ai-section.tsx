import { useEffect, useState } from "react";
import { KeyRound, Save, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Switch } from "@/components/ui/switch";
import {
  clearAiApiKey,
  getAiApiKeyStatus,
  saveAiApiKey,
} from "@/lib/ai-category";
import { recordAppEvent } from "@/lib/db";

interface SettingsAiSectionProps {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void | Promise<void>;
}

type KeyState = "loading" | "configured" | "missing" | "error";

function keyErrorMessage(error: unknown): string {
  const code = String(error);
  if (code.includes("invalid_api_key_format")) {
    return "密钥格式不正确，请检查后重试。";
  }
  if (code.includes("api_key_write_failed")) {
    return "无法写入本地数据目录，请检查文件权限。";
  }
  return "密钥保存失败，请稍后重试。";
}

export function SettingsAiSection({
  enabled,
  onEnabledChange,
}: SettingsAiSectionProps) {
  const [keyState, setKeyState] = useState<KeyState>("loading");
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  useEffect(() => {
    let active = true;
    getAiApiKeyStatus()
      .then((status) => {
        if (active) setKeyState(status.configured ? "configured" : "missing");
      })
      .catch(() => {
        if (active) setKeyState("error");
      });
    return () => {
      active = false;
    };
  }, []);

  const handleSave = async () => {
    if (!apiKey.trim() || saving) return;
    setSaving(true);
    setMessage(null);
    try {
      await saveAiApiKey(apiKey.trim());
      await onEnabledChange(true);
      setApiKey("");
      setKeyState("configured");
      setMessage("密钥已保存在本地，AI 自动分类已启用。");
      void recordAppEvent({
        eventName: "ai_api_key_saved",
        route: "/settings",
        metadata: { autoCategorizationEnabled: true },
      });
    } catch (error) {
      setMessage(keyErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await clearAiApiKey();
      await onEnabledChange(false);
      setApiKey("");
      setKeyState("missing");
      setShowClearConfirm(false);
      setMessage("本地密钥已清除，AI 自动分类已关闭。");
      void recordAppEvent({
        eventName: "ai_api_key_cleared",
        route: "/settings",
      });
    } catch {
      setMessage("无法清除本地密钥，请检查数据目录权限。");
    } finally {
      setSaving(false);
    }
  };

  const handleEnabledChange = async (nextEnabled: boolean) => {
    await onEnabledChange(nextEnabled);
    void recordAppEvent({
      eventName: "ai_auto_categorization_toggled",
      route: "/settings",
      metadata: { enabled: nextEnabled },
    });
  };

  const configured = keyState === "configured";

  return (
    <section>
      <ConfirmDialog
        open={showClearConfirm}
        title="清除 OpenAI API 密钥？"
        description="AI 自动分类会同时关闭；以后可以重新录入密钥。"
        confirmLabel="清除密钥"
        destructive
        busy={saving}
        onClose={() => setShowClearConfirm(false)}
        onConfirm={handleClear}
      />

      <div className="mb-6 flex items-start gap-3 md:mb-8">
        <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md bg-sahara-card text-sahara-text-secondary">
          <Sparkles className="size-4.5" />
        </div>
        <div>
          <h3 className="text-xl font-semibold text-sahara-text md:text-2xl">
            AI 自动分类
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-sahara-text-muted">
            新建任务且未手动选分类时，从你已有的番茄分类中自动选择。
          </p>
        </div>
      </div>

      <div className="space-y-6">
        <div className="rounded-md border border-sahara-border bg-sahara-card/35 p-4 md:p-5">
          <div className="flex items-start gap-3">
            <KeyRound className="mt-0.5 size-4 shrink-0 text-sahara-text-muted" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label
                  htmlFor="openai-api-key"
                  className="text-sm font-semibold text-sahara-text"
                >
                  OpenAI API 密钥
                </label>
                <span
                  className={`text-[11px] font-medium ${
                    configured ? "text-[#2f7d4e]" : "text-sahara-text-muted"
                  }`}
                >
                  {keyState === "loading"
                    ? "检查中…"
                    : configured
                      ? "已配置 · 不会回显"
                      : keyState === "error"
                        ? "状态读取失败"
                        : "尚未配置"}
                </span>
              </div>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  id="openai-api-key"
                  type="password"
                  name="openai-api-key"
                  autoComplete="new-password"
                  spellCheck={false}
                  value={apiKey}
                  onChange={(event) => {
                    setApiKey(event.target.value);
                    setMessage(null);
                  }}
                  placeholder={configured ? "输入新密钥可替换现有密钥" : "sk-…"}
                  className="h-10 min-w-0 flex-1 rounded-md border border-sahara-border bg-sahara-surface px-3 font-mono text-sm text-sahara-text outline-none placeholder:font-sans placeholder:text-sahara-text-muted focus:border-sahara-text focus:ring-2 focus:ring-sahara-focus/20"
                />
                <Button
                  type="button"
                  variant="solid"
                  intent="sahara"
                  size="sm"
                  disabled={!apiKey.trim() || saving}
                  onClick={handleSave}
                  className="h-10 gap-2"
                >
                  <Save className="size-3.5" />
                  {saving ? "保存中…" : configured ? "替换密钥" : "保存并启用"}
                </Button>
              </div>
              {message && (
                <p aria-live="polite" className="mt-2 text-xs text-sahara-text-secondary">
                  {message}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-y border-sahara-border py-4">
          <div className="pr-4">
            <span className="block text-sm font-medium text-sahara-text">
              自动判断新任务分类
            </span>
            <span className="mt-0.5 block text-xs leading-relaxed text-sahara-text-secondary">
              人工选择始终优先；AI 失败时回退到本地规则并继续创建。
            </span>
          </div>
          <Switch
            ariaLabel="自动判断新任务分类"
            checked={enabled && configured}
            disabled={!configured || saving}
            onCheckedChange={handleEnabledChange}
          />
        </div>

        <div className="rounded-md border border-sahara-border/70 px-4 py-3 text-xs leading-relaxed text-sahara-text-muted">
          仅在自动分类时发送任务名称、项目名和候选分类名称。不会发送任务历史、番茄记录、笔记或 API 密钥；请求关闭 OpenAI 响应存储。
        </div>

        {configured && (
          <Button
            type="button"
            variant="outline"
            intent="red"
            size="sm"
            disabled={saving}
            onClick={() => setShowClearConfirm(true)}
            className="gap-2"
          >
            <Trash2 className="size-3.5" />
            清除本地密钥
          </Button>
        )}
      </div>
    </section>
  );
}
