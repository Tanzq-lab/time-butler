import {
  useReducer,
  useEffect,
  useMemo,
  useState,
} from "react";
import type React from "react";
import { Edit3, LoaderCircle, Plus, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModalOverlay } from "@/components/ui/modal-overlay";
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
  onSubmit: (data: AddTaskData) => boolean | void | Promise<boolean | void>;
  editTask?: Task | null;
  initialName?: string;
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

function initialStateForTask(
  editTask?: Task | null,
  initialName?: string,
): FormState {
  if (!editTask) {
    return { ...INITIAL_STATE, name: initialName?.trim() ?? "" };
  }

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
  initialName,
  categories,
}: AddTaskModalProps) {
  const isEditing = !!editTask;
  const [form, dispatch] = useReducer(
    formReducer,
    initialStateForTask(editTask, initialName),
  );
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    dispatch({
      type: "SET_ALL",
      payload: initialStateForTask(editTask, initialName),
    });
    setSubmitting(false);
  }, [open, editTask, initialName]);

  const matchedCategory = useMemo(
    () => categories.find((c) => c.id === form.categoryId) ?? null,
    [categories, form.categoryId],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || submitting) return;

    setSubmitting(true);
    try {
      const submitted = await onSubmit({
        name: form.name.trim(),
        estimatedPomos: form.estimatedPomos,
        project: form.project.trim() || "",
        priority: form.priority || "",
        categoryId: form.categoryId,
      });
      if (submitted !== false) onClose();
    } finally {
      setSubmitting(false);
    }
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="task-pomos"
                className="mb-1.5 block text-xs font-medium text-sahara-text-secondary"
              >
                预计番茄数
              </label>
              <input
                id="task-pomos"
                type="number"
                name="task-pomos"
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
                className="h-10 w-full rounded-md border border-sahara-border bg-sahara-surface px-3 font-mono text-sm tabular-nums text-sahara-text outline-none focus:border-sahara-text focus:ring-2 focus:ring-sahara-focus/20"
              />
            </div>

            <div>
              <label
                htmlFor="task-priority"
                className="mb-1.5 block text-xs font-medium text-sahara-text-secondary"
              >
                优先级
              </label>
              <select
                id="task-priority"
                name="task-priority"
                value={form.priority}
                onChange={(e) =>
                  dispatch({
                    type: "SET_FIELD",
                    field: "priority",
                    value: e.target.value,
                  })
                }
                className="h-10 w-full cursor-pointer appearance-none rounded-md border border-sahara-border bg-sahara-surface px-3 text-sm text-sahara-text outline-none focus:border-sahara-text focus:ring-2 focus:ring-sahara-focus/20"
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
              htmlFor="task-project"
              className="mb-1.5 block text-xs font-medium text-sahara-text-secondary"
            >
              项目（归属）
            </label>
            <input
              id="task-project"
              type="text"
              name="task-project"
              autoComplete="off"
              value={form.project}
              onChange={(e) =>
                dispatch({
                  type: "SET_FIELD",
                  field: "project",
                  value: e.target.value,
                })
              }
              placeholder="例如：Time-butler、客户项目"
              className="h-10 w-full rounded-md border border-sahara-border bg-sahara-surface px-3 text-sm text-sahara-text outline-none placeholder:text-sahara-text-muted focus:border-sahara-text focus:ring-2 focus:ring-sahara-focus/20"
            />
          </div>

          <details className="group rounded-md border border-sahara-border bg-sahara-card/50">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm text-sahara-text marker:hidden">
              <span className="inline-flex items-center gap-2 font-medium">
                <Tag className="size-4 text-sahara-text-muted" />
                分类（可选）
              </span>
              {matchedCategory ? (
                <span
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
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
              ) : (
                <span className="shrink-0 text-xs font-bold text-sahara-text-muted">
                  {isEditing ? "未指定" : "创建时自动判断"}
                </span>
              )}
            </summary>
            <div className="border-t border-sahara-border/10 px-4 pb-4 pt-3">
              <label
                htmlFor="task-category"
                className="mb-1.5 block text-xs font-medium text-sahara-text-secondary"
              >
                手动指定分类
              </label>
              <select
                id="task-category"
                name="task-category"
                value={form.categoryId ?? ""}
                onChange={(e) =>
                  dispatch({
                    type: "SET_FIELD",
                    field: "categoryId",
                    value: e.target.value ? Number(e.target.value) : null,
                  })
                }
                className="h-10 w-full cursor-pointer appearance-none rounded-md border border-sahara-border bg-sahara-surface px-3 text-sm text-sahara-text outline-none focus:border-sahara-text focus:ring-2 focus:ring-sahara-focus/20"
              >
                <option value="">
                  {isEditing ? "未指定" : "自动判断"}
                </option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
          </details>

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
              disabled={!form.name.trim() || submitting}
              className="gap-2"
            >
              {submitting ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" />
                  {isEditing
                    ? "保存中…"
                    : form.categoryId == null
                      ? "正在判断分类…"
                      : "创建中…"}
                </>
              ) : isEditing ? (
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
