import {
  useReducer,
  useEffect,
} from "react";
import type React from "react";
import { Edit3, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import type { Task } from "@/features/tasks/task-types";

const POMODORO_OPTIONS = [1, 2, 3, 4] as const;
type PomodoroEstimate = (typeof POMODORO_OPTIONS)[number];

export interface AddTaskData {
  name: string;
  estimatedPomos: PomodoroEstimate;
}

interface AddTaskModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: AddTaskData) => boolean | void | Promise<boolean | void>;
  editTask?: Task | null;
  initialName?: string;
}

interface FormState {
  name: string;
  estimatedPomos: PomodoroEstimate | null;
}

type FormAction =
  | { type: "SET_ALL"; payload: FormState }
  | { type: "SET_FIELD"; field: keyof FormState; value: FormState[keyof FormState] };

const INITIAL_STATE: FormState = {
  name: "",
  estimatedPomos: null,
};

function asPomodoroEstimate(value: number): PomodoroEstimate | null {
  return POMODORO_OPTIONS.includes(value as PomodoroEstimate)
    ? (value as PomodoroEstimate)
    : null;
}

function initialStateForTask(
  editTask?: Task | null,
  initialName?: string,
): FormState {
  if (!editTask) {
    return { ...INITIAL_STATE, name: initialName?.trim() ?? "" };
  }

  return {
    name: editTask.name,
    estimatedPomos: asPomodoroEstimate(editTask.estimated_pomos),
  };
}

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "SET_ALL":
      return action.payload;
    case "SET_FIELD":
      return { ...state, [action.field]: action.value };
    default:
      return state;
  }
}

export function AddTaskModal({
  open,
  onClose,
  onSubmit,
  editTask,
  initialName,
}: AddTaskModalProps) {
  const isEditing = !!editTask;
  const [form, dispatch] = useReducer(
    formReducer,
    initialStateForTask(editTask, initialName),
  );

  useEffect(() => {
    if (!open) return;
    dispatch({
      type: "SET_ALL",
      payload: initialStateForTask(editTask, initialName),
    });
  }, [open, editTask, initialName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || form.estimatedPomos === null) return;

    const submitted = await onSubmit({
      name: form.name.trim(),
      estimatedPomos: form.estimatedPomos,
    });
    if (submitted !== false) onClose();
  };

  return (
    <ModalOverlay
      key={editTask?.id ?? initialName ?? "new"}
      open={open}
      onClose={onClose}
      maxWidth="max-w-lg"
      showCloseButton
      ariaLabel={isEditing ? "编辑任务" : "新建任务"}
    >
      <div className="p-5 md:p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex size-9 items-center justify-center rounded-md bg-sahara-primary text-sahara-bg">
            {isEditing ? (
              <Edit3 className="size-5" />
            ) : (
              <Plus className="size-5" />
            )}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-sahara-text">
              {isEditing ? "编辑任务" : "新建任务"}
            </h3>
            <p className="text-xs text-sahara-text-muted mt-0.5">
              {isEditing ? "更新任务详情" : "添加一个要专注推进的任务"}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="task-name"
              className="mb-1.5 block text-xs font-medium text-sahara-text-secondary"
            >
              任务名称
            </label>
            <input
              id="task-name"
              type="text"
              name="task-name"
              autoComplete="off"
              value={form.name}
              onChange={(e) =>
                dispatch({
                  type: "SET_FIELD",
                  field: "name",
                  value: e.target.value,
                })
              }
              placeholder="你现在要做什么？"
              className="h-10 w-full rounded-md border border-sahara-border bg-sahara-surface px-3 text-sm text-sahara-text outline-none transition-colors duration-150 placeholder:text-sahara-text-muted focus:border-sahara-text focus:ring-2 focus:ring-sahara-focus/20"
            />
          </div>

          <div>
            <label
              id="task-pomos-label"
              className="mb-1.5 block text-xs font-medium text-sahara-text-secondary"
            >
              预计番茄数
            </label>
            <div
              role="group"
              aria-labelledby="task-pomos-label"
              className="grid grid-cols-4 gap-2"
            >
              {POMODORO_OPTIONS.map((pomos) => {
                const selected = form.estimatedPomos === pomos;
                return (
                  <button
                    key={pomos}
                    type="button"
                    aria-label={`预计 ${pomos} 个番茄`}
                    aria-pressed={selected}
                    onClick={() =>
                      dispatch({
                        type: "SET_FIELD",
                        field: "estimatedPomos",
                        value: pomos,
                      })
                    }
                    className={`flex h-12 items-center justify-center rounded-md border text-base font-semibold tabular-nums outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-sahara-focus ${
                      selected
                        ? "border-sahara-text bg-sahara-card text-sahara-text"
                        : "border-sahara-border bg-sahara-surface text-sahara-text-secondary hover:border-sahara-text-muted hover:bg-sahara-card"
                    }`}
                  >
                    {pomos}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              intent="default"
              size="md"
              fullWidth
              onClick={onClose}
            >
              取消
            </Button>
            <Button
              type="submit"
              variant="solid"
              intent={form.name.trim() && form.estimatedPomos !== null ? "sahara" : "default"}
              fullWidth
              disabled={!form.name.trim() || form.estimatedPomos === null}
              className="gap-2"
            >
              {isEditing ? (
                <>
                  <Edit3 className="size-4" /> 保存修改
                </>
              ) : (
                <>
                  <Plus className="size-4" /> 创建任务
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  );
}
