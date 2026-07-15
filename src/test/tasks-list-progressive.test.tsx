import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TasksList } from "@/components/containers/tasks-list";
import { useTaskStore } from "@/features/tasks/use-task-store";
import { useCategoriesStore } from "@/features/categories/use-categories-store";
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
    useCategoriesStore.setState({
      categories: [],
      loadCategories: vi.fn().mockResolvedValue(undefined),
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
