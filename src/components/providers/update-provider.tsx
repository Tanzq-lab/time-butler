import { useEffect, useState, useCallback, useRef, type ReactNode } from "react";
import type { Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { isTauri } from "@/lib/tauri";
import { X, Download, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const RECHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

interface UpdateProviderProps {
  children: ReactNode;
}

export function UpdateProvider({ children }: UpdateProviderProps) {
  const [pendingUpdate, setPendingUpdate] = useState<Update | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [installError, setInstallError] = useState<string | null>(null);
  const dismissedRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkForUpdate = useCallback(async (): Promise<boolean> => {
    try {
      const { check } = await import("@tauri-apps/plugin-updater");
      const result = await check();
      if (result) {
        setPendingUpdate(result);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        return true;
      }
    } catch (err) {
      console.debug("[UpdateProvider] Check failed (expected in dev):", err);
    }
    return false;
  }, []);

  useEffect(() => {
    if (!isTauri()) return;

    let cancelled = false;

    const timer = setTimeout(async () => {
      if (cancelled) return;
      const found = await checkForUpdate();
      if (!cancelled && !found) {
        intervalRef.current = setInterval(checkForUpdate, RECHECK_INTERVAL_MS);
      }
    }, 5000);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [checkForUpdate]);

  const handleInstall = useCallback(async () => {
    if (!pendingUpdate) return;
    setDownloading(true);
    setInstallError(null);
    try {
      await pendingUpdate.downloadAndInstall((event) => {
        switch (event.event) {
          case "Started":
            console.log(
              `[Update] Downloading ${event.data.contentLength} bytes...`,
            );
            break;
          case "Finished":
            console.log("[Update] Download complete");
            break;
        }
      });

      await relaunch();
    } catch (err) {
      console.error("[UpdateProvider] Install failed:", err);
      setInstallError(String(err));
      setDownloading(false);
    }
  }, [pendingUpdate]);

  const handleDismiss = () => {
    dismissedRef.current = true;
    setPendingUpdate(null);
  };

  if (!pendingUpdate || dismissedRef.current) return <>{children}</>;

  return (
    <>
      {children}

      <div className="fixed bottom-4 right-4 z-200 max-w-sm animate-in slide-in-from-right-4 fade-in duration-300">
        <div className="space-y-4 rounded-[10px] border border-sahara-border bg-sahara-surface p-5 shadow-xl">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="size-8 rounded-full bg-sahara-primary-light flex items-center justify-center">
                <Download className="size-4 text-sahara-primary" />
              </div>
              <div>
                <p className="text-sm font-bold text-sahara-text">
                  发现新版本
                </p>
                <p className="text-[11px] text-sahara-text-muted">
                  v{pendingUpdate.version}
                </p>
              </div>
            </div>
            <button
              onClick={handleDismiss}
              aria-label="忽略更新"
              className="p-1 rounded-lg text-sahara-text-muted hover:text-sahara-text hover:bg-sahara-card transition-colors cursor-pointer"
            >
              <X className="size-4" />
            </button>
          </div>

          {pendingUpdate.body && (
            <p className="text-xs text-sahara-text-secondary leading-relaxed line-clamp-3">
              {pendingUpdate.body}
            </p>
          )}

          {installError && (
            <div className="flex items-start gap-2 rounded-[10px] border border-red-500/20 bg-red-500/10 p-2.5">
              <AlertCircle className="size-3.5 text-red-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-red-400 leading-relaxed">
                更新失败。请重试，或前往 GitHub 手动下载。
              </p>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button
              variant="solid"
              intent="sahara"
              size="sm"
              shape="rounded-xl"
              onClick={handleInstall}
              disabled={downloading}
              className="gap-1.5 text-[10px] flex-1"
            >
              <Download className="size-3" />
              {downloading ? "下载中…" : installError ? "重试更新" : "安装更新"}
            </Button>
            <Button
              variant="outline"
              intent="default"
              size="sm"
              shape="rounded-xl"
              onClick={handleDismiss}
              className="text-[10px]"
            >
              稍后
            </Button>
          </div>

          <p className="text-[9px] text-sahara-text-muted text-center">
            安装完成后应用会自动重启
          </p>
        </div>
      </div>
    </>
  );
}
