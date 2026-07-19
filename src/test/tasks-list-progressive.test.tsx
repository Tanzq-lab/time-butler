import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TasksList } from "@/components/containers/tasks-list";
import { useTaskStore } from "@/features/tasks/use-task-store";
import { useTodoStore } from "@/features/todos/use-todo-store";
import type { Task } from "@/features/tasks/task-types";

function completedTask(index: number): Task {
  const day = String(index + 1).padStart(2, "0");
  return {
    id: index + 1,
    name: `已完成任务 ${index + 1}`,
    estimated_pomos: 1,
    completed_pomos: 1,
    completed_at: `2026-06-${day}T10:00:00`,
    created_at: `2026-06-${day}T09:00:00`,
    archived: 0,
  };
}

function activeTask(id: number, name: string, sortOrder: number): Task {
  return {
    id,
    name,
    estimated_pomos: 1,
    completed_pomos: 0,
    sort_order: sortOrder,
    created_at: `2026-07-19T0${id}:00:00.000Z`,
    archived: 0,
  };
}

beforeEach(() => {
  useTodoStore.setState({
    todos: [],
    loadTodos: vi.fn().mockResolvedValue(undefined),
  });
});

describe("TasksList completed task disclosure", () => {
  beforeEach(() => {
    useTaskStore.setState({
      tasks: Array.from({ length: 21 }, (_, index) => completedTask(index)),
      loadTasks: vi.fn().mockResolvedValue(undefined),
      deleteTask: vi.fn().mockResolvedValue(undefined),
      updateTask: vi.fn().mockResolvedValue(undefined),
      completeTask: vi.fn().mockResolvedValue(undefined),
      addTask: vi.fn().mockResolvedValue(undefined),
    });
  });

  it("starts collapsed, then reveals the newest 20 and loads the remainder", () => {
    render(
      <MemoryRouter>
        <TasksList />
      </MemoryRouter>,
    );

    const disclosure = screen.getByRole("button", { name: /已完成（21）/ });
    expect(disclosure).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("已完成任务 21")).not.toBeInTheDocument();

    fireEvent.click(disclosure);

    expect(disclosure).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("已完成任务 21")).toBeInTheDocument();
    expect(screen.queryByText("已完成任务 1")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /显示更多/ }));
    expect(screen.getByText("已完成任务 1")).toBeInTheDocument();
  });
});

describe("TasksList active task ordering", () => {
  beforeEach(() => {
    useTaskStore.setState({
      tasks: [
        activeTask(11, "先做这个", 0),
        activeTask(12, "再做那个", 1),
      ],
      loadTasks: vi.fn().mockResolvedValue(undefined),
      reorderTasks: vi.fn().mockResolvedValue(true),
      deleteTask: vi.fn().mockResolvedValue(undefined),
      updateTask: vi.fn().mockResolvedValue(undefined),
      completeTask: vi.fn().mockResolvedValue(undefined),
      addTask: vi.fn().mockResolvedValue(undefined),
    });
  });

  it("persists a pointer drag only for the unfiltered active list", async () => {
    const reorderTasks = useTaskStore.getState().reorderTasks as ReturnType<typeof vi.fn>;
    render(
      <MemoryRouter>
        <TasksList />
      </MemoryRouter>,
    );

    expect(screen.getAllByTitle("按住任务空白处或点阵拖动调整顺序")).toHaveLength(2);
    const firstRow = (await screen.findByText("先做这个")).closest("[data-task-id]")!;
    const secondRow = screen.getByText("再做那个").closest("[data-task-id]")!;
    vi.spyOn(firstRow, "getBoundingClientRect").mockReturnValue({
      top: 0,
      bottom: 48,
      height: 48,
    } as DOMRect);
    vi.spyOn(secondRow, "getBoundingClientRect").mockReturnValue({
      top: 48,
      bottom: 96,
      height: 48,
    } as DOMRect);
    const frameCallbacks: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      frameCallbacks.push(callback);
      return frameCallbacks.length;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    fireEvent.pointerDown(firstRow, { button: 0, clientY: 0, isPrimary: true, pointerId: 1 });
    fireEvent.pointerMove(firstRow, { clientX: 0, clientY: 80, isPrimary: true, pointerId: 1 });
    frameCallbacks[0](0);
    fireEvent.pointerUp(firstRow, { clientX: 0, clientY: 80, isPrimary: true, pointerId: 1 });

    await waitFor(() => expect(reorderTasks).toHaveBeenCalledWith([12, 11]));

    fireEvent.click(screen.getByRole("button", { name: "网格视图" }));
    expect(screen.queryAllByTitle("按住任务空白处或点阵拖动调整顺序")).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: "列表视图" }));
    fireEvent.change(screen.getByRole("textbox", { name: "搜索待办和任务" }), {
      target: { value: "先做" },
    });
    expect(screen.queryAllByTitle("按住任务空白处或点阵拖动调整顺序")).toHaveLength(0);
  });
});
