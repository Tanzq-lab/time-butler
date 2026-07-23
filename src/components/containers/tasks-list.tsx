import { useReducer, useEffect, useRef, useState } from "react";
import type { PointerEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useTaskStore } from "@/features/tasks/use-task-store";
import { useTimerStore } from "@/features/timer/use-timer-store";
import { useTaskFilter } from "@/features/tasks/use-task-filter";
import { useTodoStore } from "@/features/todos/use-todo-store";
import {
  Plus,
  Search,
  Filter,
  ListTodo,
  LayoutGrid,
  Target,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Repeat2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
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
import { TaskListCard } from "@/components/base/task-list-card";
import { TodoSection } from "@/components/base/todo-section";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PageHeader, SectionHeader } from "@/components/ui/page-header";
import type { Task } from "@/features/tasks/task-types";
import type { Todo } from "@/lib/db";
import { recordAppEvent } from "@/lib/db";
import {
  addRecurringTaskRule,
  getRecurringTaskRules,
  setRecurringTaskRuleEnabled,
  updateRecurringTaskRule,
  type UserRecurringTaskRule,
} from "@/features/tasks/recurring-task-rules";

interface ListState {
  searchQuery: string;
  viewMode: TaskViewMode;
  showAddModal: boolean;
  showRecurringModal: boolean;
  taskToEdit: Task | null;
  taskToComplete: Task | null;
  taskToRecord: Task | null;
  taskToDelete: Task | null;
  todoToConvert: Todo | null;
  showDone: boolean;
  doneVisibleCount: number;
}

type TaskViewMode = "list" | "grid";

const TASK_VIEW_MODE_STORAGE_KEY = "time-butler:task-view-mode:v1";

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
  pointerId: number;
  startY: number;
  isDragging: boolean;
  latestOffsetY: number;
  frameId: number | null;
  rowElement: HTMLElement;
  rowBounds: TaskRowBounds[];
}

type ListAction =
  | { type: "SET_SEARCH"; query: string }
  | { type: "SET_VIEW_MODE"; mode: TaskViewMode }
  | { type: "OPEN_ADD_MODAL"; taskToEdit?: Task | null }
  | { type: "OPEN_RECURRING_MODAL" }
  | { type: "CLOSE_RECURRING_MODAL" }
  | { type: "OPEN_CONVERT_MODAL"; todo: Todo }
  | { type: "CLOSE_ADD_MODAL" }
  | { type: "OPEN_COMPLETE_MODAL"; task: Task }
  | { type: "CLOSE_COMPLETE_MODAL" }
  | { type: "OPEN_NOTE_MODAL"; task: Task }
  | { type: "CLOSE_NOTE_MODAL" }
  | { type: "OPEN_DELETE_DIALOG"; task: Task }
  | { type: "CLOSE_DELETE_DIALOG" }
  | { type: "TOGGLE_DONE" }
  | { type: "SHOW_MORE_DONE" };

const INITIAL_LIST_STATE: ListState = {
  searchQuery: "",
  viewMode: "list",
  showAddModal: false,
  showRecurringModal: false,
  taskToEdit: null,
  taskToComplete: null,
  taskToRecord: null,
  taskToDelete: null,
  todoToConvert: null,
  showDone: false,
  doneVisibleCount: 20,
};

function loadTaskViewMode(): TaskViewMode {
  if (typeof window === "undefined") return "list";

  try {
    const savedMode = window.localStorage.getItem(TASK_VIEW_MODE_STORAGE_KEY);
    return savedMode === "grid" || savedMode === "list" ? savedMode : "list";
  } catch (error) {
    console.warn("[TasksList] Failed to restore task view mode:", error);
    return "list";
  }
}

function initializeListState(state: ListState): ListState {
  return { ...state, viewMode: loadTaskViewMode() };
}

function persistTaskViewMode(viewMode: TaskViewMode): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(TASK_VIEW_MODE_STORAGE_KEY, viewMode);
  } catch (error) {
    console.warn("[TasksList] Failed to persist task view mode:", error);
  }
}

function listReducer(state: ListState, action: ListAction): ListState {
  switch (action.type) {
    case "SET_SEARCH":
      return { ...state, searchQuery: action.query };
    case "SET_VIEW_MODE":
      return { ...state, viewMode: action.mode };
    case "OPEN_ADD_MODAL":
      return {
        ...state,
        showAddModal: true,
        taskToEdit: action.taskToEdit ?? null,
        todoToConvert: null,
      };
    case "OPEN_RECURRING_MODAL":
      return { ...state, showRecurringModal: true };
    case "CLOSE_RECURRING_MODAL":
      return { ...state, showRecurringModal: false };
    case "OPEN_CONVERT_MODAL":
      return {
        ...state,
        showAddModal: true,
        taskToEdit: null,
        todoToConvert: action.todo,
      };
    case "CLOSE_ADD_MODAL":
      return {
        ...state,
        showAddModal: false,
        taskToEdit: null,
        todoToConvert: null,
      };
    case "OPEN_COMPLETE_MODAL":
      return { ...state, taskToComplete: action.task };
    case "CLOSE_COMPLETE_MODAL":
      return { ...state, taskToComplete: null };
    case "OPEN_NOTE_MODAL":
      return { ...state, taskToRecord: action.task };
    case "CLOSE_NOTE_MODAL":
      return { ...state, taskToRecord: null };
    case "OPEN_DELETE_DIALOG":
      return { ...state, taskToDelete: action.task };
    case "CLOSE_DELETE_DIALOG":
      return { ...state, taskToDelete: null };
    case "TOGGLE_DONE":
      return { ...state, showDone: !state.showDone, doneVisibleCount: 20 };
    case "SHOW_MORE_DONE":
      return { ...state, doneVisibleCount: state.doneVisibleCount + 20 };
    default:
      return state;
  }
}

export function TasksList() {
  const navigate = useNavigate();
  const tasks = useTaskStore((s) => s.tasks);
  const addTask = useTaskStore((s) => s.addTask);
  const updateTask = useTaskStore((s) => s.updateTask);
  const reorderTasks = useTaskStore((s) => s.reorderTasks);
  const deleteTask = useTaskStore((s) => s.deleteTask);
  const completeTask = useTaskStore((s) => s.completeTask);
  const appendTaskNote = useTaskStore((s) => s.appendTaskNote);
  const loadTasks = useTaskStore((s) => s.loadTasks);
  const todos = useTodoStore((s) => s.todos);
  const archiveTodo = useTodoStore((s) => s.archiveTodo);

  const activeTaskId = useTimerStore((s) => s.activeTaskId);
  const currentSessionTaskId = useTimerStore((s) => s.currentSessionTaskId);
  const timerPhase = useTimerStore((s) => s.phase);
  const timerStatus = useTimerStore((s) => s.status);
  const setActiveTask = useTimerStore((s) => s.setActiveTask);

  const [listState, dispatch] = useReducer(
    listReducer,
    INITIAL_LIST_STATE,
    initializeListState,
  );
  const [draggingTaskId, setDraggingTaskId] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<TaskDropTarget | null>(null);
  const [recurringRules, setRecurringRules] = useState<UserRecurringTaskRule[]>([]);
  const pointerDragRef = useRef<PointerDrag | null>(null);
  const dropTargetRef = useRef<TaskDropTarget | null>(null);
  const {
    searchQuery,
    viewMode,
    showAddModal,
    showRecurringModal,
    taskToEdit,
    taskToComplete,
    taskToRecord,
    taskToDelete,
    todoToConvert,
    showDone,
    doneVisibleCount,
  } = listState;

  useEffect(() => {
    persistTaskViewMode(viewMode);
  }, [viewMode]);

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

  const {
    active: activeTasks,
    scheduled: scheduledTasks,
    done: doneTasks,
  } = useTaskFilter(
    tasks,
    searchQuery,
  );
  const sortedDoneTasks = [...doneTasks].sort((a, b) => {
    const aTime = a.completed_at ? new Date(a.completed_at).getTime() : 0;
    const bTime = b.completed_at ? new Date(b.completed_at).getTime() : 0;
    return bTime - aTime;
  });
  const visibleDoneTasks = sortedDoneTasks.slice(0, doneVisibleCount);
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const hasTodoMatch = todos.some(
    (todo) => !normalizedSearch || todo.title.toLowerCase().includes(normalizedSearch),
  );
  const canReorderActiveTasks =
    viewMode === "list" && !searchQuery.trim() && activeTasks.length > 1;

  const handleFocus = async (taskId: number) => {
    await setActiveTask(taskId);
    navigate("/");
  };

  const handleAddTask = async (data: AddTaskData) => {
    const task = await addTask(data.name, data.estimatedPomos);
    return Boolean(task);
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
        frequency: data.frequency,
        estimatedPomos: data.estimatedPomos,
        hasProject: Boolean(data.project),
        hasCategory: data.categoryId != null,
        startDate: data.startDate,
        scheduledTime: data.scheduledTime,
      },
    });
    return true;
  };

  const handleOpenRecurringModal = () => {
    dispatch({ type: "OPEN_RECURRING_MODAL" });
    void getRecurringTaskRules()
      .then(setRecurringRules)
      .catch((error) => {
        console.error("[TasksList] Failed to load recurring rules:", error);
      });
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
    const rules = await getRecurringTaskRules();
    setRecurringRules(rules);
    await loadTasks();
    void recordAppEvent({
      eventName: "recurring_task_rule_updated",
      route: "/tasks",
      entityType: "recurring_task_rule",
      entityId: ruleId,
      metadata: {
        frequency: data.frequency,
        estimatedPomos: data.estimatedPomos,
        hasProject: Boolean(data.project),
        hasCategory: data.categoryId != null,
        startDate: data.startDate,
        scheduledTime: data.scheduledTime,
      },
    });
    return true;
  };

  const handleEditTask = async (data: AddTaskData) => {
    if (!taskToEdit) return;
    await updateTask(
      taskToEdit.id,
      data.name,
      data.estimatedPomos,
    );
    return true;
  };

  const handleConvertTodo = async (data: AddTaskData) => {
    if (!todoToConvert) return false;
    const task = await addTask(data.name, data.estimatedPomos);
    if (!task) return false;

    return archiveTodo(todoToConvert.id, "todo_converted_to_task");
  };

  const handleCompleteTask = async (data: {
    actualPomos: number;
    review: string;
  }) => {
    if (!taskToComplete) return;
    await completeTask(taskToComplete.id, data.actualPomos, data.review);
    if (activeTaskId === taskToComplete.id) {
      await setActiveTask(null);
    }
    dispatch({ type: "CLOSE_COMPLETE_MODAL" });
  };

  const handleCompleteTaskRequest = (task: Task) => {
    dispatch({ type: "OPEN_COMPLETE_MODAL", task });
  };

  const handleAppendTaskNote = async (content: string) => {
    if (!taskToRecord) return false;
    return appendTaskNote(taskToRecord.id, content, "task-card");
  };

  const handleDeleteTask = async () => {
    if (!taskToDelete) return;
    await deleteTask(taskToDelete.id);
    if (activeTaskId === taskToDelete.id) await setActiveTask(null);
    dispatch({ type: "CLOSE_DELETE_DIALOG" });
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

  const captureTaskRowBounds = (): TaskRowBounds[] => {
    const activeTaskIds = new Set(activeTasks.map((task) => task.id));
    return Array.from(document.querySelectorAll<HTMLElement>("[data-task-id]"))
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
      .filter((row) => Number.isInteger(row.id) && activeTaskIds.has(row.id));
  };

  const getDropTargetAtY = (
    clientY: number,
    pointerDrag: PointerDrag,
  ): TaskDropTarget | null => {
    const row = pointerDrag.rowBounds.find(
      (bounds) =>
        bounds.id !== pointerDrag.taskId
        && clientY >= bounds.top
        && clientY <= bounds.bottom,
    );
    if (!row) return null;

    return {
      id: row.id,
      position: clientY < row.midpoint ? "before" : "after",
    };
  };

  const handleTaskPointerDown = (
    event: PointerEvent<HTMLElement>,
    taskId: number,
  ) => {
    if (event.button !== 0 || event.isPrimary === false || isTaskControl(event.target)) return;

    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pointerDragRef.current = {
      taskId,
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

  const handleTaskPointerMove = (event: PointerEvent<HTMLElement>) => {
    const pointerDrag = pointerDragRef.current;
    if (!pointerDrag || pointerDrag.pointerId !== event.pointerId) return;

    const offsetY = event.clientY - pointerDrag.startY;
    if (!pointerDrag.isDragging && Math.abs(offsetY) < 6) return;

    event.preventDefault();
    if (!pointerDrag.isDragging) {
      pointerDrag.isDragging = true;
      pointerDrag.rowBounds = captureTaskRowBounds();
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
    setCurrentDropTarget(getDropTargetAtY(event.clientY, pointerDrag));
  };

  const handleTaskPointerUp = (event: PointerEvent<HTMLElement>) => {
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

    const orderedIds = activeTasks.map((task) => task.id);
    const sourceIndex = orderedIds.indexOf(pointerDrag.taskId);
    const targetIndex = orderedIds.indexOf(target.id);
    if (sourceIndex < 0 || targetIndex < 0) return;

    const nextIds = [...orderedIds];
    nextIds.splice(sourceIndex, 1);
    const insertIndex = nextIds.indexOf(target.id) + (target.position === "after" ? 1 : 0);
    nextIds.splice(insertIndex, 0, pointerDrag.taskId);
    void reorderTasks(nextIds);
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        eyebrow="任务管理"
        title="我的任务"
        description="小事直接勾掉，需要投入时再开始专注。"
        className="mb-6 md:mb-8"
      />

      {/* Shared search */}
      <div className="mb-7 border-b border-sahara-border pb-5 md:mb-9">
        <div className="relative flex-1 sm:max-w-xs">
          <Search aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-sahara-text-muted" />
          <input
            type="text"
            name="task-search"
            autoComplete="off"
            aria-label="搜索待办和任务"
            placeholder="搜索待办和任务…"
            value={searchQuery}
            onChange={(e) => dispatch({ type: "SET_SEARCH", query: e.target.value })}
            className="h-9 w-full rounded-md border border-sahara-border bg-sahara-surface pl-9 pr-3 text-sm text-sahara-text outline-none transition-colors duration-150 placeholder:text-sahara-text-muted focus:border-sahara-text focus:ring-2 focus:ring-sahara-focus/20"
          />
        </div>
      </div>

      <AddTaskModal
        open={showAddModal}
        onClose={() => dispatch({ type: "CLOSE_ADD_MODAL" })}
        onSubmit={
          taskToEdit
            ? handleEditTask
            : todoToConvert
              ? handleConvertTodo
              : handleAddTask
        }
        initialName={todoToConvert?.title}
        editTask={taskToEdit}
      />
      <AddRecurringTaskModal
        open={showRecurringModal}
        onClose={() => dispatch({ type: "CLOSE_RECURRING_MODAL" })}
        onSubmit={handleAddRecurringTask}
        projectOptions={tasks.map((task) => task.project ?? "")}
        rules={recurringRules}
        onToggleRule={handleToggleRecurringRule}
        onUpdateRule={handleUpdateRecurringRule}
      />
      <TaskCompletionReviewModal
        open={!!taskToComplete}
        task={taskToComplete}
        onClose={() => dispatch({ type: "CLOSE_COMPLETE_MODAL" })}
        onSubmit={handleCompleteTask}
      />
      <TaskNoteModal
        open={!!taskToRecord}
        task={taskToRecord}
        onClose={() => dispatch({ type: "CLOSE_NOTE_MODAL" })}
        onSubmit={handleAppendTaskNote}
      />
      <ConfirmDialog
        open={!!taskToDelete}
        title="删除任务？"
        description={taskToDelete ? `“${taskToDelete.name}”将从任务列表中移除，此操作无法撤销。` : ""}
        confirmLabel="删除任务"
        destructive
        onClose={() => dispatch({ type: "CLOSE_DELETE_DIALOG" })}
        onConfirm={handleDeleteTask}
      />

      <TodoSection
        searchQuery={searchQuery}
        onConvert={(todo) => dispatch({ type: "OPEN_CONVERT_MODAL", todo })}
      />

      <section
        aria-label="专注任务"
        aria-describedby={canReorderActiveTasks ? "task-reorder-help" : undefined}
        className="border-t border-sahara-border pt-8 md:pt-9"
      >
        <SectionHeader
          title="专注任务"
          meta={
            <span className="text-xs text-sahara-text-muted">
              {activeTasks.length + scheduledTasks.length}
            </span>
          }
          actions={
            <div role="group" aria-label="专注任务操作" className="flex items-center gap-2">
              <Button
                variant={viewMode === "list" ? "solid" : "outline"}
                intent={viewMode === "list" ? "sahara" : "default"}
                size="icon"
                aria-label="列表视图"
                aria-pressed={viewMode === "list"}
                onClick={() => dispatch({ type: "SET_VIEW_MODE", mode: "list" })}
                className="min-h-10 min-w-10 border-sahara-border"
              >
                <ListTodo aria-hidden="true" className="size-4" />
              </Button>
              <Button
                variant={viewMode === "grid" ? "solid" : "outline"}
                intent={viewMode === "grid" ? "sahara" : "default"}
                size="icon"
                aria-label="网格视图"
                aria-pressed={viewMode === "grid"}
                onClick={() => dispatch({ type: "SET_VIEW_MODE", mode: "grid" })}
                className="min-h-10 min-w-10 border-sahara-border"
              >
                <LayoutGrid aria-hidden="true" className="size-4" />
              </Button>
              <Button
                variant="outline"
                intent="default"
                size="sm"
                aria-label="添加循环任务"
                onClick={handleOpenRecurringModal}
                className="ml-1 min-h-10 gap-1.5 px-2.5 text-xs font-medium md:ml-2 md:px-3"
              >
                <Repeat2 aria-hidden="true" className="size-3.5 md:size-4" />
                <span className="hidden md:inline">添加循环任务</span>
              </Button>
              <Button
                variant="solid"
                intent="sahara"
                size="sm"
                aria-label="添加专注任务"
                onClick={() => dispatch({ type: "OPEN_ADD_MODAL" })}
                className="min-h-10 gap-1.5 px-2.5 text-xs font-medium md:px-3"
              >
                <Plus aria-hidden="true" className="size-3.5 md:size-4" />
                <span className="hidden sm:inline">添加专注任务</span>
              </Button>
            </div>
          }
          className="mb-5"
        />

      {/* Task Sections */}
      {activeTasks.length === 0 &&
      scheduledTasks.length === 0 &&
      doneTasks.length === 0 &&
      searchQuery &&
      !hasTodoMatch ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Filter className="size-12 text-sahara-border mb-4" />
          <p className="text-sm font-semibold text-sahara-text-secondary">
            没有找到任务
          </p>
          <p className="mt-1 text-xs text-sahara-text-secondary">
            换个关键词试试
          </p>
        </div>
      ) : (
        <div className="space-y-9">
          {/* Active Tasks */}
          {activeTasks.length > 0 && (
            <div>
              <SectionHeader
                title="进行中"
                meta={<span className="text-xs text-sahara-text-muted">{activeTasks.length}</span>}
                className="mb-3"
              />
              <div
                className={cn(
                  viewMode === "grid"
                    ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4"
                    : "space-y-2.5 md:space-y-3",
                )}
              >
                {activeTasks.map((task) => (
                  <TaskListCard
                    key={task.id}
                    task={task}
                    isActive={activeTaskId === task.id}
                    runtimeStatus={
                      timerPhase === "work"
                      && currentSessionTaskId === task.id
                      && timerStatus !== "idle"
                        ? timerStatus
                        : null
                    }
                    onToggleActive={() =>
                      setActiveTask(activeTaskId === task.id ? null : task.id)
                    }
                    onFocus={() => handleFocus(task.id)}
                    onRecord={() =>
                      dispatch({ type: "OPEN_NOTE_MODAL", task })
                    }
                    onEdit={() =>
                      dispatch({ type: "OPEN_ADD_MODAL", taskToEdit: task })
                    }
                    onDelete={() => dispatch({ type: "OPEN_DELETE_DIALOG", task })}
                    onCompleteTask={() => handleCompleteTaskRequest(task)}
                    layout={viewMode}
                    reorderable={canReorderActiveTasks}
                    dragging={draggingTaskId === task.id}
                    dropIndicator={
                      dropTarget?.id === task.id ? dropTarget.position : null
                    }
                    onPointerDown={(event) => handleTaskPointerDown(event, task.id)}
                    onPointerMove={handleTaskPointerMove}
                    onPointerUp={handleTaskPointerUp}
                    onPointerCancel={clearPointerDrag}
                  />
                ))}
              </div>
              {canReorderActiveTasks && (
                <p id="task-reorder-help" className="sr-only">
                  按住任务空白处或点阵，拖到另一项任务的上方或下方以调整优先顺序。
                </p>
              )}
            </div>
          )}

          {/* Active tasks empty state (when search yields results only in done) */}
          {activeTasks.length === 0 &&
            scheduledTasks.length === 0 &&
            doneTasks.length > 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Target className="size-10 text-sahara-border mb-3" />
              <p className="text-sm font-semibold text-sahara-text-secondary">
                没有进行中的任务
              </p>
              <p className="mt-1 text-xs text-sahara-text-secondary">
                所有任务都完成啦！
              </p>
            </div>
          )}

          {scheduledTasks.length > 0 && (
            <div>
              <div className="mb-3 flex items-center gap-2">
                <CalendarClock className="size-4 text-amber-600" />
                <span className="text-xs font-semibold text-sahara-text-secondary">
                  稍后提醒（{scheduledTasks.length}）
                </span>
              </div>
              <div
                className={cn(
                  viewMode === "grid"
                    ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4"
                    : "space-y-2.5 md:space-y-3",
                )}
              >
                {scheduledTasks.map((task) => (
                  <TaskListCard
                    key={task.id}
                    task={task}
                    isActive={false}
                    isScheduled
                    onToggleActive={() => undefined}
                    onRecord={() =>
                      dispatch({ type: "OPEN_NOTE_MODAL", task })
                    }
                    onEdit={() =>
                      dispatch({ type: "OPEN_ADD_MODAL", taskToEdit: task })
                    }
                    onDelete={() => dispatch({ type: "OPEN_DELETE_DIALOG", task })}
                    onCompleteTask={() => handleCompleteTaskRequest(task)}
                    layout={viewMode}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Done Tasks */}
          {doneTasks.length > 0 && (
            <div>
              <button
                onClick={() => dispatch({ type: "TOGGLE_DONE" })}
                aria-expanded={showDone}
                className="mb-3 flex w-full items-center gap-2 rounded-md py-1 text-left text-sahara-text-secondary outline-none hover:text-sahara-text focus-visible:ring-2 focus-visible:ring-sahara-focus"
              >
                {showDone ? (
                  <ChevronDown className="size-4 text-sahara-text-muted" />
                ) : (
                  <ChevronRight className="size-4 text-sahara-text-muted" />
                )}
                <CheckCircle2 className="size-4 text-green-500" />
                <span className="text-xs font-semibold">
                  已完成（{doneTasks.length}）
                </span>
              </button>

              {showDone && (
                <div
                  className={cn(
                    viewMode === "grid"
                      ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4"
                      : "space-y-2.5 md:space-y-3",
                  )}
                >
                  {visibleDoneTasks.map((task) => (
                    <TaskListCard
                      key={task.id}
                      task={task}
                      isActive={false}
                      onToggleActive={() => setActiveTask(task.id)}
                      onEdit={() =>
                        dispatch({ type: "OPEN_ADD_MODAL", taskToEdit: task })
                      }
                      onDelete={() => dispatch({ type: "OPEN_DELETE_DIALOG", task })}
                      onCompleteTask={() => handleCompleteTaskRequest(task)}
                      layout={viewMode}
                    />
                  ))}
                  {doneVisibleCount < sortedDoneTasks.length && (
                    <Button
                      variant="outline"
                      intent="default"
                      size="sm"
                      onClick={() => dispatch({ type: "SHOW_MORE_DONE" })}
                      className={cn(viewMode === "grid" ? "sm:col-span-2 lg:col-span-3" : "w-full")}
                    >
                      显示更多（还有 {sortedDoneTasks.length - doneVisibleCount} 条）
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
      </section>
    </div>
  );
}
