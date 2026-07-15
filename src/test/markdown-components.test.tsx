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

const DAILY_REPORT_TABLE = `### 2. 时间投入分布

| 方向 / 分类 | 时长 | 专注段数 | 代表任务 |
|---|---:|---:|---|
| Time Butler 功能迭代 | 2h 30m | 6 | 新增日报功能、新增周月年计划、优化记录页面 |
| 面试逐字稿撰写 | 2h 30m | 6 | [面经逐字稿] 01 自我介绍 |`;

function placeSelection(element: HTMLElement, atStart = false) {
  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(atStart);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

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
        placeholder="写复盘…"
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
    placeSelection(paragraph as HTMLElement);
    fireEvent.keyDown(editor, { key: " " });

    const listBlock = editor.querySelector('[data-block="list"][data-list-type="bullet"]');
    expect(listBlock).toBeInTheDocument();
    expect(editor).toHaveAttribute("data-empty", "false");
    expect(handleChange).toHaveBeenLastCalledWith("- ");
  });

  it("keeps a newly inserted task block when the first text is entered", () => {
    const handleChange = vi.fn();
    render(
      <DocumentNoteEditor
        value=""
        onChange={handleChange}
        onBlur={vi.fn()}
      />,
    );

    const editor = screen.getByRole("textbox", { name: "记录内容" });
    const taskButton = screen.getByRole("button", { name: "待办" });
    fireEvent.mouseDown(taskButton);
    fireEvent.click(taskButton);

    const taskBlock = editor.querySelector('[data-block="task"]');
    const selection = window.getSelection();
    expect(taskBlock).toBeInstanceOf(HTMLElement);
    expect(selection?.anchorNode?.nodeType).toBe(Node.TEXT_NODE);
    expect(selection?.anchorNode?.parentElement).toBe(taskBlock);

    selection!.anchorNode!.textContent += "输出方法论总结";
    fireEvent.input(editor);

    expect(editor.querySelector('[data-block="task"]')).toBe(taskBlock);
    expect(handleChange).toHaveBeenLastCalledWith("- [ ] 输出方法论总结");
  });

  it("keeps the first text directly inside a newly inserted list block", () => {
    const handleChange = vi.fn();
    render(
      <DocumentNoteEditor
        value=""
        onChange={handleChange}
        onBlur={vi.fn()}
      />,
    );

    const editor = screen.getByRole("textbox", { name: "记录内容" });
    const listButton = screen.getByRole("button", { name: "无序列表" });
    fireEvent.mouseDown(listButton);
    fireEvent.click(listButton);

    const list = editor.querySelector('[data-block="list"]');
    const selection = window.getSelection();
    expect(list).toBeInstanceOf(HTMLElement);
    expect(selection?.anchorNode?.nodeType).toBe(Node.TEXT_NODE);
    expect(selection?.anchorNode?.parentElement).toBe(list);

    selection!.anchorNode!.textContent += "列表第一项";
    fireEvent.input(editor);
    expect(list?.querySelector("p")).not.toBeInTheDocument();
    expect(handleChange).toHaveBeenLastCalledWith("- 列表第一项");
  });

  it("appends a formatted block when the toolbar is used without an editor selection", () => {
    render(
      <DocumentNoteEditor
        value={'# 原标题\n\n原正文'}
        onChange={vi.fn()}
        onBlur={vi.fn()}
      />,
    );

    const editor = screen.getByRole("textbox", { name: "记录内容" });
    window.getSelection()?.removeAllRanges();
    const taskButton = screen.getByRole("button", { name: "待办" });
    fireEvent.mouseDown(taskButton);
    fireEvent.click(taskButton);

    expect(editor.querySelector('[data-block="heading"]')).toHaveTextContent("原标题");
    expect(editor.querySelector('[data-block="paragraph"]')).toHaveTextContent("原正文");
    expect(Array.from(editor.children).map((element) => element.getAttribute("data-block")))
      .toEqual(["heading", "paragraph", "task"]);
  });

  it("creates a new paragraph when Enter is pressed", () => {
    const handleChange = vi.fn();
    render(
      <DocumentNoteEditor
        value="第一段"
        onChange={handleChange}
        onBlur={vi.fn()}
      />,
    );

    const editor = screen.getByRole("textbox", { name: "记录内容" });
    const firstParagraph = editor.querySelector('[data-block="paragraph"]');
    expect(firstParagraph).toBeInstanceOf(HTMLElement);
    placeSelection(firstParagraph as HTMLElement);

    fireEvent.keyDown(editor, { key: "Enter" });

    const paragraphs = editor.querySelectorAll('[data-block="paragraph"]');
    expect(paragraphs).toHaveLength(2);
    paragraphs[1].textContent = "第二段";
    fireEvent.input(editor);
    expect(handleChange).toHaveBeenLastCalledWith("第一段\n\n第二段");
  });

  it("keeps Shift+Enter as a soft line break inside a paragraph", () => {
    const handleChange = vi.fn();
    render(
      <DocumentNoteEditor
        value="第一行"
        onChange={handleChange}
        onBlur={vi.fn()}
      />,
    );

    const editor = screen.getByRole("textbox", { name: "记录内容" });
    const paragraph = editor.querySelector('[data-block="paragraph"]');
    expect(paragraph).toBeInstanceOf(HTMLElement);
    placeSelection(paragraph as HTMLElement);
    fireEvent.keyDown(editor, { key: "Enter", shiftKey: true });

    expect(editor.querySelectorAll('[data-block="paragraph"]')).toHaveLength(1);
    expect(paragraph?.querySelector("br")).toBeInTheDocument();
    const selection = window.getSelection();
    selection!.anchorNode!.textContent += "第二行";
    fireEvent.input(editor);
    expect(handleChange).toHaveBeenLastCalledWith("第一行\n第二行");
  });

  it("does not split a block while an IME composition is being committed", () => {
    const handleChange = vi.fn();
    render(
      <DocumentNoteEditor
        value="中文输入"
        onChange={handleChange}
        onBlur={vi.fn()}
      />,
    );

    const editor = screen.getByRole("textbox", { name: "记录内容" });
    const paragraph = editor.querySelector('[data-block="paragraph"]');
    expect(paragraph).toBeInstanceOf(HTMLElement);
    placeSelection(paragraph as HTMLElement);
    fireEvent.keyDown(editor, { key: "Enter", isComposing: true });

    expect(editor.querySelectorAll('[data-block="paragraph"]')).toHaveLength(1);
    expect(handleChange).not.toHaveBeenCalled();
  });

  it("splits inline formatting at the caret when Enter is pressed", () => {
    render(
      <DocumentNoteEditor
        value="**前缀后缀**"
        onChange={vi.fn()}
        onBlur={vi.fn()}
      />,
    );

    const editor = screen.getByRole("textbox", { name: "记录内容" });
    const boldText = editor.querySelector("strong")?.firstChild;
    expect(boldText?.nodeType).toBe(Node.TEXT_NODE);
    const range = document.createRange();
    range.setStart(boldText as Text, 2);
    range.collapse(true);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    fireEvent.keyDown(editor, { key: "Enter" });

    const paragraphs = editor.querySelectorAll('[data-block="paragraph"]');
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0]).toHaveTextContent("前缀");
    expect(paragraphs[1]).toHaveTextContent("后缀");
    expect(paragraphs[0].querySelector("strong")).toBeInTheDocument();
    expect(paragraphs[1].querySelector("strong")).toBeInTheDocument();
  });

  it("continues task blocks when Enter is pressed", () => {
    const handleChange = vi.fn();
    render(
      <DocumentNoteEditor
        value="- [ ] 第一项"
        onChange={handleChange}
        onBlur={vi.fn()}
      />,
    );

    const editor = screen.getByRole("textbox", { name: "记录内容" });
    const firstTask = editor.querySelector('[data-block="task"]');
    expect(firstTask).toBeInstanceOf(HTMLElement);
    placeSelection(firstTask as HTMLElement);

    fireEvent.keyDown(editor, { key: "Enter" });

    const tasks = editor.querySelectorAll('[data-block="task"]');
    expect(tasks).toHaveLength(2);
    expect(tasks[1]).toHaveAttribute("data-checked", "false");
    tasks[1].textContent = "第二项";
    fireEvent.input(editor);
    expect(handleChange).toHaveBeenLastCalledWith("- [ ] 第一项\n- [ ] 第二项");
  });

  it("toggles a task only when its checkbox area is clicked", () => {
    const handleChange = vi.fn();
    render(
      <DocumentNoteEditor
        value="- [ ] 点击测试"
        onChange={handleChange}
        onBlur={vi.fn()}
      />,
    );

    const task = screen
      .getByRole("textbox", { name: "记录内容" })
      .querySelector('[data-block="task"]');
    expect(task).toBeInstanceOf(HTMLElement);

    fireEvent.click(task as HTMLElement, { clientX: 8 });
    expect(task).toHaveAttribute("data-checked", "true");
    expect(handleChange).toHaveBeenLastCalledWith("- [x] 点击测试");

    handleChange.mockClear();
    fireEvent.click(task as HTMLElement, { clientX: 80 });
    expect(task).toHaveAttribute("data-checked", "true");
    expect(handleChange).not.toHaveBeenCalled();
  });

  it("exits an empty task block with Enter or Backspace", () => {
    const { unmount } = render(
      <DocumentNoteEditor
        value="- [ ] "
        onChange={vi.fn()}
        onBlur={vi.fn()}
      />,
    );

    let editor = screen.getByRole("textbox", { name: "记录内容" });
    let task = editor.querySelector('[data-block="task"]');
    expect(task).toBeInstanceOf(HTMLElement);
    placeSelection(task as HTMLElement);
    fireEvent.keyDown(editor, { key: "Enter" });
    expect(editor.querySelector('[data-block="task"]')).not.toBeInTheDocument();
    expect(editor.querySelector('[data-block="paragraph"]')).toBeInTheDocument();

    unmount();
    render(
      <DocumentNoteEditor
        value="- [ ] "
        onChange={vi.fn()}
        onBlur={vi.fn()}
      />,
    );
    editor = screen.getByRole("textbox", { name: "记录内容" });
    task = editor.querySelector('[data-block="task"]');
    expect(task).toBeInstanceOf(HTMLElement);
    placeSelection(task as HTMLElement);
    fireEvent.keyDown(editor, { key: "Backspace" });
    expect(editor.querySelector('[data-block="task"]')).not.toBeInTheDocument();
    expect(editor.querySelector('[data-block="paragraph"]')).toBeInTheDocument();
  });

  it("starts body text after a heading when Enter is pressed", () => {
    render(
      <DocumentNoteEditor
        value="# 标题"
        onChange={vi.fn()}
        onBlur={vi.fn()}
      />,
    );

    const editor = screen.getByRole("textbox", { name: "记录内容" });
    const heading = editor.querySelector('[data-block="heading"]');
    expect(heading).toBeInstanceOf(HTMLElement);
    placeSelection(heading as HTMLElement);
    fireEvent.keyDown(editor, { key: "Enter" });

    expect(
      Array.from(editor.children).map((element) => (element as HTMLElement).dataset.block),
    ).toEqual(["heading", "paragraph"]);
  });

  it("inserts line breaks inside code blocks", () => {
    const handleChange = vi.fn();
    render(
      <DocumentNoteEditor
        value={'```\n第一行\n```'}
        onChange={handleChange}
        onBlur={vi.fn()}
      />,
    );

    const editor = screen.getByRole("textbox", { name: "记录内容" });
    const code = editor.querySelector('[data-block="code"] code');
    expect(code).toBeInstanceOf(HTMLElement);
    placeSelection(code as HTMLElement);
    fireEvent.keyDown(editor, { key: "Enter" });
    expect(code?.textContent).toBe("第一行\n");

    code?.append("第二行");
    fireEvent.input(editor);
    expect(handleChange).toHaveBeenLastCalledWith('```\n第一行\n第二行\n```');
  });

  it("keeps the first line inside a newly inserted code block", () => {
    const handleChange = vi.fn();
    render(
      <DocumentNoteEditor
        value=""
        onChange={handleChange}
        onBlur={vi.fn()}
      />,
    );

    const editor = screen.getByRole("textbox", { name: "记录内容" });
    const codeButton = screen.getByRole("button", { name: "代码块" });
    fireEvent.mouseDown(codeButton);
    fireEvent.click(codeButton);

    const code = editor.querySelector('[data-block="code"] code');
    const selection = window.getSelection();
    expect(code).toBeInstanceOf(HTMLElement);
    expect(selection?.anchorNode?.nodeType).toBe(Node.TEXT_NODE);
    expect(selection?.anchorNode?.parentElement).toBe(code);

    selection!.anchorNode!.textContent += "第一行";
    fireEvent.input(editor);
    expect(code?.querySelector("p")).not.toBeInTheDocument();
    expect(handleChange).toHaveBeenLastCalledWith('```\n第一行\n```');
  });

  it("renders and saves daily report Markdown tables in the document editor", () => {
    const handleChange = vi.fn();
    render(
      <DocumentNoteEditor
        value={DAILY_REPORT_TABLE}
        onChange={handleChange}
        onBlur={vi.fn()}
      />,
    );

    const editor = screen.getByRole("textbox", { name: "记录内容" });
    const table = editor.querySelector('[data-block="table"]');
    expect(table).toBeInstanceOf(HTMLTableElement);
    expect(screen.getByText("Time Butler 功能迭代")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "时长" })).toHaveAttribute(
      "data-align",
      "right",
    );

    screen.getAllByText("2h 30m")[0].textContent = "2h 35m";
    fireEvent.input(editor);

    expect(handleChange).toHaveBeenLastCalledWith(
      expect.stringContaining(
        "| Time Butler 功能迭代 | 2h 35m | 6 | 新增日报功能、新增周月年计划、优化记录页面 |",
      ),
    );
    expect(handleChange).toHaveBeenLastCalledWith(
      expect.stringContaining("| --- | ---: | ---: | --- |"),
    );
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
