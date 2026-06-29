import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MarkdownEditor } from "@/components/ui/markdown-editor";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import DocumentNoteEditor from "@/components/containers/document-note-editor";
import { SessionCard } from "@/components/base/session-card";
import { TaskListCard } from "@/components/base/task-list-card";
import type { Session } from "@/lib/db";
import type { Task } from "@/features/tasks/task-types";

const SAMPLE_MARKDOWN = `## 今日复盘

### 完成事项

- [x] 完成时间计划工作台 Markdown 渲染
- [ ] 优化 Obsidian 式编辑体验

**重点结论：**
工作台里的长文本内容应该保存为 Markdown，并在展示时渲染。

> 这是一个复盘引用块。

---

\`行内代码\`

\`\`\`js
console.log("time-butler");
\`\`\``;

describe("Markdown components", () => {
  it("renders common GFM Markdown as formatted content", () => {
    const { container } = render(<MarkdownRenderer content={SAMPLE_MARKDOWN} />);

    expect(
      screen.getByRole("heading", { level: 2, name: "今日复盘" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 3, name: "完成事项" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("checkbox")[0]).toBeChecked();
    expect(screen.getAllByRole("checkbox")[1]).not.toBeChecked();
    expect(screen.getByText("重点结论：").tagName).toBe("STRONG");
    expect(screen.getByText("这是一个复盘引用块。")).toBeInTheDocument();
    expect(screen.getByText('console.log("time-butler");')).toBeInTheDocument();
    expect(container.textContent).not.toContain("## 今日复盘");
  });

  it("keeps Markdown editable and renders it in preview mode", () => {
    render(
      <MarkdownEditor
        value={SAMPLE_MARKDOWN}
        onChange={vi.fn()}
        ariaLabel="复盘内容"
        placeholder="写复盘..."
        variant="compact"
      />,
    );

    expect(screen.getByLabelText("复盘内容")).toHaveValue(SAMPLE_MARKDOWN);
    fireEvent.click(screen.getByRole("button", { name: "预览" }));

    expect(
      screen.getByRole("heading", { level: 2, name: "今日复盘" }),
    ).toBeInTheDocument();
  });

  it("renders workspace notes as a single editable document", () => {
    render(
      <DocumentNoteEditor
        value={SAMPLE_MARKDOWN}
        onChange={vi.fn()}
        onBlur={vi.fn()}
      />,
    );

    expect(screen.getByRole("textbox", { name: "记录内容" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "分栏预览" })).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "今日复盘" }),
    ).toBeInTheDocument();
  });

  it("writes document edits back as Markdown", () => {
    const handleChange = vi.fn();
    render(
      <DocumentNoteEditor
        value={SAMPLE_MARKDOWN}
        onChange={handleChange}
        onBlur={vi.fn()}
      />,
    );

    const editor = screen.getByRole("textbox", { name: "记录内容" });
    screen.getByRole("heading", { level: 2, name: "今日复盘" }).textContent =
      "今日复盘更新";
    fireEvent.input(editor);

    expect(handleChange).toHaveBeenLastCalledWith(
      expect.stringContaining("## 今日复盘更新"),
    );
  });

  it("turns a leading hyphen into a bullet block while editing", () => {
    const handleChange = vi.fn();
    render(
      <DocumentNoteEditor
        value=""
        onChange={handleChange}
        onBlur={vi.fn()}
      />,
    );

    const editor = screen.getByRole("textbox", { name: "记录内容" });
    const paragraph = editor.querySelector('[data-block="paragraph"]');
    expect(paragraph).toBeInstanceOf(HTMLElement);

    paragraph!.textContent = "-";
    fireEvent.keyDown(editor, { key: " " });

    const listBlock = editor.querySelector('[data-block="list"][data-list-type="bullet"]');
    expect(listBlock).toBeInTheDocument();
    expect(editor).toHaveAttribute("data-empty", "false");
    expect(handleChange).toHaveBeenLastCalledWith("- ");
  });

  it("renders Markdown in record list cards", () => {
    const session: Session = {
      id: 1,
      task_id: 2,
      task_name: "工作台 Markdown",
      phase: "work",
      started_at: "2026-06-25T09:00:00",
      ended_at: "2026-06-25T09:25:00",
      duration_sec: 1500,
      completed: 1,
      category_id: null,
      category_name: null,
      category_color: null,
      intention: null,
      mood: "focused",
      notes: SAMPLE_MARKDOWN,
    };

    render(<SessionCard session={session} />);

    expect(
      screen.getByRole("heading", { level: 2, name: "今日复盘" }),
    ).toBeInTheDocument();
  });

  it("renders Markdown in completed task review cards", () => {
    const task: Task = {
      id: 1,
      name: "升级 Markdown 工作台",
      project: "time-butler",
      estimated_pomos: 2,
      completed_pomos: 2,
      category_id: null,
      completed_at: "2026-06-25T10:00:00",
      completion_review: SAMPLE_MARKDOWN,
      created_at: "2026-06-25T08:00:00",
      archived: 0,
    };

    render(
      <TaskListCard
        task={task}
        isActive={false}
        onToggleActive={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onCompleteTask={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("heading", { level: 2, name: "今日复盘" }),
    ).toBeInTheDocument();
  });
});
