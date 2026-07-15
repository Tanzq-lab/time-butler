import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/cn";
import { Moon, Sun, Monitor, Circle, Activity, Check } from "lucide-react";
import type { ThemeMode } from "@/features/settings/settings-types";

const THEME_OPTIONS: { id: ThemeMode; label: string; icon: typeof Sun }[] = [
  { id: "light", label: "浅色", icon: Sun },
  { id: "dark", label: "深色", icon: Moon },
  { id: "system", label: "跟随系统", icon: Monitor },
];

const TIMER_STYLES: { id: "solid" | "zigzag"; label: string; icon: typeof Activity }[] = [
  { id: "solid", label: "平滑", icon: Circle },
  { id: "zigzag", label: "波形", icon: Activity },
];

interface ToggleItem {
  label: string;
  desc: string;
  key: "autoStartBreaks";
}

const TOGGLE_ITEMS: ToggleItem[] = [
  {
    label: "自动开始休息",
    desc: "专注结束后自动进入休息计时",
    key: "autoStartBreaks",
  },
];

interface SettingsGeneralProps {
  currentTheme: ThemeMode;
  onThemeChange: (theme: ThemeMode) => void;
  timerStyle: "solid" | "zigzag";
  onTimerStyleChange: (style: "solid" | "zigzag") => void;
  settings: Record<string, boolean>;
  onToggle: (key: string, value: boolean) => void;
}

export function SettingsGeneralSection({
  currentTheme,
  onThemeChange,
  timerStyle,
  onTimerStyleChange,
  settings,
  onToggle,
}: SettingsGeneralProps) {
  return (
    <section>
      <h3 className="mb-6 text-xl font-semibold text-sahara-text md:text-2xl">
        外观
      </h3>
      <div className="grid grid-cols-3 gap-3 md:gap-4">
        {THEME_OPTIONS.map((theme) => (
          <Button
            key={theme.id}
            variant="outline"
            intent="sahara"
            size="md"
            aria-pressed={currentTheme === theme.id}
            active={currentTheme === theme.id}
            onClick={() => onThemeChange(theme.id)}
            className={cn(
              "relative flex-col gap-2 rounded-md p-3.5 md:gap-3 md:p-5",
              currentTheme === theme.id
                ? ""
                : "border-sahara-border bg-sahara-surface text-sahara-text-muted hover:border-sahara-text-muted",
            )}
          >
            {currentTheme === theme.id && (
              <Check aria-hidden="true" className="absolute right-2 top-2 size-3.5" />
            )}
            <theme.icon className="size-5 md:w-6 md:h-6" />
            <span className="text-xs font-medium">
              {theme.label}
            </span>
          </Button>
        ))}
      </div>

      <div className="mt-12">
        <h3 className="mb-6 text-xl font-semibold text-sahara-text md:text-2xl">
          计时动画样式
        </h3>
        <div className="grid grid-cols-2 gap-3 md:gap-4">
          {TIMER_STYLES.map((style) => (
            <Button
              key={style.id}
              variant="outline"
              intent="sahara"
              size="md"
              aria-pressed={timerStyle === style.id}
              active={timerStyle === style.id}
              onClick={() => onTimerStyleChange(style.id)}
              className={cn(
                "relative flex-col gap-2 rounded-md p-3.5 md:gap-3 md:p-5",
                timerStyle === style.id
                  ? ""
                  : "border-sahara-border bg-sahara-surface text-sahara-text-muted hover:border-sahara-text-muted",
              )}
            >
              {timerStyle === style.id && (
                <Check aria-hidden="true" className="absolute right-2 top-2 size-3.5" />
              )}
              <style.icon className="size-5 md:w-6 md:h-6" />
              <span className="text-xs font-medium">
                {style.label}
              </span>
            </Button>
          ))}
        </div>
      </div>

      <div className="mt-8 space-y-5">
        {TOGGLE_ITEMS.map(({ label, desc, key }) => (
          <div key={key} className="flex items-center justify-between border-t border-sahara-border py-4">
            <div className="flex-1">
              <span className="block text-sm font-medium text-sahara-text">
                {label}
              </span>
              <span className="mt-0.5 block text-xs text-sahara-text-secondary">
                {desc}
              </span>
            </div>
            <Switch
              ariaLabel={label}
              checked={settings[key]}
              onCheckedChange={(v) => onToggle(key, v)}
              className="ml-4"
            />
          </div>
        ))}
      </div>
    </section>
  );
}
