import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import type { SidebarTab } from "./settings-sidebar";

interface SettingsMobileTabsProps {
  tabs: SidebarTab[];
  activeTab: string;
  onTabChange: (id: string) => void;
}

export function SettingsMobileTabs({
  tabs,
  activeTab,
  onTabChange,
}: SettingsMobileTabsProps) {
  const activeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    activeButtonRef.current?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [activeTab]);

  return (
    <div className="relative mb-6 md:hidden">
      <div
        role="tablist"
        aria-label="设置分组"
        className="overflow-x-auto pr-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
      <div className="flex min-w-max gap-2 pb-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            ref={activeTab === tab.id ? activeButtonRef : undefined}
            type="button"
            role="tab"
            onClick={() => onTabChange(tab.id)}
            aria-selected={activeTab === tab.id}
            className={cn(
              "flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-md border px-3 py-2 text-xs outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-sahara-focus",
              activeTab === tab.id
                ? "border-sahara-text-muted/45 bg-sahara-card font-medium text-sahara-text"
                : "border-sahara-border bg-sahara-surface text-sahara-text-secondary hover:bg-sahara-card hover:text-sahara-text",
            )}
          >
            <tab.icon className="size-3.5" />
            {tab.label}
          </button>
        ))}
      </div>
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-sahara-bg via-sahara-bg/90 to-transparent"
      />
    </div>
  );
}
