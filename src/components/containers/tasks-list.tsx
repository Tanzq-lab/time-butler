import { useReducer, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTaskStore } from "@/features/tasks/use-task-store";
import { useTimerStore } from "@/features/timer/use-timer-store";
import { useTaskFilter } from "@/features/tasks/use-task-filter";
import { useCategoriesStore } from "@/features/categories/use-categories-store";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import {
  AddTaskModal,
  type AddTaskData,
} from "@/components/base/add-task-modal";
import { TaskCompletionReviewModal } from "@/components/base/task-completion-review-modal";
import { TaskListCard } from "@/components/base/task-list-card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PageHeader, SectionHeader } from "@/components/ui/page-header";
import type { Task } from "@/features/tasks/task-types";

interface ListState {
  searchQuery: string;
  viewMode: "list" | "grid";
  showAddModal: boolean;
  taskToEdit: Task | null;
  taskToComplete: Task | null;
  taskToDelete: Task | null;
  showDone: boolean;
  doneVisibleCount: number;
}

type ListAction =
  | { type: "SET_SEARCH"; query: string }
  | { type: "SET_VIEW_MODE"; mode: "list" | "grid" }
  | { type: "OPEN_ADD_MODAL"; taskToEdit?: Task | null }
  | { type: "CLOSE_ADD_MODAL" }
  | { type: "OPEN_COMPLETE_MODAL"; task: Task }
  | { type: "CLOSE_COMPLETE_MODAL" }
  | { type: "OPEN_DELETE_DIALOG"; task: Task }
  | { type: "CLOSE_DELETE_DIALOG" }
  | { type: "TOGGLE_DONE" }
  | { type: "SHOW_MORE_DONE" };

const INITIAL_LIST_STATE: ListState = {
  searchQuery: "",
  viewMode: "list",
  showAddModal: false,
  taskToEdit: null,
  taskToComplete: null,
  taskToDelete: null,
  showDone: false,
  doneVisibleCount: 20,
};

function listReducer(state: ListState, action: ListAction): ListState {
  switch (action.type) {
    case "SET_SEARCH":
      return { ...state, searchQuery: action.query };
    case "SET_VIEW_MODE":
      return { ...state, viewMode: action.mode };
    case "OPEN_ADD_MODAL":
      return { ...state, showAddModal: true, taskToEdit: action.taskToEdit ?? null };
    case "CLOSE_ADD_MODAL":
      return { ...state, showAddModal: false, taskToEdit: null };
    case "OPEN_COMPLETE_MODAL":
      return { ...state, taskToComplete: action.task };
    case "CLOSE_COMPLETE_MODAL":
      return { ...state, taskToComplete: null };
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
  const deleteTask = useTaskStore((s) => s.deleteTask);
  const completeTask = useTaskStore((s) => s.completeTask);
  const loadTasks = useTaskStore((s) => s.loadTasks);

  const activeTaskId = useTimerStore((s) => s.activeTaskId);
  const setActiveTask = useTimerStore((s) => s.setActiveTask);

  const [listState, dispatch] = useReducer(listReducer, INITIAL_LIST_STATE);
  const {
    searchQuery,
    viewMode,
    showAddModal,
    taskToEdit,
    taskToComplete,
    taskToDelete,
    showDone,
    doneVisibleCount,
  } = listState;

  const categories = useCategoriesStore((s) => s.categories);
  const loadCategories = useCategoriesStore((s) => s.loadCategories);

  useEffect(() => {
    loadCategories();
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

  const handleFocus = async (taskId: number) => {
    await setActiveTask(taskId);
    navigate("/");
  };

  const handleAddTask = async (data: AddTaskData) => {
    await addTask(
      data.name,
      data.estimatedPomos,
      data.project,
      data.priority,
      data.categoryId,
      data.scheduledFor,
    );
    dispatch({ type: "CLOSE_ADD_MODAL" });
  };

  const handleEditTask = async (data: AddTaskData) => {
    if (!taskToEdit) return;
    await updateTask(
      taskToEdit.id,
      data.name,
      data.estimatedPomos,
      data.project || null,
      data.priority || null,
      data.categoryId,
      data.scheduledFor,
    );
    dispatch({ type: "CLOSE_ADD_MODAL" });
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

  const handleDeleteTask = async () => {
    if (!taskToDelete) return;
    await deleteTask(taskToDelete.id);
    if (activeTaskId === taskToDelete.id) await setActiveTask(null);
    dispatch({ type: "CLOSE_DELETE_DIALOG" });
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        eyebrow="任务管理"
        title="我的任务"
        description="选择下一件事，开始专注，完成后留下简短复盘。"
        className="mb-6 md:mb-8"
      />

      {/* Controls */}
      <div className="mb-7 flex flex-col items-stretch gap-3 border-b border-sahara-border pb-5 sm:flex-row sm:items-center md:mb-9">
        <div className="relative flex-1 sm:max-w-xs">
          <Search aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-sahara-text-muted" />
          <input
            type="text"
            name="task-search"
            autoComplete="off"
            aria-label="搜索任务"
            placeholder="搜索任务…"
            value={searchQuery}
            onChange={(e) => dispatch({ type: "SET_SEARCH", query: e.target.value })}
            className="h-9 w-full rounded-md border border-sahara-border bg-sahara-surface pl-9 pr-3 text-sm text-sahara-text outline-none transition-colors duration-150 placeholder:text-sahara-text-muted focus:border-sahara-text focus:ring-2 focus:ring-sahara-focus/20"
          />
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto ml-auto">
          <Button
            variant={viewMode === "list" ? "solid" : "outline"}
            intent={viewMode === "list" ? "sahara" : "default"}
            size="icon"
            aria-label="列表视图"
            aria-pressed={viewMode === "list"}
            onClick={() => dispatch({ type: "SET_VIEW_MODE", mode: "list" })}
            className="border-sahara-border"
          >
            <ListTodo className="size-4" />
          </Button>
          <Button
            variant={viewMode === "grid" ? "solid" : "outline"}
            intent={viewMode === "grid" ? "sahara" : "default"}
            size="icon"
            aria-label="网格视图"
            aria-pressed={viewMode === "grid"}
            onClick={() => dispatch({ type: "SET_VIEW_MODE", mode: "grid" })}
            className="border-sahara-border"
          >
            <LayoutGrid className="size-4" />
          </Button>
          <Button
            variant="solid"
            intent="sahara"
            size="sm"
            aria-label="添加任务"
            onClick={() => dispatch({ type: "OPEN_ADD_MODAL" })}
            className="ml-1 gap-1.5 px-3 text-xs font-medium md:ml-2"
          >
            <Plus className="size-3.5 md:size-4" />
            <span className="hidden sm:inline">添加任务</span>
          </Button>
        </div>
      </div>

      <AddTaskModal
        open={showAddModal}
        onClose={() => dispatch({ type: "CLOSE_ADD_MODAL" })}
        onSubmit={taskToEdit ? handleEditTask : handleAddTask}
        editTask={taskToEdit}
        categories={categories}
      />
      <TaskCompletionReviewModal
        open={!!taskToComplete}
        task={taskToComplete}
        onClose={() => dispatch({ type: "CLOSE_COMPLETE_MODAL" })}
        onSubmit={handleCompleteTask}
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

      {/* Task Sections */}
      {activeTasks.length === 0 &&
      scheduledTasks.length === 0 &&
      doneTasks.length === 0 &&
      searchQuery ? (
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
                    onToggleActive={() =>
                      setActiveTask(activeTaskId === task.id ? null : task.id)
                    }
                    onFocus={() => handleFocus(task.id)}
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
    </div>
  );
}
