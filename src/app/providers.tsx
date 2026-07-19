import { useEffect, useState, type ReactNode } from "react";
import { initDb } from "@/lib/db";
import { useSettingsStore } from "@/features/settings/use-settings-store";
import { useTaskStore } from "@/features/tasks/use-task-store";
import { useTimerStore } from "@/features/timer/use-timer-store";
import { useNativeUI } from "@/features/system/use-native-ui";
import { useHotkeys } from "@/features/system/use-hotkeys";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { UpdateProvider } from "@/components/providers/update-provider";
import { useNotificationStore } from "@/features/notifications/use-notification-store";
import { LazyMotion, domAnimation } from "framer-motion";
import { TaskOverrunReviewModal } from "@/components/base/task-overrun-review-modal";

interface ProvidersProps {
  children: ReactNode;
}

function useDbInit() {
  const [state, setState] = useState<{ loading: boolean; error: string | null }>({
    loading: true,
    error: null,
  });

  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const loadTasks = useTaskStore((s) => s.loadTasks);
  const checkNotificationPermission = useNotificationStore(
    (s) => s.checkPermission,
  );

  useEffect(() => {
    initDb()
      .then(() => {
        return Promise.all([
          loadSettings(),
          loadTasks(),
          checkNotificationPermission(),
        ]);
      })
      .then(() => {
        const { settings } = useSettingsStore.getState();
        useTimerStore.getState().setDurations(
          settings.workDuration,
          settings.shortBreakDuration,
          settings.longBreakDuration,
        );
        setState({ loading: false, error: null });
      })
      .catch((err) => {
        console.error("[Providers] Failed to initialize database:", err);
        setState({ loading: false, error: String(err) });
      });
  }, [loadSettings, loadTasks, checkNotificationPermission]);

  return state;
}

export function Providers({ children }: ProvidersProps) {
  const { loading, error } = useDbInit();
  useNativeUI();
  useHotkeys();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-sahara-bg">
        <div className="flex flex-col items-center gap-4">
          <div className="size-8 border-2 border-sahara-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium text-sahara-text-secondary">
            加载中…
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-sahara-bg">
        <div className="flex flex-col items-center gap-4 max-w-md text-center">
          <p className="text-red-500 text-sm">数据库初始化失败。</p>
          <p className="text-sahara-text-muted text-xs">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="cursor-pointer rounded-md bg-sahara-primary px-4 py-2 text-xs font-semibold text-sahara-bg"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  return (
    <ThemeProvider>
      <LazyMotion features={domAnimation} strict>
        <UpdateProvider>
          {children}
          <TaskOverrunReviewModal />
        </UpdateProvider>
      </LazyMotion>
    </ThemeProvider>
  );
}
