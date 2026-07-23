import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Minimize2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { useUIStore } from "@/features/ui/use-ui-store";
import { useScrollMemory } from "@/hooks/use-scroll-memory";
import { m, AnimatePresence } from "framer-motion";
import { useLocation } from "react-router-dom";
import { Sidebar } from "./sidebar";
import { MobileNav } from "./mobile-nav";

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(min-width: 768px) and (max-width: 1023px)").matches
      : false,
  );
  const isFullscreenFocus = useUIStore((s) => s.isFullscreenFocus);
  const mainScrollRef = useScrollMemory<HTMLElement>(
    `page:${location.pathname}${location.search}`,
  );

  useEffect(() => {
    const compactDesktop = window.matchMedia(
      "(min-width: 768px) and (max-width: 1023px)",
    );
    const handleChange = (event: MediaQueryListEvent) => {
      if (event.matches) setIsCollapsed(true);
    };
    compactDesktop.addEventListener("change", handleChange);
    return () => compactDesktop.removeEventListener("change", handleChange);
  }, []);

  return (
    <div className="flex h-dvh overflow-hidden bg-sahara-bg font-sans text-sahara-text">
      <a
        href="#main-content"
        className="fixed left-3 top-3 z-[100] -translate-y-20 rounded-md bg-sahara-primary px-3 py-2 text-sm font-medium text-sahara-bg transition-transform focus:translate-y-0"
      >
        跳到主要内容
      </a>
      <AnimatePresence initial={false} mode="popLayout">
        {!isFullscreenFocus && (
          <Sidebar
            isCollapsed={isCollapsed}
            onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
          />
        )}
      </AnimatePresence>

      <m.div
        layout
        transition={{ duration: 0.18, ease: "easeOut" }}
        className="flex-1 flex flex-col relative overflow-hidden min-w-0"
      >
        <div
          className="h-8 flex items-center justify-between pl-4 md:pl-8 pr-4 shrink-0"
          data-tauri-drag-region
        />

        <main
          ref={mainScrollRef}
          id="main-content"
          tabIndex={-1}
          data-scroll-memory-key={`page:${location.pathname}${location.search}`}
          className={cn(
            "flex-1 pb-20 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sahara-focus md:pb-0",
            isFullscreenFocus ? "overflow-hidden" : "overflow-y-auto",
          )}
        >
          {children}
        </main>

        <AnimatePresence>
          {isFullscreenFocus && (
            <m.div
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 20 }}
              className="absolute bottom-8 right-8 z-50"
            >
              <Button
                variant="outline"
                size="icon-lg"
                intent="default"
                shape="rounded-full"
                onClick={() => useUIStore.getState().setFullscreenFocus(false)}
                aria-label="退出专注模式"
                className="group border-sahara-border bg-sahara-surface/90 shadow-lg backdrop-blur-md hover:text-sahara-text"
                title="退出专注模式"
              >
                <Minimize2 className="size-5" />
              </Button>
            </m.div>
          )}
        </AnimatePresence>

        {!isFullscreenFocus && <MobileNav />}
      </m.div>
    </div>
  );
}
