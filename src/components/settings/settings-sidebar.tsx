import { cn } from "@/lib/cn";
import type { LucideIcon } from "lucide-react";

export interface SidebarTab {
  id: string;
  label: string;
  icon: LucideIcon;
}

interface SettingsSidebarProps {
  tabs: SidebarTab[];
  activeTab: string;
  onTabChange: (id: string) => void;
}

export function SettingsSidebar({
  tabs,
  activeTab,
  onTabChange,
}: SettingsSidebarProps) {
  return (
    <nav aria-label="设置分组" className="hidden w-40 shrink-0 flex-col gap-0.5 pt-1 md:flex">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onTabChange(tab.id)}
          aria-current={activeTab === tab.id ? "page" : undefined}
          className={cn(
            "flex items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-sahara-focus",
            activeTab === tab.id
              ? "bg-sahara-card font-medium text-sahara-text"
              : "text-sahara-text-secondary hover:bg-sahara-card/70 hover:text-sahara-text",
          )}
        >
          <tab.icon
            className={cn(
              "size-4 shrink-0",
            )}
          />
          <span className="leading-none">
            {tab.label}
          </span>
        </button>
      ))}
    </nav>
  );
}
