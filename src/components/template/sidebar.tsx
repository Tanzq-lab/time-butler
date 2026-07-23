import { NavLink } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Timer,
  CheckSquare,
  FileText,
  BarChart2,
  Settings,
  Calendar,
  HelpCircle,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { m } from "framer-motion";
import brandMarkUrl from "@/assets/time-butler-brand-icon.png";
import { SidebarTimerStatus } from "@/components/layout/sidebar-timer-status";

const NAV_ITEMS = [
  { path: "/", label: "计时", icon: Timer },
  { path: "/tasks", label: "任务", icon: CheckSquare },
  { path: "/notes", label: "记录", icon: FileText },
  { path: "/calendar", label: "日历", icon: Calendar },
  { path: "/analytics", label: "分析", icon: BarChart2 },
] as const;

interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export function Sidebar({ isCollapsed, onToggleCollapse }: SidebarProps) {
  return (
    <m.aside
      initial={{ x: -300, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -300, opacity: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className={cn(
        "relative z-10 hidden shrink-0 flex-col border-r border-sahara-border bg-sahara-card pb-4 md:flex",
        isCollapsed ? "w-16" : "w-56",
      )}
    >
      <div className="h-8 shrink-0" data-tauri-drag-region />

      <Button
        variant="ghost"
        size="icon"
        intent="default"
        onClick={onToggleCollapse}
        aria-label={isCollapsed ? "展开侧边栏" : "收起侧边栏"}
        aria-expanded={!isCollapsed}
        className="group absolute -right-4 top-10 z-50 size-8 touch-manipulation rounded-md border border-sahara-border bg-sahara-surface text-sahara-text-secondary hover:bg-sahara-card hover:text-sahara-text"
      >
        {isCollapsed ? (
          <ChevronsRight aria-hidden="true" className="size-4" strokeWidth={2.1} />
        ) : (
          <ChevronsLeft aria-hidden="true" className="size-4" strokeWidth={2.1} />
        )}
        <span
          role="tooltip"
          aria-hidden="true"
          className="pointer-events-none invisible absolute left-full top-1/2 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md border border-sahara-border bg-sahara-surface px-2 py-1 text-xs font-normal text-sahara-text opacity-0 shadow-sm transition-opacity duration-150 group-hover:visible group-hover:opacity-100 group-focus-visible:visible group-focus-visible:opacity-100 motion-reduce:transition-none"
        >
          {isCollapsed ? "展开侧边栏" : "收起侧边栏"}
        </span>
      </Button>

      <div
        className={cn(
          "mb-6 flex h-10 items-center",
          isCollapsed ? "justify-center px-3" : "gap-2.5 px-4",
        )}
      >
        <img
          src={brandMarkUrl}
          alt=""
          aria-hidden="true"
          width="32"
          height="32"
          className="size-8 shrink-0 rounded-[7px]"
        />
        {!isCollapsed && (
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold text-sahara-text">Time Butler</h1>
            <p className="truncate text-xs text-sahara-text-secondary">专注工作台</p>
          </div>
        )}
      </div>

      <nav aria-label="主要导航" className="flex-1 space-y-0.5 px-2">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              title={isCollapsed ? item.label : undefined}
              to={item.path}
              end={item.path === "/"}
              className={({ isActive }) => cn(
                "group flex h-9 items-center rounded-md text-sm outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-sahara-focus focus-visible:ring-offset-2 focus-visible:ring-offset-sahara-card",
                isCollapsed ? "justify-center px-2" : "gap-3 px-2.5",
                isActive
                  ? "bg-sahara-surface text-sahara-text shadow-[inset_0_0_0_1px_var(--color-sahara-border)]"
                  : "text-sahara-text-secondary hover:bg-sahara-surface/70 hover:text-sahara-text",
              )}
            >
              <Icon aria-hidden="true" className="size-4 shrink-0" strokeWidth={1.8} />
              {!isCollapsed && (
                <span className="truncate">{item.label}</span>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="mb-4 px-2">
        <SidebarTimerStatus isCollapsed={isCollapsed} />
      </div>

      <nav aria-label="辅助导航" className="space-y-0.5 border-t border-sahara-border px-2 pt-3">
        <NavLink
          to="/onboarding"
          title={isCollapsed ? "帮助" : undefined}
          className={({ isActive }) => cn(
            "flex h-9 items-center rounded-md text-sm outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-sahara-focus",
            isCollapsed ? "justify-center px-2" : "gap-3 px-2.5",
            isActive ? "bg-sahara-surface text-sahara-text" : "text-sahara-text-secondary hover:bg-sahara-surface/70 hover:text-sahara-text",
          )}
        >
          <HelpCircle aria-hidden="true" className="size-4 shrink-0" strokeWidth={1.8} />
          {!isCollapsed && <span>帮助</span>}
        </NavLink>
        <NavLink
          to="/settings"
          title={isCollapsed ? "设置" : undefined}
          className={({ isActive }) => cn(
            "flex h-9 items-center rounded-md text-sm outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-sahara-focus",
            isCollapsed ? "justify-center px-2" : "gap-3 px-2.5",
            isActive ? "bg-sahara-surface text-sahara-text" : "text-sahara-text-secondary hover:bg-sahara-surface/70 hover:text-sahara-text",
          )}
        >
          <Settings aria-hidden="true" className="size-4 shrink-0" strokeWidth={1.8} />
          {!isCollapsed && <span>设置</span>}
        </NavLink>
      </nav>
    </m.aside>
  );
}
