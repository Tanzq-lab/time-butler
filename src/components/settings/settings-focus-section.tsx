import { useReducer } from "react";
import { Button } from "@/components/ui/button";
import { useSettingsStore } from "@/features/settings/use-settings-store";
import { useTimerStore } from "@/features/timer/use-timer-store";
import { Save } from "lucide-react";

const DURATION_CONFIGS = [
  {
    key: "workMin" as const,
    label: "专注时长",
    desc: "建议用于深度工作的单轮时长。",
    max: 120,
    settingsKey: "workDuration" as const,
  },
  {
    key: "shortBreakMin" as const,
    label: "短休息",
    desc: "快速放松，让注意力恢复。",
    max: 30,
    settingsKey: "shortBreakDuration" as const,
  },
  {
    key: "longBreakMin" as const,
    label: "长休息",
    desc: "完成多轮专注后的较长恢复时间。",
    max: 60,
    settingsKey: "longBreakDuration" as const,
  },
];

interface FocusState {
  workMin: number;
  shortBreakMin: number;
  longBreakMin: number;
}

type FocusAction =
  | { type: "SYNC"; payload: FocusState }
  | { type: "SET_FIELD"; field: keyof FocusState; value: number };

function focusReducer(_state: FocusState, action: FocusAction): FocusState {
  switch (action.type) {
    case "SYNC":
      return action.payload;
    case "SET_FIELD":
      return { ..._state, [action.field]: action.value };
  }
}

export function SettingsFocusSection() {
  const settings = useSettingsStore((s) => s.settings);
  const loaded = useSettingsStore((s) => s.loaded);
  const updateSetting = useSettingsStore((s) => s.updateSetting);

  const setDurations = useTimerStore((s) => s.setDurations);

  const [state, dispatch] = useReducer(focusReducer, {
    workMin: Math.round(settings.workDuration / 60),
    shortBreakMin: Math.round(settings.shortBreakDuration / 60),
    longBreakMin: Math.round(settings.longBreakDuration / 60),
  });

  if (loaded && state.workMin !== Math.round(settings.workDuration / 60)) {
    dispatch({
      type: "SYNC",
      payload: {
        workMin: Math.round(settings.workDuration / 60),
        shortBreakMin: Math.round(settings.shortBreakDuration / 60),
        longBreakMin: Math.round(settings.longBreakDuration / 60),
      },
    });
  }

  const handleSave = async () => {
    if (!loaded) return;
    await Promise.all([
      updateSetting("workDuration", state.workMin * 60),
      updateSetting("shortBreakDuration", state.shortBreakMin * 60),
      updateSetting("longBreakDuration", state.longBreakMin * 60),
    ]);
    setDurations(state.workMin * 60, state.shortBreakMin * 60, state.longBreakMin * 60);
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-6 md:mb-8">
        <h3 className="text-xl font-semibold text-sahara-text md:text-2xl">
          专注节奏
        </h3>
        <Button
          variant="solid"
          intent="sahara"
          size="sm"
          onClick={handleSave}
          className="gap-2"
        >
          <Save className="size-3.5 md:w-4 md:h-4" />
          <span className="hidden sm:inline">
            保存修改
          </span>
        </Button>
      </div>

      <div className="space-y-6 md:space-y-8">
        {DURATION_CONFIGS.map(({ key, label, desc, max }) => (
          <div
            key={key}
            className="group flex flex-col gap-2 border-b border-sahara-border py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
          >
            <div>
              <h4 className="font-semibold text-sahara-text-secondary text-sm">
                {label}
              </h4>
              <p className="text-xs text-sahara-text-muted mt-0.5">{desc}</p>
            </div>
            <div className="flex items-center gap-2 sm:gap-4 self-end sm:self-center">
              <input
                type="number"
                name={`focus-duration-${key}`}
                aria-label={label}
                min={1}
                max={max}
                value={state[key]}
                onChange={(e) =>
                  dispatch({
                    type: "SET_FIELD",
                    field: key,
                    value: Math.min(max, Math.max(1, parseInt(e.target.value, 10) || 1)),
                  })
                }
                className="h-9 w-20 rounded-md border border-sahara-border bg-sahara-surface px-3 text-center font-mono text-sm font-medium tabular-nums text-sahara-text outline-none transition-colors focus:border-sahara-text focus:ring-2 focus:ring-sahara-focus/20"
              />
              <span className="text-xs text-sahara-text-muted">
                分钟
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
