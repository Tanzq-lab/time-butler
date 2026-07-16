import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TodoSection } from "@/components/base/todo-section";
import { useTodoStore } from "@/features/todos/use-todo-store";

const openTodo = {
  id: 11,
  title: "买咖啡豆",
  sort_order: 0,
  completed_at: null,
  archived: 0,
  created_at: "2026-07-15T01:00:00.000Z",
  updated_at: "2026-07-15T01:00:00.000Z",
};

vi.mock("@/lib/db", () => ({
  getTodos: vi.fn().mockResolvedValue([]),
  addTodo: vi.fn().mockResolvedValue(12),
  reorderTodos: vi.fn().mockResolvedValue(undefined),
  updateTodoTitle: vi.fn().mockResolvedValue(undefined),
  setTodoCompleted: vi.fn().mockResolvedValue(undefined),
  archiveTodo: vi.fn().mockResolvedValue(undefined),
  recordAppEvent: vi.fn().mockResolvedValue(undefined),
}));

beforeEach(async () => {
  vi.clearAllMocks();
  useTodoStore.setState({ todos: [], loading: false, error: null });
  const { getTodos } = await import("@/lib/db");
  vi.mocked(getTodos).mockResolvedValue([]);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("TodoSection", () => {
  it("creates a todo from the quick-add form and clears the input", async () => {
    render(<TodoSection searchQuery="" onConvert={vi.fn()} />);
    const input = screen.getByPlaceholderText("添加待办，按回车保存…");

    fireEvent.change(input, { target: { value: "买收纳盒" } });
    fireEvent.submit(input.closest("form")!);

    await waitFor(() => expect(screen.getByText("买收纳盒")).toBeVisible());
    expect(input).toHaveValue("");
  });

  it("completes, reveals, and reopens a todo", async () => {
    const { getTodos } = await import("@/lib/db");
    vi.mocked(getTodos).mockResolvedValue([openTodo]);
    render(<TodoSection searchQuery="" onConvert={vi.fn()} />);

    const complete = await screen.findByRole("checkbox", { name: "完成待办：买咖啡豆" });
    fireEvent.click(complete);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "已完成待办（1）" })).toBeVisible(),
    );
    fireEvent.click(screen.getByRole("button", { name: "已完成待办（1）" }));
    const reopen = screen.getByRole("checkbox", { name: "恢复待办：买咖啡豆" });
    fireEvent.click(reopen);

    await waitFor(() =>
      expect(screen.getByRole("checkbox", { name: "完成待办：买咖啡豆" })).toBeVisible(),
    );
  });

  it("edits and offers conversion without removing the todo", async () => {
    const { getTodos } = await import("@/lib/db");
    vi.mocked(getTodos).mockResolvedValue([openTodo]);
    const onConvert = vi.fn();
    render(<TodoSection searchQuery="" onConvert={onConvert} />);

    await screen.findByText("买咖啡豆");
    fireEvent.click(screen.getByRole("button", { name: "编辑待办：买咖啡豆" }));
    const editInput = screen.getByRole("textbox", { name: "编辑待办：买咖啡豆" });
    fireEvent.change(editInput, { target: { value: "买深烘咖啡豆" } });
    fireEvent.click(screen.getByRole("button", { name: "保存待办：买咖啡豆" }));

    await waitFor(() => expect(screen.getByText("买深烘咖啡豆")).toBeVisible());
    fireEvent.click(
      screen.getByRole("button", { name: "转为专注任务：买深烘咖啡豆" }),
    );
    expect(onConvert).toHaveBeenCalledWith(
      expect.objectContaining({ id: 11, title: "买深烘咖啡豆" }),
    );
    expect(screen.getByText("买深烘咖啡豆")).toBeVisible();
  });

  it("filters todos by the shared page search", async () => {
    const { getTodos } = await import("@/lib/db");
    vi.mocked(getTodos).mockResolvedValue([
      openTodo,
      { ...openTodo, id: 13, title: "预约体检" },
    ]);

    render(<TodoSection searchQuery="体检" onConvert={vi.fn()} />);

    expect(await screen.findByText("预约体检")).toBeVisible();
    expect(screen.queryByText("买咖啡豆")).not.toBeInTheDocument();
  });

  it("reorders with a pointer drag and keeps the add form above completed todos", async () => {
    const { getTodos, reorderTodos } = await import("@/lib/db");
    vi.mocked(getTodos).mockResolvedValue([
      openTodo,
      { ...openTodo, id: 12, title: "预约体检", sort_order: 1 },
      {
        ...openTodo,
        id: 13,
        title: "旧待办",
        sort_order: 0,
        completed_at: "2026-07-15T02:00:00.000Z",
      },
    ]);
    render(<TodoSection searchQuery="" onConvert={vi.fn()} />);

    const firstRow = (await screen.findByText("买咖啡豆")).closest("[data-todo-id]")!;
    const secondRow = screen.getByText("预约体检").closest("[data-todo-id]")!;
    vi.spyOn(firstRow, "getBoundingClientRect").mockReturnValue({
      top: 0,
      bottom: 40,
      height: 40,
    } as DOMRect);
    vi.spyOn(secondRow, "getBoundingClientRect").mockReturnValue({
      top: 40,
      bottom: 80,
      height: 40,
    } as DOMRect);
    const frameCallbacks: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      frameCallbacks.push(callback);
      return frameCallbacks.length;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    fireEvent.pointerDown(firstRow, { button: 0, clientY: 0, isPrimary: true, pointerId: 1 });
    fireEvent.pointerMove(firstRow, { clientX: 0, clientY: 45, isPrimary: true, pointerId: 1 });
    fireEvent.pointerMove(firstRow, { clientX: 0, clientY: 65, isPrimary: true, pointerId: 1 });
    expect(frameCallbacks).toHaveLength(1);
    frameCallbacks[0](0);
    expect(firstRow).toHaveStyle({ transform: "translate3d(0, 65px, 0) scale(1.01)" });
    fireEvent.pointerUp(firstRow, { clientX: 0, clientY: 65, isPrimary: true, pointerId: 1 });

    await waitFor(() => expect(reorderTodos).toHaveBeenCalledWith([12, 11], expect.any(String)));
    expect(
      Array.from(document.querySelectorAll("[data-todo-id]")).map((row) =>
        row.getAttribute("data-todo-id"),
      ),
    ).toEqual(["12", "11"]);

    const addInput = screen.getByRole("textbox", { name: "添加待办" });
    const completedToggle = screen.getByRole("button", { name: "已完成待办（1）" });
    expect(addInput.compareDocumentPosition(completedToggle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
