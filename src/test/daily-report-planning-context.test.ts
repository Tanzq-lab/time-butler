/// <reference types="node" />

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

const readRepositoryFile = (relativePath: string) =>
  readFileSync(path.join(repoRoot, relativePath), "utf8");

describe("daily report planning context", () => {
  it("keeps target-day facts separate from the generation-time plan snapshot", () => {
    const skill = readRepositoryFile("复盘/日报SKILL.md");
    const runner = readRepositoryFile("scripts/run-codex-daily-report.sh");
    const mistakeNotebook = readRepositoryFile(
      "docs/codex-mistake-notebook.md",
    );

    expect(skill).toContain("### 2.1 报告生成时的计划快照");
    expect(skill).toContain("FROM calendar_events");
    expect(skill).toContain("FROM week_plan_items");
    expect(skill).toContain(
      "这份快照只约束“下一步行动”，不得改变目标日事实",
    );
    expect(skill).toContain(
      "已有等价任务或承诺时，不再制造新的独立行动",
    );
    expect(skill).toContain("历史补跑只能用当前快照避免重复或冲突");

    expect(runner).toContain(
      'REPORT_GENERATED_AT="$(date \'+%Y-%m-%d %H:%M:%S %Z\')"',
    );
    expect(runner).toContain('REPORT_DATE="$(date \'+%Y-%m-%d\')"');
    expect(runner).toContain('REPORT_WEEK="$(date \'+%G-W%V\')"');
    expect(runner).toContain("必须按 skill 读取 REPORT_GENERATED_AT=");
    expect(runner).toContain("历史事实仍严格限定 TARGET_DATE=");
    expect(runner).toContain("已有等价事项时不得再制造平行行动");

    expect(mistakeNotebook).toContain(
      "日报下一步行动不能忽略生成时已有安排",
    );
    expect(mistakeNotebook).toContain("历史事实窗口");
    expect(mistakeNotebook).toContain("生成时计划快照");
  });
});
