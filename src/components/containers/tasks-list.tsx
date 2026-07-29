import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type PointerEvent,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Filter,
  Plus,
  Repeat2,
  Search,
} from "lucide-react";
import { useTaskStore } from "@/features/tasks/use-task-store";
import { useCategoriesStore } from "@/features/categories/use-categories-store";
import { useTimerStore } from "@/features/timer/use-timer-store";
import {
  getTaskItemType,
  type Task,
  type TaskCompletionReview,
} from "@/features/tasks/task-types";
import {
  AddTaskModal,
  type AddTaskData,
} from "@/components/base/add-task-modal";
import {
  AddRecurringTaskModal,
  type AddRecurringTaskData,
} from "@/components/base/add-recurring-task-modal";
import { TaskCompletionReviewModal } from "@/components/base/task-completion-review-modal";
import { TaskNoteModal } from "@/components/base/task-note-modal";
import { TaskTreeRow } from "@/components/base/task-tree-row";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PageHeader } from "@/components/ui/page-header";
import { getTaskCompletionReviews, recordAppEvent } from "@/lib/db";
import {
  addRecurringTaskRule,
  deleteRecurringTaskRule,
  getRecurringTaskRules,
  setRecurringTaskRuleEnabled,
  updateRecurringTaskRule,
  type UserRecurringTaskRule,
} from "@/features/tasks/recurring-task-rules";

type TaskDropPosition = "before" | "after";

interface TaskDropTarget {
  id: number;
  position: TaskDropPosition;
}

interface TaskRowBounds {
  id: number;
  top: number;
  bottom: number;
  midpoint: number;
}

interface PointerDrag {
  taskId: number;
  parentId: number | null;
  siblingIds: number[];
  pointerId: number;
  startY: number;
  isDragging: boolean;
  latestOffsetY: number;
  frameId: number | null;
  rowElement: HTMLElement;
  rowBounds: TaskRowBounds[];
}

function isScheduledForFuture(task: Task): boolean {
  if (!task.scheduled_for) return false;
  const scheduledTime = new Date(task.scheduled_for).getTime();
  return Number.isFinite(scheduledTime) && scheduledTime > Date.now();
}

export function TasksList() {
  const navigate = useNavigate();
  const tasks = useTaskStore((state) => state.tasks);
  const loading = useTaskStore((state) => state.loading);
  const error = useTaskStore((state) => state.error);
  const loadTasks = useTaskStore((state) => state.loadTasks);
  const addTask = useTaskStore((state) => state.addTask);
  const addTodo = useTaskStore((state) => state.addTodo);
  const addSubtask = useTaskStore((state) => state.addSubtask);
  const updateTask = useTaskStore((state) => state.updateTask);
  const setCompleted = useTaskStore((state) => state.setCompleted);
  const setItemType = useTaskStore((state) => state.setItemType);
  const reorderTasks = useTaskStore((state) => state.reorderTasks);
  const deleteTask = useTaskStore((state) => state.deleteTask);
  const completeTask = useTaskStore((state) => state.completeTask);
  const appendTaskNote = useTaskStore((state) => state.appendTaskNote);
  const categories = useCategoriesStore((state) => state.categories);
  const loadCategories = useCategoriesStore((state) => state.loadCategories);

  const activeTaskId = useTimerStore((state) => state.activeTaskId);
  const currentSessionTaskId = useTimerStore((state) => state.currentSessionTaskId);
  const timerPhase = useTimerStore((state) => state.phase);
  const timerStatus = useTimerStore((state) => state.status);
  const setActiveTask = useTimerStore((state) => state.setActiveTask);

  const [searchQuery, setSearchQuery] = useState("");
  const [quickDraft, setQuickDraft] = useState("");
  const [showAddFocusModal, setShowAddFocusModal] = useState(false);
  const [showRecurringModal, setShowRecurringModal] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);
  const [taskToConvert, setTaskToConvert] = useState<Task | null>(null);
  const [taskToComplete, setTaskToComplete] = useState<Task | null>(null);
  const [completionHistory, setCompletionHistory] = useState<
    TaskCompletionReview[]
  >([]);
  const [completionHistoryLoading, setCompletionHistoryLoading] =
    useState(false);
  const [completionHistoryError, setCompletionHistoryError] = useState(false);
  const [taskToRecord, setTaskToRecord] = useState<Task | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [doneVisibleCount, setDoneVisibleCount] = useState(20);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [subtaskParentId, setSubtaskParentId] = useState<number | null>(null);
  const [subtaskDraft, setSubtaskDraft] = useState("");
  const [recurringRules, setRecurringRules] = useState<UserRecurringTaskRule[]>([]);
  const [draggingTaskId, setDraggingTaskId] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<TaskDropTarget | null>(null);
  const initializedGroupsRef = useRef<Set<number>>(new Set());
  const pointerDragRef = useRef<PointerDrag | null>(null);
  const dropTargetRef = useRef<TaskDropTarget | null>(null);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    let disposed = false;
    const refreshTasks = () => {
      if (!disposed) void loadTasks();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") refreshTasks();
    };

    refreshTasks();
    window.addEventListener("focus", refreshTasks);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      disposed = true;
      window.removeEventListener("focus", refreshTasks);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [loadTasks]);

  useEffect(() => {
    if (!taskToComplete) {
      setCompletionHistory([]);
      setCompletionHistoryLoading(false);
      setCompletionHistoryError(false);
      return;
    }

    let disposed = false;
    setCompletionHistory([]);
    setCompletionHistoryLoading(true);
    setCompletionHistoryError(false);
    void getTaskCompletionReviews(taskToComplete.id)
      .then((history) => {
        if (!disposed) setCompletionHistory(history);
      })
      .catch((historyError) => {
        console.error(
          "[TasksList] Failed to load task completion history:",
          historyError,
        );
        if (!disposed) {
          setCompletionHistory([]);
          setCompletionHistoryError(true);
        }
      })
      .finally(() => {
        if (!disposed) setCompletionHistoryLoading(false);
      });

    return () => {
      disposed = true;
    };
  }, [taskToComplete]);

  const taskById = useMemo(
    () => new Map(tasks.map((task) => [task.id, task])),
    [tasks],
  );
  const childrenByParent = useMemo(() => {
    const map = new Map<number, Task[]>();
    tasks.forEach((task) => {
      const parentId = task.parent_id ?? null;
      if (parentId == null) return;
      const children = map.get(parentId) ?? [];
      children.push(task);
      map.set(parentId, children);
    });
    return map;
  }, [tasks]);
  const rootTasks = useMemo(
    () =>
      tasks.filter((task) => {
        const parentId = task.parent_id ?? null;
        return parentId == null || !taskById.has(parentId);
      }),
    [taskById, tasks],
  );

  useEffect(() => {
    const newlyDiscoveredOpenGroups = rootTasks.filter(
      (task) =>
        !task.completed_at
        && (childrenByParent.get(task.id)?.length ?? 0) > 0
        && !initializedGroupsRef.current.has(task.id),
    );
    if (newlyDiscoveredOpenGroups.length === 0) return;

    newlyDiscoveredOpenGroups.forEach((task) => initializedGroupsRef.current.add(task.id));
    setExpandedIds((current) => {
      const next = new Set(current);
      newlyDiscoveredOpenGroups.forEach((task) => next.add(task.id));
      return next;
    });
  }, [childrenByParent, rootTasks]);

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const taskMatchesSearch = (task: Task) =>
    !normalizedSearch
    || task.name.toLowerCase().includes(normalizedSearch)
    || (task.project ?? "").toLowerCase().includes(normalizedSearch);
  const visibleRoots = rootTasks.filter((root) => {
    if (taskMatchesSearch(root)) return true;
    return (childrenByParent.get(root.id) ?? []).some(taskMatchesSearch);
  });
  const openRoots = visibleRoots.filter((task) => !task.completed_at);
  const doneRoots = visibleRoots
    .filter((task) => task.completed_at)
    .sort(
      (a, b) =>
        new Date(b.completed_at ?? b.created_at).getTime()
        - new Date(a.completed_at ?? a.created_at).getTime(),
    );
  const visibleDoneRoots = doneRoots.slice(0, doneVisibleCount);
  const revealDone = showDone || Boolean(normalizedSearch);
  const categoryNameById = new Map(
    categories.map((category) => [category.id, category.name]),
  );

  const toggleExpanded = (taskId: number) => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const handleQuickAdd = async (event: FormEvent) => {
    event.preventDefault();
    const created = await addTodo(quickDraft);
    if (created) setQuickDraft("");
  };

  const handleTaskModalSubmit = async (data: AddTaskData) => {
    if (taskToEdit) {
      await updateTask(taskToEdit.id, data.name, data.estimatedPomos);
      return true;
    }
    if (taskToConvert) {
      if (data.name !== taskToConvert.name) {
        await updateTask(taskToConvert.id, data.name);
      }
      return setItemType(taskToConvert.id, "focus", data.estimatedPomos);
    }
    return Boolean(await addTask(data.name, data.estimatedPomos));
  };

  const closeTaskModal = () => {
    setShowAddFocusModal(false);
    setTaskToEdit(null);
    setTaskToConvert(null);
  };

  const handleFocus = async (task: Task) => {
    await setActiveTask(task.id);
    navigate("/");
  };

  const handleConvertToTodo = async (task: Task) => {
    if (task.completed_pomos !== 0) return;
    if (
      timerStatus !== "idle"
      && timerPhase === "work"
      && currentSessionTaskId === task.id
    ) {
      return;
    }
    const converted = await setItemType(task.id, "todo");
    if (converted && activeTaskId === task.id) await setActiveTask(null);
  };

  const handleCompleteTask = async (data: {
    actualPomos: number;
    review: string;
  }) => {
    if (!taskToComplete) return;
    await completeTask(taskToComplete.id, data.actualPomos, data.review);
    if (activeTaskId === taskToComplete.id) await setActiveTask(null);
    setTaskToComplete(null);
  };

  const handleAppendTaskNote = async (content: string) => {
    if (!taskToRecord) return false;
    return appendTaskNote(taskToRecord.id, content, "task-card");
  };

  const handleDeleteTask = async () => {
    if (!taskToDelete) return;
    const childIds = new Set(
      (childrenByParent.get(taskToDelete.id) ?? []).map((task) => task.id),
    );
    if (activeTaskId === taskToDelete.id || (activeTaskId != null && childIds.has(activeTaskId))) {
      await setActiveTask(null);
    }
    await deleteTask(taskToDelete.id);
    setTaskToDelete(null);
  };

  const beginAddSubtask = (task: Task) => {
    setSubtaskParentId(task.id);
    setSubtaskDraft("");
    setExpandedIds((current) => new Set(current).add(task.id));
  };

  const handleAddSubtask = async (event: FormEvent, parent: Task) => {
    event.preventDefault();
    const created = await addSubtask(parent.id, subtaskDraft);
    if (!created) return;

    if (activeTaskId === parent.id) await setActiveTask(null);
    setExpandedIds((current) => new Set(current).add(parent.id));
    setSubtaskDraft("");
    setSubtaskParentId(null);
  };

  const handleOpenRecurringModal = () => {
    setShowRecurringModal(true);
    void getRecurringTaskRules()
      .then(setRecurringRules)
      .catch((error) => {
        console.error("[TasksList] Failed to load recurring rules:", error);
      });
  };

  const handleAddRecurringTask = async (data: AddRecurringTaskData) => {
    const ruleId = await addRecurringTaskRule(data);
    await loadTasks();
    void recordAppEvent({
      eventName: "recurring_task_rule_created",
      route: "/tasks",
      entityType: "recurring_task_rule",
      entityId: ruleId,
      metadata: {
        itemType: data.itemType,
        frequency: data.frequency,
        estimatedPomos: data.itemType === "focus" ? data.estimatedPomos : null,
        hasProject: Boolean(data.project),
        hasCategory: data.categoryId != null,
        startDate: data.startDate,
        scheduledTime: data.scheduledTime,
      },
    });
    return true;
  };

  const handleToggleRecurringRule = async (ruleId: number, enabled: boolean) => {
    await setRecurringTaskRuleEnabled(ruleId, enabled);
    setRecurringRules((rules) =>
      rules.map((rule) =>
        rule.id === ruleId ? { ...rule, enabled: enabled ? 1 : 0 } : rule,
      ),
    );
    if (enabled) await loadTasks();
    void recordAppEvent({
      eventName: enabled
        ? "recurring_task_rule_enabled"
        : "recurring_task_rule_disabled",
      route: "/tasks",
      entityType: "recurring_task_rule",
      entityId: ruleId,
    });
    return true;
  };

  const handleUpdateRecurringRule = async (
    ruleId: number,
    data: AddRecurringTaskData,
  ) => {
    await updateRecurringTaskRule(ruleId, data);
    setRecurringRules(await getRecurringTaskRules());
    await loadTasks();
    void recordAppEvent({
      eventName: "recurring_task_rule_updated",
      route: "/tasks",
      entityType: "recurring_task_rule",
      entityId: ruleId,
      metadata: {
        itemType: data.itemType,
        frequency: data.frequency,
        estimatedPomos: data.itemType === "focus" ? data.estimatedPomos : null,
        hasProject: Boolean(data.project),
        hasCategory: data.categoryId != null,
        startDate: data.startDate,
        scheduledTime: data.scheduledTime,
      },
    });
    return true;
  };

  const handleDeleteRecurringRule = async (ruleId: number) => {
    await deleteRecurringTaskRule(ruleId);
    setRecurringRules((rules) => rules.filter((rule) => rule.id !== ruleId));
    void recordAppEvent({
      eventName: "recurring_task_rule_deleted",
      route: "/tasks",
      entityType: "recurring_task_rule",
      entityId: ruleId,
    });
    return true;
  };

  const setCurrentDropTarget = (target: TaskDropTarget | null) => {
    if (
      dropTargetRef.current?.id === target?.id
      && dropTargetRef.current?.position === target?.position
    ) {
      return;
    }
    dropTargetRef.current = target;
    setDropTarget(target);
  };

  const applyPointerTransform = (pointerDrag: PointerDrag) => {
    pointerDrag.rowElement.style.transform =
      `translate3d(0, ${pointerDrag.latestOffsetY}px, 0) scale(1.01)`;
  };

  const releasePointerDrag = (pointerDrag: PointerDrag) => {
    if (pointerDrag.frameId !== null && typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(pointerDrag.frameId);
    }
    pointerDrag.frameId = null;
    pointerDrag.rowElement.style.removeProperty("transform");
    pointerDrag.rowElement.style.removeProperty("transition");
    pointerDrag.rowElement.style.removeProperty("will-change");
    pointerDrag.rowElement.style.removeProperty("pointer-events");
  };

  const clearPointerDrag = () => {
    const pointerDrag = pointerDragRef.current;
    if (pointerDrag) releasePointerDrag(pointerDrag);
    pointerDragRef.current = null;
    setDraggingTaskId(null);
    setCurrentDropTarget(null);
  };

  const isTaskControl = (target: EventTarget | null) =>
    target instanceof Element
    && Boolean(target.closest("button, input, textarea, select, a, [data-task-drag-exempt]"));

  const handlePointerDown = (
    event: PointerEvent<HTMLElement>,
    taskId: number,
    parentId: number | null,
    siblingIds: number[],
  ) => {
    if (event.button !== 0 || event.isPrimary === false || isTaskControl(event.target)) return;

    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pointerDragRef.current = {
      taskId,
      parentId,
      siblingIds,
      pointerId: event.pointerId,
      startY: event.clientY,
      isDragging: false,
      latestOffsetY: 0,
      frameId: null,
      rowElement: event.currentTarget,
      rowBounds: [],
    };
    setCurrentDropTarget(null);
  };

  const handlePointerMove = (event: PointerEvent<HTMLElement>) => {
    const pointerDrag = pointerDragRef.current;
    if (!pointerDrag || pointerDrag.pointerId !== event.pointerId) return;

    const offsetY = event.clientY - pointerDrag.startY;
    if (!pointerDrag.isDragging && Math.abs(offsetY) < 6) return;

    event.preventDefault();
    if (!pointerDrag.isDragging) {
      const siblingIds = new Set(pointerDrag.siblingIds);
      pointerDrag.isDragging = true;
      pointerDrag.rowBounds = Array.from(
        document.querySelectorAll<HTMLElement>("[data-task-id]"),
      )
        .map((row) => {
          const id = Number(row.dataset.taskId);
          const bounds = row.getBoundingClientRect();
          return {
            id,
            top: bounds.top,
            bottom: bounds.bottom,
            midpoint: bounds.top + bounds.height / 2,
          };
        })
        .filter((row) => Number.isInteger(row.id) && siblingIds.has(row.id));
      pointerDrag.rowElement.style.transition = "none";
      pointerDrag.rowElement.style.willChange = "transform";
      pointerDrag.rowElement.style.pointerEvents = "none";
      setDraggingTaskId(pointerDrag.taskId);
    }

    pointerDrag.latestOffsetY = offsetY;
    if (pointerDrag.frameId === null) {
      if (typeof requestAnimationFrame === "function") {
        pointerDrag.frameId = requestAnimationFrame(() => {
          if (pointerDragRef.current !== pointerDrag) return;
          pointerDrag.frameId = null;
          applyPointerTransform(pointerDrag);
        });
      } else {
        applyPointerTransform(pointerDrag);
      }
    }

    const row = pointerDrag.rowBounds.find(
      (bounds) =>
        bounds.id !== pointerDrag.taskId
        && event.clientY >= bounds.top
        && event.clientY <= bounds.bottom,
    );
    setCurrentDropTarget(
      row
        ? {
            id: row.id,
            position: event.clientY < row.midpoint ? "before" : "after",
          }
        : null,
    );
  };

  const handlePointerUp = (event: PointerEvent<HTMLElement>) => {
    const pointerDrag = pointerDragRef.current;
    if (!pointerDrag || pointerDrag.pointerId !== event.pointerId) return;

    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    }

    const target = dropTargetRef.current;
    releasePointerDrag(pointerDrag);
    pointerDragRef.current = null;
    setDraggingTaskId(null);
    setCurrentDropTarget(null);
    if (!pointerDrag.isDragging || !target || pointerDrag.taskId === target.id) return;

    const nextIds = [...pointerDrag.siblingIds];
    const sourceIndex = nextIds.indexOf(pointerDrag.taskId);
    if (sourceIndex < 0 || !nextIds.includes(target.id)) return;
    nextIds.splice(sourceIndex, 1);
    const insertIndex = nextIds.indexOf(target.id) + (target.position === "after" ? 1 : 0);
    nextIds.splice(insertIndex, 0, pointerDrag.taskId);
    if (pointerDrag.parentId == null) void reorderTasks(nextIds);
    else void reorderTasks(nextIds, pointerDrag.parentId);
  };

  const renderTask = (task: Task, depth: 0 | 1) => {
    const allChildren = childrenByParent.get(task.id) ?? [];
    const children = normalizedSearch && !taskMatchesSearch(task)
      ? allChildren.filter(taskMatchesSearch)
      : allChildren;
    const completedChildCount = allChildren.filter((child) => child.completed_at).length;
    const focusChildren = allChildren.filter(
      (child) => getTaskItemType(child) === "focus",
    );
    const isGroup = allChildren.length > 0;
    const isExpanded = Boolean(normalizedSearch) || expandedIds.has(task.id);
    const parentId = task.parent_id ?? null;
    const siblings = parentId == null
      ? openRoots
      : childrenByParent.get(parentId) ?? [];
    const siblingIds = siblings.map((sibling) => sibling.id);
    const canReorder = !normalizedSearch && siblings.length > 1 && !task.completed_at;
    const taskIsCurrentRunningSession =
      timerPhase === "work"
      && timerStatus !== "idle"
      && currentSessionTaskId === task.id;
    const runtimeStatus =
      taskIsCurrentRunningSession
        ? timerStatus === "running" || timerStatus === "paused"
          ? timerStatus
          : null
        : null;
    const canFocus =
      getTaskItemType(task) === "focus"
      && !isGroup
      && !task.completed_at
      && !isScheduledForFuture(task);

    return (
      <div key={task.id}>
        <TaskTreeRow
          task={task}
          depth={depth}
          childCount={allChildren.length}
          completedChildCount={completedChildCount}
          focusChildCount={focusChildren.length}
          expanded={isExpanded}
          categoryName={
            task.category_id == null
              ? null
              : categoryNameById.get(task.category_id)
          }
          isActive={activeTaskId === task.id}
          runtimeStatus={runtimeStatus}
          reorderable={canReorder}
          dragging={draggingTaskId === task.id}
          dropIndicator={dropTarget?.id === task.id ? dropTarget.position : null}
          canAddSubtask={depth === 0 && !taskIsCurrentRunningSession}
          onToggleExpanded={() => toggleExpanded(task.id)}
          onToggleTodo={() => void setCompleted(task.id, !task.completed_at)}
          onFocus={canFocus ? () => void handleFocus(task) : undefined}
          onCompleteFocus={
            getTaskItemType(task) === "focus" && !isGroup && !task.completed_at
              ? () => setTaskToComplete(task)
              : undefined
          }
          onConvertToFocus={
            getTaskItemType(task) === "todo" && !isGroup && !task.completed_at
              ? () => setTaskToConvert(task)
              : undefined
          }
          onConvertToTodo={
            getTaskItemType(task) === "focus"
            && !isGroup
            && !task.completed_at
            && task.completed_pomos === 0
            && !taskIsCurrentRunningSession
              ? () => void handleConvertToTodo(task)
              : undefined
          }
          onAddSubtask={
            depth === 0 && !taskIsCurrentRunningSession
              ? () => beginAddSubtask(task)
              : undefined
          }
          onRename={async (name) => {
            await updateTask(task.id, name);
            return true;
          }}
          onEditDetails={
            getTaskItemType(task) === "focus" && !isGroup
              ? () => setTaskToEdit(task)
              : undefined
          }
          onRecord={
            getTaskItemType(task) === "focus" && !isGroup
              ? () => setTaskToRecord(task)
              : undefined
          }
          onDelete={() => setTaskToDelete(task)}
          onPointerDown={(event) =>
            handlePointerDown(event, task.id, parentId, siblingIds)}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={clearPointerDrag}
        />

        {isGroup && isExpanded && (
          <div className="ml-4 border-l border-sahara-border pl-3 md:ml-5 md:pl-4">
            {children.map((child) => renderTask(child, 1))}
            {subtaskParentId === task.id && (
              <form
                onSubmit={(event) => void handleAddSubtask(event, task)}
                className="flex items-center gap-2 border-t border-sahara-border bg-sahara-surface px-3 py-2.5"
              >
                <Plus aria-hidden="true" className="size-4 shrink-0 text-sahara-text-muted" />
                <input
                  autoFocus
                  type="text"
                  name={`subtask-${task.id}`}
                  value={subtaskDraft}
                  onChange={(event) => setSubtaskDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      event.preventDefault();
                      setSubtaskParentId(null);
                      setSubtaskDraft("");
                    }
                  }}
                  aria-label={`添加子任务：${task.name}`}
                  placeholder="输入子任务，按回车保存…"
                  className="h-8 min-w-0 flex-1 bg-transparent px-1 text-sm text-sahara-text outline-none placeholder:text-sahara-text-muted"
                />
                <Button
                  type="submit"
                  variant="ghost"
                  intent="sahara"
                  size="xs"
                  disabled={!subtaskDraft.trim()}
                >
                  添加
                </Button>
                <button
                  type="button"
                  onClick={() => {
                    setSubtaskParentId(null);
                    setSubtaskDraft("");
                  }}
                  className="rounded-md px-2 py-1.5 text-xs text-sahara-text-secondary outline-none hover:bg-sahara-card hover:text-sahara-text focus-visible:ring-2 focus-visible:ring-sahara-focus"
                >
                  取消
                </button>
              </form>
            )}
          </div>
        )}

        {!isGroup && subtaskParentId === task.id && (
          <div className="ml-4 border-l border-sahara-border pl-3 md:ml-5 md:pl-4">
            <form
              onSubmit={(event) => void handleAddSubtask(event, task)}
              className="flex items-center gap-2 border-t border-sahara-border bg-sahara-surface px-3 py-2.5"
            >
              <Plus aria-hidden="true" className="size-4 shrink-0 text-sahara-text-muted" />
              <input
                autoFocus
                type="text"
                name={`subtask-${task.id}`}
                value={subtaskDraft}
                onChange={(event) => setSubtaskDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    setSubtaskParentId(null);
                    setSubtaskDraft("");
                  }
                }}
                aria-label={`添加子任务：${task.name}`}
                placeholder="输入子任务，按回车保存…"
                className="h-8 min-w-0 flex-1 bg-transparent px-1 text-sm text-sahara-text outline-none placeholder:text-sahara-text-muted"
              />
              <Button
                type="submit"
                variant="ghost"
                intent="sahara"
                size="xs"
                disabled={!subtaskDraft.trim()}
              >
                添加
              </Button>
              <button
                type="button"
                onClick={() => {
                  setSubtaskParentId(null);
                  setSubtaskDraft("");
                }}
                className="rounded-md px-2 py-1.5 text-xs text-sahara-text-secondary outline-none hover:bg-sahara-card hover:text-sahara-text focus-visible:ring-2 focus-visible:ring-sahara-focus"
              >
                取消
              </button>
            </form>
          </div>
        )}
      </div>
    );
  };

  const deletingChildCount = taskToDelete
    ? (childrenByParent.get(taskToDelete.id)?.length ?? 0)
    : 0;

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="我的任务"
        description="拆开复杂任务，找到下一件事，然后开始专注。"
        actions={
          <div role="group" aria-label="任务操作" className="flex items-center gap-2">
            <Button
              variant="outline"
              intent="default"
              size="sm"
              aria-label="添加循环任务"
              onClick={handleOpenRecurringModal}
              className="min-h-10 gap-1.5 px-2.5 text-xs font-medium md:px-3"
            >
              <Repeat2 aria-hidden="true" className="size-3.5 md:size-4" />
              <span className="hidden md:inline">循环任务</span>
            </Button>
            <Button
              variant="solid"
              intent="sahara"
              size="sm"
              aria-label="添加专注任务"
              onClick={() => setShowAddFocusModal(true)}
              className="min-h-10 gap-1.5 px-2.5 text-xs font-medium md:px-3"
            >
              <Plus aria-hidden="true" className="size-3.5 md:size-4" />
              <span className="hidden sm:inline">添加专注任务</span>
            </Button>
          </div>
        }
        className="mb-5 md:mb-6"
      />

      <div className="mb-5 flex items-center gap-3 border-b border-sahara-border pb-4">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search
            aria-hidden="true"
            className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-sahara-text-muted"
          />
          <input
            type="search"
            name="task-search"
            autoComplete="off"
            aria-label="搜索任务"
            placeholder="搜索任务…"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="h-9 w-full rounded-md border border-sahara-border bg-sahara-surface pl-9 pr-3 text-sm text-sahara-text outline-none transition-colors duration-150 placeholder:text-sahara-text-muted focus:border-sahara-text focus:ring-2 focus:ring-sahara-focus/20"
          />
        </div>
        <span className="ml-auto shrink-0 font-mono text-[11px] tabular-nums text-sahara-text-muted">
          {openRoots.length} 项
        </span>
      </div>

      <AddTaskModal
        open={showAddFocusModal || Boolean(taskToEdit) || Boolean(taskToConvert)}
        onClose={closeTaskModal}
        onSubmit={handleTaskModalSubmit}
        editTask={taskToEdit ?? taskToConvert}
        mode={taskToEdit ? "edit" : taskToConvert ? "convert" : "create"}
      />
      <AddRecurringTaskModal
        open={showRecurringModal}
        onClose={() => setShowRecurringModal(false)}
        onSubmit={handleAddRecurringTask}
        projectOptions={tasks.map((task) => task.project ?? "")}
        rules={recurringRules}
        onToggleRule={handleToggleRecurringRule}
        onUpdateRule={handleUpdateRecurringRule}
        onDeleteRule={handleDeleteRecurringRule}
      />
      <TaskCompletionReviewModal
        open={Boolean(taskToComplete)}
        task={taskToComplete}
        history={completionHistory}
        historyLoading={completionHistoryLoading}
        historyError={completionHistoryError}
        onClose={() => setTaskToComplete(null)}
        onSubmit={handleCompleteTask}
      />
      <TaskNoteModal
        open={Boolean(taskToRecord)}
        task={taskToRecord}
        onClose={() => setTaskToRecord(null)}
        onSubmit={handleAppendTaskNote}
      />
      <ConfirmDialog
        open={Boolean(taskToDelete)}
        title={deletingChildCount > 0 ? "删除整组任务？" : "删除任务？"}
        description={
          taskToDelete
            ? deletingChildCount > 0
              ? `“${taskToDelete.name}”及其 ${deletingChildCount} 个子任务和关联专注记录将被删除，此操作无法撤销。`
              : `“${taskToDelete.name}”及关联专注记录将被删除，此操作无法撤销。`
            : ""
        }
        confirmLabel="删除任务"
        destructive
        onClose={() => setTaskToDelete(null)}
        onConfirm={handleDeleteTask}
      />

      <section aria-label="任务">
        {error && (
          <p role="alert" className="mb-3 text-xs text-red-600 dark:text-red-400">
            任务保存失败，请重试。
          </p>
        )}

        {loading && tasks.length === 0 ? (
          <p className="rounded-md border border-sahara-border px-4 py-8 text-center text-sm text-sahara-text-muted">
            正在加载任务…
          </p>
        ) : openRoots.length > 0 ? (
          <div className="divide-y divide-sahara-border overflow-hidden rounded-[10px] border border-sahara-border bg-sahara-surface">
            {openRoots.map((task) => renderTask(task, 0))}
          </div>
        ) : normalizedSearch && doneRoots.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <Filter aria-hidden="true" className="mb-3 size-10 text-sahara-border" />
            <p className="text-sm font-semibold text-sahara-text-secondary">没有找到任务</p>
            <p className="mt-1 text-xs text-sahara-text-muted">换个关键词试试</p>
          </div>
        ) : (
          <p className="rounded-md border border-dashed border-sahara-border px-4 py-8 text-center text-sm text-sahara-text-muted">
            添加一件要做的事，需要投入时再设为专注。
          </p>
        )}

        <form
          onSubmit={(event) => void handleQuickAdd(event)}
          className="mt-3 flex items-center gap-2 rounded-md border border-sahara-border bg-sahara-surface px-3 py-2.5"
        >
          <Plus aria-hidden="true" className="size-4 shrink-0 text-sahara-text-muted" />
          <input
            type="text"
            name="quick-task"
            autoComplete="off"
            value={quickDraft}
            onChange={(event) => setQuickDraft(event.target.value)}
            aria-label="添加任务"
            placeholder="添加任务，按回车保存…"
            className="h-8 min-w-0 flex-1 bg-transparent px-1 text-sm text-sahara-text outline-none placeholder:text-sahara-text-muted"
          />
          <Button
            type="submit"
            variant="ghost"
            intent="sahara"
            size="xs"
            disabled={!quickDraft.trim()}
          >
            添加
          </Button>
        </form>

        {doneRoots.length > 0 && (
          <div className="mt-7 border-t border-sahara-border pt-5">
            <button
              type="button"
              onClick={() => {
                setShowDone((value) => !value);
                setDoneVisibleCount(20);
              }}
              aria-expanded={revealDone}
              className="mb-3 flex w-full items-center gap-2 rounded-md py-1 text-left text-sahara-text-secondary outline-none hover:text-sahara-text focus-visible:ring-2 focus-visible:ring-sahara-focus"
            >
              {revealDone ? (
                <ChevronDown aria-hidden="true" className="size-4 text-sahara-text-muted" />
              ) : (
                <ChevronRight aria-hidden="true" className="size-4 text-sahara-text-muted" />
              )}
              <CheckCircle2 aria-hidden="true" className="size-4 text-emerald-600 dark:text-emerald-400" />
              <span className="text-xs font-semibold">已完成（{doneRoots.length}）</span>
            </button>

            {revealDone && (
              <div className="divide-y divide-sahara-border overflow-hidden rounded-[10px] border border-sahara-border bg-sahara-surface">
                {visibleDoneRoots.map((task) => renderTask(task, 0))}
                {doneVisibleCount < doneRoots.length && (
                  <Button
                    variant="outline"
                    intent="default"
                    size="sm"
                    fullWidth
                    onClick={() => setDoneVisibleCount((count) => count + 20)}
                  >
                    显示更多（还有 {doneRoots.length - doneVisibleCount} 条）
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
