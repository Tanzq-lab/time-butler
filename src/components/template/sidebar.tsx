import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Timer,
  CheckSquare,
  FileText,
  BarChart2,
  Settings,
  Calendar,
  HelpCircle,
  PanelLeftClose,
  PanelLeftOpen,
  Play,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { useTimerStore } from "@/features/timer/use-timer-store";
import { m } from "framer-motion";
import brandMarkUrl from "@/assets/time-butler-brand-icon.png";

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
  const location = useLocation();
  const navigate = useNavigate();
  const status = useTimerStore((s) => s.status);
  const phase = useTimerStore((s) => s.phase);
  const start = useTimerStore((s) => s.start);
  const isRunning = status === "running";
  const idleStartLabel = phase === "work" ? "开始专注" : "开始休息";
  const runningLabel = phase === "work" ? "专注进行中" : "休息进行中";

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
        className="absolute -right-3 top-10 z-50 size-6 rounded-md border border-sahara-border bg-sahara-surface text-sahara-text-muted hover:text-sahara-text"
      >
        {isCollapsed ? (
          <PanelLeftOpen className="size-3.5" />
        ) : (
          <PanelLeftClose className="size-3.5" />
        )}
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
        <Button
          variant="outline"
          intent="default"
          fullWidth
          disabled={isRunning}
          onClick={() => {
            if (location.pathname !== "/") {
              navigate("/");
            }
            void start(undefined, { source: "sidebar" });
          }}
          title={
            isCollapsed
              ? isRunning
                ? runningLabel
                : idleStartLabel
              : undefined
          }
          className={cn(
            "h-9 border-sahara-border bg-sahara-surface text-xs font-medium text-sahara-text hover:bg-sahara-card",
            isCollapsed ? "px-0" : "gap-2 px-3",
            isRunning && "cursor-not-allowed opacity-50",
          )}
        >
          <Play
            className={cn(
              "size-4 fill-current",
              !isCollapsed && "ml-0.5",
            )}
          />
          {!isCollapsed && (
            <span>{isRunning ? runningLabel : idleStartLabel}</span>
          )}
        </Button>
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
