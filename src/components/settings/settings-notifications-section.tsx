import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/cn";
import {
  Bell,
  CheckCircle2,
  XCircle,
  Volume2,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { sendNotification } from "@/lib/notifications";

interface NotificationStatus {
  status: "granted" | "denied" | "unknown" | "unavailable";
  checking: boolean;
  error: string | null;
}

interface SettingsNotificationsProps {
  notifStatus: NotificationStatus;
  requestPermission: () => void;
  soundEnabled: boolean;
  onSoundToggle: (v: boolean) => void;
}

export function SettingsNotifications({
  notifStatus,
  requestPermission,
  soundEnabled,
  onSoundToggle,
}: SettingsNotificationsProps) {
  const [testing, setTesting] = useState(false);

  const handleTestNotification = async () => {
    setTesting(true);
    try {
      await sendNotification(
        "session-complete",
        "这是一条测试通知。",
        { trigger: "settings_test" },
      );
    } finally {
      setTimeout(() => setTesting(false), 2000);
    }
  };

  const openSystemPreferences = () => {
    try {
      window.open(
        "x-apple.systempreferences:com.apple.preference.notifications",
        "_blank",
      );
    } catch {}
  };

  const { status, checking, error } = notifStatus;

  return (
    <section>
      <h3 className="mb-6 text-xl font-semibold text-sahara-text md:text-2xl">
        通知与声音
      </h3>

      <div className="mb-6 border-y border-sahara-border py-5">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <Bell className="size-4 shrink-0 text-sahara-text-secondary md:size-5" />
            <div>
              <h4 className="text-sm font-medium text-sahara-text-secondary">
                系统通知
              </h4>
              <p className="text-[10px] md:text-[11px] text-sahara-text-muted mt-0.5">
                计时结束时发送 macOS 桌面通知
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 self-start">
            {checking && (
              <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-sahara-text md:text-[11px]">
                <Loader2 className="size-3 md:w-3.5 md:h-3.5 animate-spin" />
                请求中…
              </span>
            )}
            {!checking && status === "granted" && (
              <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-green-600 md:text-[11px]">
                <CheckCircle2 className="size-3 md:w-3.5 md:h-3.5" />
                已开启
              </span>
            )}
            {!checking && status === "denied" && (
              <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-red-500 md:text-[11px]">
                <XCircle className="size-3 md:w-3.5 md:h-3.5" />
                已关闭
              </span>
            )}
            {!checking && status === "unknown" && (
              <span className="text-[10px] font-medium text-sahara-text-secondary md:text-[11px]">
                未检查
              </span>
            )}
            {!checking && status === "unavailable" && (
              <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-amber-600 md:text-[11px]">
                浏览器模式
              </span>
            )}
          </div>
        </div>

        {error && status !== "unavailable" && (
          <div className="mb-3 px-3 py-2 rounded-lg bg-red-50 border border-red-200/50 text-red-600 text-[10px] md:text-[11px]">
            错误：{error}
          </div>
        )}

        {status === "unavailable" && (
          <div className="mb-3 rounded-[10px] border border-amber-200/40 bg-amber-50 px-3 py-2.5 text-[10px] leading-relaxed text-amber-700 md:px-4 md:py-3 md:text-[11px]">
            通知功能需要 Tauri 桌面应用。你现在运行的是浏览器开发模式。请运行{" "}
            <code className="font-mono bg-amber-100 px-1.5 py-0.5 rounded text-[9px] md:text-[10px]">
              npm run tauri dev
            </code>{" "}
            以启用原生 macOS 通知。
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          {(status === "denied" || status === "unknown") && (
            <Button
              variant="solid"
              intent="sahara"
              size="sm"
              onClick={() => requestPermission()}
              disabled={checking}
              className="gap-2 text-[10px] md:text-[11px] tracking-wider"
            >
              {checking ? (
                <Loader2 className="size-3 md:w-3.5 md:h-3.5 animate-spin" />
              ) : (
                <Bell className="size-3 md:w-3.5 md:h-3.5" />
              )}
              {checking ? "请求中…" : "开启通知"}
            </Button>
          )}

          <Button
            variant="outline"
            intent={testing ? "green" : "default"}
            size="sm"
            disabled={testing || status !== "granted"}
            onClick={handleTestNotification}
            className={cn(
              "gap-2 text-[10px] md:text-[11px] tracking-wider",
              !testing && status !== "granted" && "opacity-40",
            )}
          >
            <Volume2 className="size-3 md:w-3.5 md:h-3.5" />
            {testing ? "已发送！" : "测试通知"}
          </Button>

          {status === "denied" && !checking && (
            <Button
              variant="outline"
              intent="sahara"
              size="xs"
              onClick={openSystemPreferences}
              className="gap-1.5 text-[10px] md:text-[11px] font-medium"
            >
              <ExternalLink className="size-2.5 md:w-3 md:h-3" />
              打开设置
            </Button>
          )}
        </div>

        {status === "denied" && !checking && (
          <p className="mt-3 text-[10px] md:text-[11px] text-sahara-text-muted leading-relaxed">
            Time Butler 需要通知权限才能提醒你。点击上方
            <strong>“开启通知”</strong> 触发 macOS 权限弹窗，或者手动打开
            <strong>系统设置 → 通知</strong>，在列表里找到
            <em>Time Butler</em>。
          </p>
        )}
      </div>

      <div className="space-y-5">
        <div className="flex items-center justify-between border-b border-sahara-border py-4">
          <div>
            <span className="block text-sm font-medium text-sahara-text-secondary">
              结束提示音
            </span>
            <span className="text-[11px] text-sahara-text-muted mt-0.5 block">
              计时完成时播放提示音
            </span>
          </div>
          <Switch
            ariaLabel="结束提示音"
            checked={soundEnabled}
            onCheckedChange={onSoundToggle}
            className="ml-4"
          />
        </div>
      </div>
    </section>
  );
}
