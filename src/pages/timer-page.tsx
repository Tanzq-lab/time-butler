import { MainLayout } from "@/components/template/main-layout";
import { TimerControls } from "@/components/containers/timer-controls";
import { TodayFocus } from "@/components/containers/today-focus";
import { TodaySessions } from "@/components/containers/today-sessions";
import { useUIStore } from "@/features/ui/use-ui-store";
import { m, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/cn";
import { SectionHeader } from "@/components/ui/page-header";

export function TimerPage() {
  const isFullscreenFocus = useUIStore((s) => s.isFullscreenFocus);

  return (
    <MainLayout>
      <m.div
        layout
        transition={{ duration: 0.18, ease: "easeOut" }}
        className={cn(
          "mx-auto flex min-h-full w-full max-w-5xl flex-col items-center gap-8 px-4 py-5 sm:px-6 md:px-10 md:py-8",
          isFullscreenFocus ? "justify-center h-full overflow-hidden" : "justify-start"
        )}
      >
        <TimerControls />

        <AnimatePresence mode="popLayout">
          {!isFullscreenFocus && (
            <m.div
              key="stats-section"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.18 }}
              className="w-full border-t border-sahara-border pt-7 md:pt-9"
            >
              <SectionHeader title="今日专注" description="今天的专注进度与正在推进的任务" />
              <TodayFocus />
              <div className="mt-8">
                <TodaySessions />
              </div>
            </m.div>
          )}
        </AnimatePresence>
      </m.div>
    </MainLayout>
  );
}
