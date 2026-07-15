import { useSettingsStore } from "@/features/settings/use-settings-store";
import { useTimerStore } from "@/features/timer/use-timer-store";
import { SliderField } from "@/components/base/slider-field";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";

export function SettingsPanel() {
  const settings = useSettingsStore((s) => s.settings);
  const updateSetting = useSettingsStore((s) => s.updateSetting);
  const setDurations = useTimerStore((s) => s.setDurations);

  const handleDurationChange = async (
    key: "workDuration" | "shortBreakDuration" | "longBreakDuration",
    value: number
  ) => {
    await updateSetting(key, value);
    const s = useSettingsStore.getState().settings;
    setDurations(s.workDuration, s.shortBreakDuration, s.longBreakDuration);
  };

  const formatMin = (sec: number) => `${Math.round(sec / 60)} 分钟`;

  return (
    <div className="flex flex-col gap-6 py-4">
      <Text variant="h2">设置</Text>

      <div className="flex flex-col gap-5">
        <Text variant="h3">计时器</Text>
        <SliderField
          label="专注时长"
          value={settings.workDuration}
          min={60}
          max={3600}
          step={60}
          onChange={(v) => handleDurationChange("workDuration", v)}
          formatValue={formatMin}
        />
        <SliderField
          label="短休息"
          value={settings.shortBreakDuration}
          min={60}
          max={1800}
          step={60}
          onChange={(v) => handleDurationChange("shortBreakDuration", v)}
          formatValue={formatMin}
        />
        <SliderField
          label="长休息"
          value={settings.longBreakDuration}
          min={60}
          max={3600}
          step={60}
          onChange={(v) => handleDurationChange("longBreakDuration", v)}
          formatValue={formatMin}
        />
      </div>

      <div className="flex flex-col gap-4">
        <Text variant="h3">行为</Text>
        <div className="flex items-center justify-between">
          <Text variant="body">自动开始休息</Text>
          <Switch
            ariaLabel="自动开始休息"
            checked={settings.autoStartBreaks}
            onCheckedChange={(v) => updateSetting("autoStartBreaks", v)}
          />
        </div>
        <div className="flex items-center justify-between">
          <Text variant="body">声音提醒</Text>
          <Switch
            ariaLabel="声音提醒"
            checked={settings.soundEnabled}
            onCheckedChange={(v) => updateSetting("soundEnabled", v)}
          />
        </div>
      </div>
    </div>
  );
}
