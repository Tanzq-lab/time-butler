import {
  type ClipboardEvent,
  type KeyboardEvent,
  type MouseEvent,
  useEffect,
  useRef,
} from "react";
import {
  Bold,
  Code2,
  Heading1,
  Heading2,
  Italic,
  List,
  ListChecks,
  ListOrdered,
  Pilcrow,
  Quote,
} from "lucide-react";

export interface DocumentNoteEditorProps {
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
}

type SerializedBlock = {
  kind: "paragraph" | "heading" | "quote" | "list" | "task" | "code" | "divider" | "table";
  markdown: string;
};

type TableAlignment = "left" | "center" | "right" | null;

interface ParsedMarkdownTable {
  headers: string[];
  alignments: TableAlignment[];
  rows: string[][];
}

type BlockFormat =
  | { block: "paragraph" }
  | { block: "heading"; level: 1 | 2 }
  | { block: "quote" }
  | { block: "list"; listType: "bullet" | "ordered" }
  | { block: "task" }
  | { block: "code" };

const EMPTY_DOCUMENT_HTML = '<p data-block="paragraph"><br></p>';
const CARET_PLACEHOLDER = "\u200B";
const MAX_LIST_INDENT = 4;

const BLOCK_TOOLS: Array<{
  title: string;
  icon: typeof Pilcrow;
  format: BlockFormat;
}> = [
  { title: "段落", icon: Pilcrow, format: { block: "paragraph" } },
  { title: "一级标题", icon: Heading1, format: { block: "heading", level: 1 } },
  { title: "二级标题", icon: Heading2, format: { block: "heading", level: 2 } },
  { title: "无序列表", icon: List, format: { block: "list", listType: "bullet" } },
  { title: "有序列表", icon: ListOrdered, format: { block: "list", listType: "ordered" } },
  { title: "待办", icon: ListChecks, format: { block: "task" } },
  { title: "引用", icon: Quote, format: { block: "quote" } },
  { title: "代码块", icon: Code2, format: { block: "code" } },
];

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

function inlineMarkdownToHtml(source: string): string {
  const inlineTokens: string[] = [];
  const stashInlineHtml = (html: string) => {
    const index = inlineTokens.push(html) - 1;
    return `\u0000${index}\u0000`;
  };
  const stashCodeSpan = (_match: string, code: string) => {
    return stashInlineHtml(`<code>${escapeHtml(code)}</code>`);
  };
  const stashLink = (_match: string, label: string, href: string) => {
    return stashInlineHtml(
      `<a href="${escapeAttribute(href)}" target="_blank" rel="noreferrer">${escapeHtml(label)}</a>`,
    );
  };

  let html = escapeHtml(
    source
      .replace(/`([^`]+)`/g, stashCodeSpan)
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, stashLink),
  );
  html = html
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
    .replace(/(^|[^_])_([^_\n]+)_/g, "$1<em>$2</em>");
  html = html.replace(/\u0000(\d+)\u0000/g, (_match, index: string) => {
    return inlineTokens[Number(index)] ?? "";
  });
  html = html.replace(/\n/g, "<br>");

  return html.trim() ? html : "<br>";
}

function getIndentLevel(indent: string): number {
  const spaces = indent.replace(/\t/g, "  ").length;
  return Math.min(MAX_LIST_INDENT, Math.floor(spaces / 2));
}

function isDividerLine(line: string): boolean {
  return /^ {0,3}([-*_])(?:\s*\1){2,}\s*$/.test(line);
}

function splitTableRow(line: string): string[] {
  let value = line.trim();
  if (value.startsWith("|")) value = value.slice(1);
  if (value.endsWith("|")) value = value.slice(0, -1);

  const cells: string[] = [];
  let cell = "";
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    const next = value[index + 1];
    if (char === "\\" && next === "|") {
      cell += "|";
      index += 1;
      continue;
    }
    if (char === "|") {
      cells.push(cell.trim());
      cell = "";
      continue;
    }
    cell += char;
  }
  cells.push(cell.trim());

  return cells;
}

function parseTableAlignments(line: string): TableAlignment[] | null {
  const cells = splitTableRow(line);
  if (cells.length === 0) return null;

  const alignments: TableAlignment[] = [];
  for (const cell of cells) {
    const marker = cell.replace(/\s/g, "");
    if (!/^:?-{3,}:?$/.test(marker)) return null;

    const left = marker.startsWith(":");
    const right = marker.endsWith(":");
    alignments.push(left && right ? "center" : right ? "right" : left ? "left" : null);
  }

  return alignments;
}

function normalizeTableCells(cells: string[], count: number): string[] {
  const normalized = cells.slice(0, count);
  while (normalized.length < count) {
    normalized.push("");
  }
  return normalized;
}

function parseMarkdownTable(lines: string[], startIndex: number): {
  table: ParsedMarkdownTable;
  nextIndex: number;
} | null {
  const headerLine = lines[startIndex];
  const separatorLine = lines[startIndex + 1];
  if (!headerLine || !separatorLine || !headerLine.includes("|")) return null;

  const headers = splitTableRow(headerLine);
  const alignments = parseTableAlignments(separatorLine);
  if (!alignments || headers.length === 0 || headers.length !== alignments.length) {
    return null;
  }

  const rows: string[][] = [];
  let index = startIndex + 2;
  while (index < lines.length && lines[index].trim() && lines[index].includes("|")) {
    rows.push(normalizeTableCells(splitTableRow(lines[index]), headers.length));
    index += 1;
  }

  return {
    table: {
      headers,
      alignments,
      rows,
    },
    nextIndex: index,
  };
}

function isSpecialMarkdownLine(line: string): boolean {
  return (
    /^```/.test(line) ||
    /^(#{1,3})\s+/.test(line) ||
    isDividerLine(line) ||
    /^(\s*)[-*+]\s+\[[ xX]\]\s*/.test(line) ||
    /^(\s*)[-*+]\s+/.test(line) ||
    /^(\s*)\d+[.)]\s+/.test(line) ||
    /^>\s?/.test(line)
  );
}

function renderHeading(level: 1 | 2 | 3, text: string): string {
  const html = text ? inlineMarkdownToHtml(text) : CARET_PLACEHOLDER;
  return `<h${level} data-block="heading" data-level="${level}">${html}</h${level}>`;
}

function renderParagraph(text: string): string {
  return `<p data-block="paragraph">${inlineMarkdownToHtml(text)}</p>`;
}

function renderQuote(text: string): string {
  const html = text ? inlineMarkdownToHtml(text) : CARET_PLACEHOLDER;
  return `<blockquote data-block="quote">${html}</blockquote>`;
}

function renderListItem(
  listType: "bullet" | "ordered",
  indent: number,
  text: string,
): string {
  const html = text ? inlineMarkdownToHtml(text) : CARET_PLACEHOLDER;
  return `<div data-block="list" data-list-type="${listType}" data-indent="${indent}">${html}</div>`;
}

function renderTaskItem(checked: boolean, indent: number, text: string): string {
  const html = text ? inlineMarkdownToHtml(text) : CARET_PLACEHOLDER;
  return `<div data-block="task" data-checked="${checked ? "true" : "false"}" data-indent="${indent}">${html}</div>`;
}

function renderCodeBlock(text: string): string {
  return `<pre data-block="code"><code>${escapeHtml(text) || CARET_PLACEHOLDER}</code></pre>`;
}

function renderTableCell(
  tagName: "th" | "td",
  content: string,
  alignment: TableAlignment,
): string {
  const alignAttribute = alignment ? ` data-align="${alignment}"` : "";
  return `<${tagName}${alignAttribute}>${inlineMarkdownToHtml(content)}</${tagName}>`;
}

function renderTable({ headers, alignments, rows }: ParsedMarkdownTable): string {
  const headerHtml = headers
    .map((header, index) => renderTableCell("th", header, alignments[index] ?? null))
    .join("");
  const bodyHtml = rows
    .map((row) => {
      const cells = normalizeTableCells(row, headers.length)
        .map((cell, index) => renderTableCell("td", cell, alignments[index] ?? null))
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");

  return `<table data-block="table"><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table>`;
}

function markdownToDocumentHtml(markdown: string): string {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const blocks: string[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) {
      index += 1;
      continue;
    }

    const fenceMatch = line.match(/^```/);
    if (fenceMatch) {
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !/^```\s*$/.test(lines[index])) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push(renderCodeBlock(codeLines.join("\n")));
      continue;
    }

    const headingMatch = line.match(/^(#{1,3})\s*(.*)$/);
    if (headingMatch) {
      blocks.push(renderHeading(headingMatch[1].length as 1 | 2 | 3, headingMatch[2]));
      index += 1;
      continue;
    }

    if (isDividerLine(line)) {
      blocks.push('<hr data-block="divider">');
      index += 1;
      continue;
    }

    const tableMatch = parseMarkdownTable(lines, index);
    if (tableMatch) {
      blocks.push(renderTable(tableMatch.table));
      index = tableMatch.nextIndex;
      continue;
    }

    const taskMatch = line.match(/^(\s*)[-*+]\s+\[([ xX])\]\s*(.*)$/);
    if (taskMatch) {
      blocks.push(
        renderTaskItem(
          taskMatch[2].toLowerCase() === "x",
          getIndentLevel(taskMatch[1]),
          taskMatch[3],
        ),
      );
      index += 1;
      continue;
    }

    const bulletMatch = line.match(/^(\s*)[-*+]\s+(.*)$/);
    if (bulletMatch) {
      blocks.push(renderListItem("bullet", getIndentLevel(bulletMatch[1]), bulletMatch[2]));
      index += 1;
      continue;
    }

    const orderedMatch = line.match(/^(\s*)\d+[.)]\s+(.*)$/);
    if (orderedMatch) {
      blocks.push(renderListItem("ordered", getIndentLevel(orderedMatch[1]), orderedMatch[2]));
      index += 1;
      continue;
    }

    const quoteMatch = line.match(/^>\s?(.*)$/);
    if (quoteMatch) {
      const quoteLines = [quoteMatch[1]];
      index += 1;
      while (index < lines.length) {
        const nextQuote = lines[index].match(/^>\s?(.*)$/);
        if (!nextQuote) break;
        quoteLines.push(nextQuote[1]);
        index += 1;
      }
      blocks.push(renderQuote(quoteLines.join("\n")));
      continue;
    }

    const paragraphLines = [line];
    index += 1;
    while (
      index < lines.length &&
      lines[index].trim() &&
      !parseMarkdownTable(lines, index) &&
      !isSpecialMarkdownLine(lines[index])
    ) {
      paragraphLines.push(lines[index]);
      index += 1;
    }
    blocks.push(renderParagraph(paragraphLines.join("\n")));
  }

  return blocks.join("") || EMPTY_DOCUMENT_HTML;
}

function serializeInline(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent
      ?.replace(/\u00a0/g, " ")
      .replaceAll(CARET_PLACEHOLDER, "") ?? "";
  }

  if (!(node instanceof HTMLElement)) {
    return "";
  }

  const tagName = node.tagName.toLowerCase();
  if (tagName === "br") return "\n";
  if (tagName === "hr") return "";
  if (tagName === "input" || node.getAttribute("contenteditable") === "false") {
    return "";
  }

  const children = Array.from(node.childNodes).map(serializeInline).join("");
  if (!children.trim()) return children;

  switch (tagName) {
    case "strong":
    case "b":
      return `**${children}**`;
    case "em":
    case "i":
      return `_${children}_`;
    case "code":
      if (node.parentElement?.tagName.toLowerCase() === "pre") return children;
      return `\`${children}\``;
    case "a": {
      const href = node.getAttribute("href");
      return href ? `[${children}](${href})` : children;
    }
    default:
      return children;
  }
}

function cleanInline(value: string): string {
  return value
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function serializeTableCell(cell: Element): string {
  return cleanInline(serializeInline(cell))
    .replace(/\n+/g, " ")
    .replace(/\|/g, "\\|");
}

function serializeTableRow(cells: string[]): string {
  return `| ${cells.join(" | ")} |`;
}

function serializeTableAlignment(alignment: string | undefined): string {
  switch (alignment) {
    case "left":
      return ":---";
    case "center":
      return ":---:";
    case "right":
      return "---:";
    default:
      return "---";
  }
}

function serializeTableElement(table: HTMLElement): SerializedBlock[] {
  const headerCells = Array.from(
    table.querySelectorAll(":scope > thead > tr:first-child > th"),
  );
  const fallbackHeaderCells = Array.from(
    table.querySelectorAll(":scope > tr:first-child > th, :scope > tr:first-child > td"),
  );
  const headers = (headerCells.length > 0 ? headerCells : fallbackHeaderCells)
    .map(serializeTableCell);

  if (headers.length === 0) return [];

  const alignments = (headerCells.length > 0 ? headerCells : fallbackHeaderCells)
    .map((cell) => serializeTableAlignment((cell as HTMLElement).dataset.align));
  const bodyRows = Array.from(
    table.querySelectorAll(":scope > tbody > tr, :scope > tr"),
  ).filter((row) => row.querySelectorAll("td").length > 0);
  const rows = bodyRows
    .map((row) => Array.from(row.querySelectorAll("th, td")).map(serializeTableCell))
    .map((cells) => normalizeTableCells(cells, headers.length));

  return [{
    kind: "table",
    markdown: [
      serializeTableRow(headers),
      serializeTableRow(alignments),
      ...rows.map(serializeTableRow),
    ].join("\n"),
  }];
}

function serializeElementBlock(element: HTMLElement): SerializedBlock[] {
  const tagName = element.tagName.toLowerCase();
  const block = element.dataset.block;

  if (tagName === "ul" || tagName === "ol") {
    return Array.from(element.children).flatMap((child) => {
      if (!(child instanceof HTMLElement)) return [];
      const text = cleanInline(serializeInline(child));
      if (!text) return [];
      return [{
        kind: "list",
        markdown: `${tagName === "ol" ? "1." : "-"} ${text}`,
      }];
    });
  }

  if (tagName === "hr" || block === "divider") {
    return [{ kind: "divider", markdown: "---" }];
  }

  if (tagName === "table" || block === "table") {
    return serializeTableElement(element);
  }

  if (tagName === "pre" || block === "code") {
    const code = element.textContent
      ?.replaceAll(CARET_PLACEHOLDER, "")
      .replace(/\n+$/g, "") ?? "";
    return [{ kind: "code", markdown: `\`\`\`\n${code}\n\`\`\`` }];
  }

  if (tagName === "h1" || tagName === "h2" || tagName === "h3" || block === "heading") {
    const level = Number(element.dataset.level ?? tagName.slice(1)) || 2;
    const text = cleanInline(serializeInline(element));
    if (!text) return [];
    return [{
      kind: "heading",
      markdown: `${"#".repeat(Math.min(Math.max(level, 1), 3))} ${text}`,
    }];
  }

  if (tagName === "blockquote" || block === "quote") {
    const text = cleanInline(serializeInline(element));
    if (!text) return [];
    return [{
      kind: "quote",
      markdown: text.split("\n").map((line) => `> ${line}`).join("\n"),
    }];
  }

  if (block === "list") {
    const text = cleanInline(serializeInline(element));
    const indent = "  ".repeat(
      Math.min(MAX_LIST_INDENT, Number(element.dataset.indent ?? 0) || 0),
    );
    const marker = element.dataset.listType === "ordered" ? "1. " : "- ";
    return [{ kind: "list", markdown: `${indent}${marker}${text}` }];
  }

  if (block === "task") {
    const text = cleanInline(serializeInline(element));
    const indent = "  ".repeat(
      Math.min(MAX_LIST_INDENT, Number(element.dataset.indent ?? 0) || 0),
    );
    const marker = element.dataset.checked === "true" ? "- [x] " : "- [ ] ";
    return [{ kind: "task", markdown: `${indent}${marker}${text}` }];
  }

  const text = cleanInline(serializeInline(element));
  return text ? [{ kind: "paragraph", markdown: text }] : [];
}

function serializeBlockNode(node: Node): SerializedBlock[] {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent?.trim();
    return text ? [{ kind: "paragraph", markdown: text }] : [];
  }

  if (node instanceof HTMLElement) {
    return serializeElementBlock(node);
  }

  return [];
}

function shouldJoinTightly(previous: SerializedBlock, current: SerializedBlock): boolean {
  return (
    (previous.kind === "list" || previous.kind === "task") &&
    (current.kind === "list" || current.kind === "task")
  );
}

function trimTrailingNewlines(value: string): string {
  return value.replace(/\n+$/g, "");
}

function serializeDocument(root: HTMLElement): string {
  const blocks = Array.from(root.childNodes).flatMap(serializeBlockNode);
  if (blocks.length === 0) return "";

  return trimTrailingNewlines(
    blocks.reduce((markdown, block, index) => {
      if (index === 0) return block.markdown;
      const previous = blocks[index - 1];
      return `${markdown}${shouldJoinTightly(previous, block) ? "\n" : "\n\n"}${block.markdown}`;
    }, ""),
  );
}

function updateEmptyState(root: HTMLElement): void {
  const hasText = Boolean(
    root.textContent?.replaceAll(CARET_PLACEHOLDER, "").trim(),
  );
  const hasFormattedBlock = Boolean(
    root.querySelector(
      [
        '[data-block="heading"]',
        '[data-block="quote"]',
        '[data-block="list"]',
        '[data-block="task"]',
        '[data-block="code"]',
        '[data-block="divider"]',
        '[data-block="table"]',
        "hr",
      ].join(","),
    ),
  );
  root.dataset.empty = hasText || hasFormattedBlock ? "false" : "true";
}

function getActiveTopLevelBlock(root: HTMLElement): HTMLElement | null {
  const selection = window.getSelection();
  let node = selection?.anchorNode ?? null;

  if (!node || !root.contains(node)) {
    return null;
  }

  let element = node instanceof HTMLElement ? node : node.parentElement;
  while (element && element.parentElement !== root) {
    element = element.parentElement;
  }

  return element && element !== root ? element : null;
}

function getTopLevelBlockFromTarget(
  target: EventTarget | null,
  root: HTMLElement,
): HTMLElement | null {
  if (!(target instanceof Node) || !root.contains(target)) return null;

  let element = target instanceof HTMLElement ? target : target.parentElement;
  while (element && element.parentElement !== root) {
    element = element.parentElement;
  }

  return element && element !== root ? element : null;
}

function getBlockHtml(block: HTMLElement): string {
  if (block.tagName.toLowerCase() === "pre" || block.dataset.block === "code") {
    return escapeHtml(block.textContent ?? "");
  }
  return block.innerHTML || "<br>";
}

function createFormattedBlock(
  format: BlockFormat,
  html: string,
  text: string,
): HTMLElement {
  if (format.block === "heading") {
    const heading = document.createElement(format.level === 1 ? "h1" : "h2");
    heading.dataset.block = "heading";
    heading.dataset.level = String(format.level);
    heading.innerHTML = text.replaceAll(CARET_PLACEHOLDER, "").trim()
      ? html || "<br>"
      : CARET_PLACEHOLDER;
    return heading;
  }

  if (format.block === "quote") {
    const quote = document.createElement("blockquote");
    quote.dataset.block = "quote";
    quote.innerHTML = text.replaceAll(CARET_PLACEHOLDER, "").trim()
      ? html || "<br>"
      : CARET_PLACEHOLDER;
    return quote;
  }

  if (format.block === "list") {
    const list = document.createElement("div");
    list.dataset.block = "list";
    list.dataset.listType = format.listType;
    list.dataset.indent = "0";
    list.innerHTML = text.replaceAll(CARET_PLACEHOLDER, "").trim()
      ? html || "<br>"
      : CARET_PLACEHOLDER;
    return list;
  }

  if (format.block === "task") {
    const task = document.createElement("div");
    task.dataset.block = "task";
    task.dataset.checked = "false";
    task.dataset.indent = "0";
    if (text.replaceAll(CARET_PLACEHOLDER, "").trim()) {
      task.innerHTML = html || "<br>";
    } else {
      task.textContent = CARET_PLACEHOLDER;
    }
    return task;
  }

  if (format.block === "code") {
    const pre = document.createElement("pre");
    pre.dataset.block = "code";
    const code = document.createElement("code");
    code.textContent = text || CARET_PLACEHOLDER;
    pre.append(code);
    return pre;
  }

  const paragraph = document.createElement("p");
  paragraph.dataset.block = "paragraph";
  paragraph.innerHTML = html || "<br>";
  return paragraph;
}

function placeCaretAtEnd(element: HTMLElement): void {
  const target = element.tagName.toLowerCase() === "pre"
    ? element.querySelector("code") ?? element
    : element;
  const range = document.createRange();

  if (
    element.dataset.block !== "paragraph" &&
    !target.textContent?.replaceAll(CARET_PLACEHOLDER, "").trim()
  ) {
    const placeholder = document.createTextNode(CARET_PLACEHOLDER);
    target.replaceChildren(placeholder);
    range.setStart(placeholder, CARET_PLACEHOLDER.length);
    range.collapse(true);
  } else {
    range.selectNodeContents(target);
    range.collapse(false);
  }
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function placeCaretAtStart(element: HTMLElement): void {
  const target = element.tagName.toLowerCase() === "pre"
    ? element.querySelector("code") ?? element
    : element;
  const range = document.createRange();

  if (!target.textContent?.replaceAll(CARET_PLACEHOLDER, "").trim()) {
    if (element.dataset.block !== "paragraph") {
      const placeholder = document.createTextNode(CARET_PLACEHOLDER);
      target.replaceChildren(placeholder);
      range.setStart(placeholder, CARET_PLACEHOLDER.length);
    } else {
      target.innerHTML = "<br>";
      range.setStart(target, 0);
    }
  } else {
    range.selectNodeContents(target);
    range.collapse(true);
  }

  range.collapse(true);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function isBlockEmpty(block: HTMLElement): boolean {
  return !block.textContent?.replaceAll(CARET_PLACEHOLDER, "").trim();
}

function ensureEditableBlockContent(block: HTMLElement): void {
  if (!isBlockEmpty(block)) return;

  if (
    block.dataset.block &&
    block.dataset.block !== "paragraph" &&
    block.dataset.block !== "code"
  ) {
    block.textContent = CARET_PLACEHOLDER;
    return;
  }

  if (block.dataset.block === "code") {
    const code = block.querySelector("code") ?? block;
    code.textContent = CARET_PLACEHOLDER;
    return;
  }

  block.innerHTML = "<br>";
}

function getCollapsedSelectionRange(block: HTMLElement): Range | null {
  const selection = window.getSelection();
  if (!selection || !selection.isCollapsed || selection.rangeCount === 0) return null;

  const range = selection.getRangeAt(0);
  return block.contains(range.startContainer) ? range : null;
}

function isCaretAtBlockStart(block: HTMLElement, range: Range): boolean {
  const prefix = document.createRange();
  prefix.selectNodeContents(block);
  prefix.setEnd(range.startContainer, range.startOffset);
  return !prefix.toString().replaceAll(CARET_PLACEHOLDER, "");
}

function getContinuationFormat(block: HTMLElement): BlockFormat {
  switch (block.dataset.block) {
    case "list":
      return {
        block: "list",
        listType: block.dataset.listType === "ordered" ? "ordered" : "bullet",
      };
    case "task":
      return { block: "task" };
    case "quote":
      return { block: "quote" };
    default:
      return { block: "paragraph" };
  }
}

function fragmentHasContent(fragment: DocumentFragment): boolean {
  if (fragment.textContent?.replaceAll(CARET_PLACEHOLDER, "").trim()) return true;
  return Boolean(fragment.querySelector("br, hr, table"));
}

function splitBlockAtSelection(block: HTMLElement, range: Range): HTMLElement {
  const tailRange = document.createRange();
  tailRange.setStart(range.startContainer, range.startOffset);
  tailRange.setEnd(block, block.childNodes.length);
  const tail = tailRange.extractContents();
  const nextBlock = createFormattedBlock(getContinuationFormat(block), "<br>", "");

  if (fragmentHasContent(tail)) {
    nextBlock.replaceChildren(tail);
  }

  ensureEditableBlockContent(block);
  ensureEditableBlockContent(nextBlock);
  block.after(nextBlock);
  placeCaretAtStart(nextBlock);
  return nextBlock;
}

function replaceBlockWithParagraph(block: HTMLElement): HTMLElement {
  const html = getBlockHtml(block).replaceAll(CARET_PLACEHOLDER, "");
  const paragraph = createFormattedBlock(
    { block: "paragraph" },
    html,
    block.textContent?.replaceAll(CARET_PLACEHOLDER, "") ?? "",
  );
  block.replaceWith(paragraph);
  ensureEditableBlockContent(paragraph);
  placeCaretAtStart(paragraph);
  return paragraph;
}

function insertCodeLineBreak(range: Range): void {
  range.deleteContents();
  const lineBreak = document.createTextNode("\n");
  range.insertNode(lineBreak);
  range.setStartAfter(lineBreak);
  range.collapse(true);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function insertSoftLineBreak(range: Range): void {
  range.deleteContents();
  const lineBreak = document.createElement("br");
  const caretMarker = document.createTextNode(CARET_PLACEHOLDER);
  const fragment = document.createDocumentFragment();
  fragment.append(lineBreak, caretMarker);
  range.insertNode(fragment);
  range.setStart(caretMarker, CARET_PLACEHOLDER.length);
  range.collapse(true);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function mergeParagraphIntoPrevious(
  paragraph: HTMLElement,
  previous: HTMLElement,
): boolean {
  if (
    previous.dataset.block === "code" ||
    previous.dataset.block === "divider" ||
    previous.dataset.block === "table"
  ) {
    return false;
  }

  if (isBlockEmpty(previous)) previous.replaceChildren();
  const caretMarker = document.createTextNode(CARET_PLACEHOLDER);
  previous.append(caretMarker, ...Array.from(paragraph.childNodes));
  paragraph.remove();

  const range = document.createRange();
  range.setStart(caretMarker, CARET_PLACEHOLDER.length);
  range.collapse(true);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  return true;
}

function getMarkdownShortcutFormat(block: HTMLElement): BlockFormat | null {
  if (block.dataset.block && block.dataset.block !== "paragraph") return null;

  const marker = (block.textContent ?? "").replace(/\u00a0/g, " ").trim();
  switch (marker) {
    case "-":
    case "*":
      return { block: "list", listType: "bullet" };
    case "1.":
    case "1)":
      return { block: "list", listType: "ordered" };
    case "[]":
    case "[ ]":
      return { block: "task" };
    case "#":
      return { block: "heading", level: 1 };
    case "##":
      return { block: "heading", level: 2 };
    case ">":
      return { block: "quote" };
    case "```":
      return { block: "code" };
    default:
      return null;
  }
}

export default function DocumentNoteEditor({
  value,
  onChange,
  onBlur,
}: DocumentNoteEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const isFocusedRef = useRef(false);
  const lastEmittedValueRef = useRef(value);
  const lastRenderedValueRef = useRef<string | null>(null);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const valueCameFromEditor = value === lastEmittedValueRef.current;
    if (isFocusedRef.current && valueCameFromEditor) return;
    if (lastRenderedValueRef.current === value) return;

    editor.innerHTML = markdownToDocumentHtml(value);
    updateEmptyState(editor);
    lastRenderedValueRef.current = value;
    lastEmittedValueRef.current = value;
  }, [value]);

  const emitChange = () => {
    const editor = editorRef.current;
    if (!editor) return;

    const nextValue = serializeDocument(editor);
    updateEmptyState(editor);
    lastEmittedValueRef.current = nextValue;
    lastRenderedValueRef.current = nextValue;
    onChange(nextValue);
  };

  const runInlineCommand = (command: "bold" | "italic") => {
    editorRef.current?.focus();
    document.execCommand(command);
    emitChange();
  };

  const applyBlockFormat = (format: BlockFormat) => {
    const editor = editorRef.current;
    if (!editor) return;

    const currentBlock = getActiveTopLevelBlock(editor);
    editor.focus();
    const block = currentBlock ?? createFormattedBlock({ block: "paragraph" }, "<br>", "");
    if (!currentBlock) editor.append(block);

    const html = getBlockHtml(block);
    const text = block.textContent ?? "";
    const nextBlock = createFormattedBlock(format, html, text);
    block.replaceWith(nextBlock);
    placeCaretAtEnd(nextBlock);
    emitChange();
  };

  const handleToolbarMouseDown = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
  };

  const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
    const text = event.clipboardData.getData("text/plain");
    if (!text) return;

    event.preventDefault();
    document.execCommand("insertHTML", false, markdownToDocumentHtml(text));
    emitChange();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const editor = editorRef.current;
    if (!editor) return;

    if (event.nativeEvent.isComposing) return;

    if (
      (event.key === " " || event.key === "Spacebar") &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.shiftKey
    ) {
      const block = getActiveTopLevelBlock(editor);
      if (!block) return;

      const shortcutFormat = getMarkdownShortcutFormat(block);
      if (!shortcutFormat) return;

      event.preventDefault();
      const nextBlock = createFormattedBlock(shortcutFormat, "<br>", "");
      block.replaceWith(nextBlock);
      placeCaretAtEnd(nextBlock);
      emitChange();
      return;
    }

    if (event.key === "Enter") {
      const block = getActiveTopLevelBlock(editor);
      if (!block) return;

      const range = getCollapsedSelectionRange(block);
      if (!range) return;

      event.preventDefault();
      if (block.dataset.block === "code") {
        insertCodeLineBreak(range);
      } else if (
        event.shiftKey &&
        (block.dataset.block === "paragraph" || block.dataset.block === "quote")
      ) {
        insertSoftLineBreak(range);
      } else if (isBlockEmpty(block) && block.dataset.block !== "paragraph") {
        replaceBlockWithParagraph(block);
      } else {
        splitBlockAtSelection(block, range);
      }
      emitChange();
      return;
    }

    if (event.key === "Backspace") {
      const block = getActiveTopLevelBlock(editor);
      if (!block) return;

      const range = getCollapsedSelectionRange(block);
      if (!range || !isCaretAtBlockStart(block, range)) return;

      if (block.dataset.block && block.dataset.block !== "paragraph") {
        event.preventDefault();
        replaceBlockWithParagraph(block);
        emitChange();
        return;
      }

      const previous = block.previousElementSibling;
      if (!(previous instanceof HTMLElement)) return;

      if (isBlockEmpty(block)) {
        event.preventDefault();
        block.remove();
        placeCaretAtEnd(previous);
        emitChange();
        return;
      }

      if (mergeParagraphIntoPrevious(block, previous)) {
        event.preventDefault();
        emitChange();
      }
      return;
    }

    if (event.key !== "Tab") return;

    const block = getActiveTopLevelBlock(editor);
    if (!block || (block.dataset.block !== "list" && block.dataset.block !== "task")) {
      return;
    }

    event.preventDefault();
    const currentIndent = Number(block.dataset.indent ?? 0) || 0;
    const nextIndent = event.shiftKey
      ? Math.max(0, currentIndent - 1)
      : Math.min(MAX_LIST_INDENT, currentIndent + 1);
    block.dataset.indent = String(nextIndent);
    emitChange();
  };

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    const editor = editorRef.current;
    if (!editor) return;

    const block = getTopLevelBlockFromTarget(event.target, editor) ?? getActiveTopLevelBlock(editor);
    if (!block || block.dataset.block !== "task") return;

    const rect = block.getBoundingClientRect();
    if (event.clientX > rect.left + 30) return;

    block.dataset.checked = block.dataset.checked === "true" ? "false" : "true";
    emitChange();
  };

  return (
    <div className="document-note-editor">
      <div className="document-note-editor__toolbar" aria-label="文档格式工具">
        <div className="document-note-editor__tool-group">
          <button
            type="button"
            title="粗体"
            aria-label="粗体"
            onMouseDown={handleToolbarMouseDown}
            onClick={() => runInlineCommand("bold")}
            className="document-note-editor__tool-button"
          >
            <Bold className="size-4" />
          </button>
          <button
            type="button"
            title="斜体"
            aria-label="斜体"
            onMouseDown={handleToolbarMouseDown}
            onClick={() => runInlineCommand("italic")}
            className="document-note-editor__tool-button"
          >
            <Italic className="size-4" />
          </button>
        </div>
        <div className="document-note-editor__tool-group">
          {BLOCK_TOOLS.map(({ title, icon: Icon, format }) => (
            <button
              key={title}
              type="button"
              title={title}
              aria-label={title}
              onMouseDown={handleToolbarMouseDown}
              onClick={() => applyBlockFormat(format)}
              className="document-note-editor__tool-button"
            >
              <Icon className="size-4" />
            </button>
          ))}
        </div>
      </div>

      <div className="document-note-editor__scroll">
        <div
          ref={editorRef}
          role="textbox"
          aria-label="记录内容"
          aria-multiline="true"
          className="document-note-editor__page"
          contentEditable
          suppressContentEditableWarning
          spellCheck
          data-placeholder="开始记录…"
          onFocus={() => {
            isFocusedRef.current = true;
          }}
          onInput={emitChange}
          onBlur={() => {
            isFocusedRef.current = false;
            onBlur();
          }}
          onPaste={handlePaste}
          onKeyDown={handleKeyDown}
          onClick={handleClick}
        />
      </div>
    </div>
  );
}
