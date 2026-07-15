import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Timer,
  CheckSquare,
  FileText,
  BarChart2,
  Settings,
  Calendar,
  HelpCircle,
  MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { ModalOverlay } from "@/components/ui/modal-overlay";

const PRIMARY_NAV_ITEMS = [
  { path: "/", label: "计时", icon: Timer },
  { path: "/tasks", label: "任务", icon: CheckSquare },
  { path: "/notes", label: "记录", icon: FileText },
  { path: "/calendar", label: "日历", icon: Calendar },
] as const;

const MORE_NAV_ITEMS = [
  { path: "/analytics", label: "分析", description: "查看专注趋势与复盘", icon: BarChart2 },
  { path: "/settings", label: "设置", description: "调整主题、节奏与通知", icon: Settings },
  { path: "/onboarding", label: "帮助", description: "重新查看使用引导", icon: HelpCircle },
] as const;

export function MobileNav() {
  const [moreOpen, setMoreOpen] = useState(false);
  const location = useLocation();
  const isMoreActive = MORE_NAV_ITEMS.some((item) => item.path === location.pathname);

  return (
    <>
      <nav
        aria-label="移动端导航"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-sahara-border bg-sahara-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
      >
        <div className="mx-auto grid max-w-lg grid-cols-5">
          {PRIMARY_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === "/"}
                aria-label={item.label}
                className={({ isActive }) => cn(
                  "flex min-w-0 flex-col items-center gap-0.5 rounded-md px-1 py-2 text-[10px] outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-sahara-focus",
                  isActive
                    ? "text-sahara-text"
                    : "text-sahara-text-secondary hover:text-sahara-text",
                )}
              >
                <Icon aria-hidden="true" className="size-5" strokeWidth={1.8} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}

          <button
            type="button"
            aria-label="更多导航"
            aria-expanded={moreOpen}
            aria-current={isMoreActive ? "page" : undefined}
            onClick={() => setMoreOpen(true)}
            className={cn(
              "flex min-w-0 flex-col items-center gap-0.5 rounded-md px-1 py-2 text-[10px] outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-sahara-focus",
              isMoreActive
                ? "text-sahara-text"
                : "text-sahara-text-secondary hover:text-sahara-text",
            )}
          >
            <MoreHorizontal aria-hidden="true" className="size-5" strokeWidth={1.8} />
            <span>更多</span>
          </button>
        </div>
      </nav>

      <ModalOverlay
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        placement="bottom"
        maxWidth="max-w-md"
        ariaLabel="更多导航"
        showCloseButton
      >
        <div className="px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-5">
          <h2 className="pr-10 text-base font-semibold text-sahara-text">更多</h2>
          <nav aria-label="更多页面" className="mt-4 space-y-1">
            {MORE_NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setMoreOpen(false)}
                  className={({ isActive }) => cn(
                    "flex items-center gap-3 rounded-md px-3 py-3 outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-sahara-focus",
                    isActive
                      ? "bg-sahara-card text-sahara-text"
                      : "text-sahara-text-secondary hover:bg-sahara-card hover:text-sahara-text",
                  )}
                >
                  <Icon aria-hidden="true" className="size-5 shrink-0" />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{item.label}</span>
                    <span className="block text-xs text-sahara-text-muted">{item.description}</span>
                  </span>
                </NavLink>
              );
            })}
          </nav>
        </div>
      </ModalOverlay>
    </>
  );
}
