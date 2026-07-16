import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTodoStore } from "@/features/todos/use-todo-store";

const { storedTodos } = vi.hoisted(() => ({
  storedTodos: [
    {
      id: 1,
      title: "买打印纸",
      sort_order: 0,
      completed_at: null,
      archived: 0,
      created_at: "2026-07-15T01:00:00.000Z",
      updated_at: "2026-07-15T01:00:00.000Z",
    },
  ],
}));

vi.mock("@/lib/db", () => ({
  getTodos: vi.fn().mockResolvedValue(storedTodos),
  addTodo: vi.fn().mockResolvedValue(2),
  reorderTodos: vi.fn().mockResolvedValue(undefined),
  updateTodoTitle: vi.fn().mockResolvedValue(undefined),
  setTodoCompleted: vi.fn().mockResolvedValue(undefined),
  archiveTodo: vi.fn().mockResolvedValue(undefined),
  recordAppEvent: vi.fn().mockResolvedValue(undefined),
}));

beforeEach(() => {
  vi.clearAllMocks();
  useTodoStore.setState({ todos: [], loading: false, error: null });
});

describe("useTodoStore", () => {
  it("loads visible todos", async () => {
    await useTodoStore.getState().loadTodos();

    expect(useTodoStore.getState().todos).toEqual(storedTodos);
    expect(useTodoStore.getState().loading).toBe(false);
  });

  it("trims and creates a todo without task estimation metadata", async () => {
    const { addTodo, recordAppEvent } = await import("@/lib/db");

    const todo = await useTodoStore.getState().addTodo("  买转换插头  ");

    expect(todo?.title).toBe("买转换插头");
    expect(addTodo).toHaveBeenCalledWith("买转换插头", expect.any(String));
    expect(recordAppEvent).toHaveBeenCalledWith({
      eventName: "todo_added",
      route: "/tasks",
      entityType: "todo",
      entityId: 2,
    });
    expect(JSON.stringify(vi.mocked(recordAppEvent).mock.calls[0][0])).not.toContain(
      "买转换插头",
    );
  });

  it("ignores an empty todo", async () => {
    const { addTodo } = await import("@/lib/db");

    expect(await useTodoStore.getState().addTodo("   ")).toBeNull();
    expect(addTodo).not.toHaveBeenCalled();
  });

  it("updates a todo title", async () => {
    const { updateTodoTitle, recordAppEvent } = await import("@/lib/db");
    useTodoStore.setState({ todos: storedTodos });

    expect(await useTodoStore.getState().updateTodo(1, "  买 A4 打印纸  ")).toBe(true);

    expect(updateTodoTitle).toHaveBeenCalledWith(
      1,
      "买 A4 打印纸",
      expect.any(String),
    );
    expect(useTodoStore.getState().todos[0].title).toBe("买 A4 打印纸");
    expect(recordAppEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventName: "todo_updated", entityId: 1 }),
    );
  });

  it("persists a reordered set of open todos without touching completed todos", async () => {
    const { reorderTodos, recordAppEvent } = await import("@/lib/db");
    useTodoStore.setState({
      todos: [
        storedTodos[0],
        { ...storedTodos[0], id: 2, title: "预约体检", sort_order: 1 },
        {
          ...storedTodos[0],
          id: 3,
          title: "已完成待办",
          completed_at: "2026-07-15T02:00:00.000Z",
          sort_order: 2,
        },
      ],
    });

    expect(await useTodoStore.getState().reorderOpenTodos([2, 1])).toBe(true);

    expect(reorderTodos).toHaveBeenCalledWith([2, 1], expect.any(String));
    expect(useTodoStore.getState().todos.map((todo) => todo.id)).toEqual([2, 1, 3]);
    expect(useTodoStore.getState().todos.map((todo) => todo.sort_order)).toEqual([0, 1, 2]);
    expect(recordAppEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventName: "todo_reordered", metadata: { count: 2 } }),
    );
  });

  it("completes and reopens without writing pomodoro fields", async () => {
    const { setTodoCompleted, recordAppEvent } = await import("@/lib/db");
    useTodoStore.setState({ todos: storedTodos });

    expect(await useTodoStore.getState().setCompleted(1, true)).toBe(true);
    expect(setTodoCompleted).toHaveBeenLastCalledWith(
      1,
      expect.any(String),
      expect.any(String),
    );
    expect(useTodoStore.getState().todos[0].completed_at).toBeTruthy();
    expect(recordAppEvent).toHaveBeenLastCalledWith(
      expect.objectContaining({ eventName: "todo_completed" }),
    );

    expect(await useTodoStore.getState().setCompleted(1, false)).toBe(true);
    expect(setTodoCompleted).toHaveBeenLastCalledWith(1, null, expect.any(String));
    expect(useTodoStore.getState().todos[0].completed_at).toBeNull();
    expect(recordAppEvent).toHaveBeenLastCalledWith(
      expect.objectContaining({ eventName: "todo_reopened" }),
    );
  });

  it("soft archives a converted todo with the conversion event", async () => {
    const { archiveTodo, recordAppEvent } = await import("@/lib/db");
    useTodoStore.setState({ todos: storedTodos });

    expect(
      await useTodoStore
        .getState()
        .archiveTodo(1, "todo_converted_to_task"),
    ).toBe(true);

    expect(archiveTodo).toHaveBeenCalledWith(1, expect.any(String));
    expect(useTodoStore.getState().todos).toEqual([]);
    expect(recordAppEvent).toHaveBeenCalledWith({
      eventName: "todo_converted_to_task",
      route: "/tasks",
      entityType: "todo",
      entityId: 1,
    });
  });

  it("keeps the todo visible when archiving fails", async () => {
    const { archiveTodo } = await import("@/lib/db");
    vi.mocked(archiveTodo).mockRejectedValueOnce(new Error("DB error"));
    useTodoStore.setState({ todos: storedTodos });

    expect(await useTodoStore.getState().archiveTodo(1)).toBe(false);
    expect(useTodoStore.getState().todos).toEqual(storedTodos);
    expect(useTodoStore.getState().error).toBe("Error: DB error");
  });
});
