import {
  useReducer,
  useEffect,
  useEffectEvent,
  useCallback,
  useMemo,
} from "react";
import type React from "react";
import { Edit3, Plus, Tag, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Task } from "@/features/tasks/task-types";
import type { Category } from "@/lib/db/types";

export interface AddTaskData {
  name: string;
  estimatedPomos: number;
  project: string;
  priority: string;
  categoryId: number | null;
  scheduledFor?: string | null;
}

interface AddTaskModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: AddTaskData) => void | Promise<void>;
  editTask?: Task | null;
  categories: Category[];
}

const PRIORITY_OPTIONS = [
  { value: "", label: "无" },
  { value: "low", label: "低" },
  { value: "medium", label: "中" },
  { value: "high", label: "高" },
];

interface FormState {
  name: string;
  estimatedPomos: number;
  project: string;
  priority: string;
  categoryId: number | null;
}

type FormAction =
  | { type: "SET_ALL"; payload: FormState }
  | { type: "SET_FIELD"; field: keyof FormState; value: FormState[keyof FormState] };

const INITIAL_STATE: FormState = {
  name: "",
  estimatedPomos: 4,
  project: "",
  priority: "",
  categoryId: null,
};

function initialStateForTask(editTask?: Task | null): FormState {
  if (!editTask) return INITIAL_STATE;

  return {
    name: editTask.name,
    estimatedPomos: editTask.estimated_pomos,
    project: editTask.project || "",
    priority: editTask.priority || "",
    categoryId: editTask.category_id ?? null,
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
  categories,
}: AddTaskModalProps) {
  const isEditing = !!editTask;
  const [form, dispatch] = useReducer(
    formReducer,
    initialStateForTask(editTask),
  );

  const onCloseEvent = useEffectEvent(() => {
    onClose();
  });

  useEffect(() => {
    if (!open) return;
    dispatch({ type: "SET_ALL", payload: initialStateForTask(editTask) });
  }, [open, editTask]);

  useEffect(() => {
    if (!open) return;
    window.addEventListener("app:escape", onCloseEvent);
    return () => window.removeEventListener("app:escape", onCloseEvent);
  }, [open, onCloseEvent]);

  const handleOverlayKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onClose();
      }
    },
    [onClose],
  );

  const matchedCategory = useMemo(
    () => categories.find((c) => c.id === form.categoryId) ?? null,
    [categories, form.categoryId],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    await onSubmit({
      name: form.name.trim(),
      estimatedPomos: form.estimatedPomos,
      project: form.project.trim() || "",
      priority: form.priority || "",
      categoryId: form.categoryId,
    });
    onClose();
  };

  if (!open) return null;

  return (
    <div
      key={editTask?.id ?? "new"}
      className="fixed inset-0 z-50 flex items-center justify-center"
    >
      <div
        className="absolute inset-0 bg-sahara-text/30 backdrop-blur-sm"
        role="button"
        tabIndex={0}
        onClick={onClose}
        onKeyDown={handleOverlayKeyDown}
      />
      <div className="relative bg-sahara-surface rounded-2xl border border-sahara-border/20 shadow-xl w-full max-w-lg mx-4 p-6 md:p-8 animate-in fade-in zoom-in-95 duration-200">
        <Button
          variant="ghost"
          size="icon-lg"
          intent="default"
          shape="rounded-lg"
          onClick={onClose}
          className="absolute top-4 right-4 text-sahara-text-muted hover:text-sahara-text hover:bg-sahara-bg"
        >
          <X className="size-4" />
        </Button>

        <div className="flex items-center gap-3 mb-6">
          <div className="size-10 rounded-xl bg-sahara-primary-light flex items-center justify-center text-sahara-primary">
            {isEditing ? (
              <Edit3 className="size-5" />
            ) : (
              <Plus className="size-5" />
            )}
          </div>
          <div>
            <h3 className="font-serif text-xl text-sahara-text font-semibold">
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
              className="block text-[11px] font-bold text-sahara-text-muted uppercase tracking-wider mb-1.5"
            >
              任务名称
            </label>
            <input
              id="task-name"
              type="text"
              value={form.name}
              onChange={(e) =>
                dispatch({
                  type: "SET_FIELD",
                  field: "name",
                  value: e.target.value,
                })
              }
              placeholder="你现在要做什么？"
              className="w-full px-4 py-3 bg-sahara-bg/40 border border-sahara-border/20 rounded-xl text-sm text-sahara-text placeholder:text-sahara-text-muted/50 focus:outline-none focus:border-sahara-primary/50 focus:ring-2 focus:ring-sahara-primary/10 transition-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="task-pomos"
                className="block text-[11px] font-bold text-sahara-text-muted uppercase tracking-wider mb-1.5"
              >
                预计番茄数
              </label>
              <input
                id="task-pomos"
                type="number"
                min={1}
                max={100}
                value={form.estimatedPomos}
                onChange={(e) =>
                  dispatch({
                    type: "SET_FIELD",
                    field: "estimatedPomos",
                    value: Math.max(1, parseInt(e.target.value, 10) || 1),
                  })
                }
                className="w-full px-4 py-3 bg-sahara-bg/40 border border-sahara-border/20 rounded-xl text-sm text-sahara-text tabular-nums focus:outline-none focus:border-sahara-primary/50 focus:ring-2 focus:ring-sahara-primary/10 transition-all"
              />
            </div>

            <div>
              <label
                htmlFor="task-priority"
                className="block text-[11px] font-bold text-sahara-text-muted uppercase tracking-wider mb-1.5"
              >
                优先级
              </label>
              <select
                id="task-priority"
                value={form.priority}
                onChange={(e) =>
                  dispatch({
                    type: "SET_FIELD",
                    field: "priority",
                    value: e.target.value,
                  })
                }
                className="w-full px-4 py-3 bg-sahara-bg/40 border border-sahara-border/20 rounded-xl text-sm text-sahara-text focus:outline-none focus:border-sahara-primary/50 focus:ring-2 focus:ring-sahara-primary/10 transition-all appearance-none cursor-pointer"
              >
                {PRIORITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="task-category"
              className="block text-[11px] font-bold text-sahara-text-muted uppercase tracking-wider mb-1.5"
            >
              <span className="inline-flex items-center gap-1.5">
                <Tag className="size-3" />
                分类（意图）
              </span>
            </label>
            <select
              id="task-category"
              value={form.categoryId ?? ""}
              onChange={(e) =>
                dispatch({
                  type: "SET_FIELD",
                  field: "categoryId",
                  value: e.target.value ? Number(e.target.value) : null,
                })
              }
              className="w-full px-4 py-3 bg-sahara-bg/40 border border-sahara-border/20 rounded-xl text-sm text-sahara-text focus:outline-none focus:border-sahara-primary/50 focus:ring-2 focus:ring-sahara-primary/10 transition-all appearance-none cursor-pointer"
            >
              <option value="">未分类</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
            {matchedCategory && (
              <div className="flex items-center gap-2 mt-2">
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                  style={{
                    backgroundColor: `${matchedCategory.color}18`,
                    color: matchedCategory.color,
                  }}
                >
                  <span
                    className="size-2 rounded-full"
                    style={{ backgroundColor: matchedCategory.color }}
                  />
                  {matchedCategory.name}
                </span>
              </div>
            )}
          </div>

          <div>
            <label
              htmlFor="task-project"
              className="block text-[11px] font-bold text-sahara-text-muted uppercase tracking-wider mb-1.5"
            >
              项目（归属）
            </label>
            <input
              id="task-project"
              type="text"
              value={form.project}
              onChange={(e) =>
                dispatch({
                  type: "SET_FIELD",
                  field: "project",
                  value: e.target.value,
                })
              }
              placeholder="例如：时间管家、客户项目"
              className="w-full px-4 py-3 bg-sahara-bg/40 border border-sahara-border/20 rounded-xl text-sm text-sahara-text placeholder:text-sahara-text-muted/50 focus:outline-none focus:border-sahara-primary/50 focus:ring-2 focus:ring-sahara-primary/10 transition-all"
            />
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
              intent={form.name.trim() ? "sahara" : "default"}
              fullWidth
              disabled={!form.name.trim()}
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
    </div>
  );
}
