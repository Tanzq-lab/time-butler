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

  it("returns Git cleanup and product decisions to the Codex conversation", () => {
    const skill = readRepositoryFile("复盘/日报SKILL.md");
    const runner = readRepositoryFile("scripts/run-codex-daily-report.sh");
    const readme = readRepositoryFile("README.md");
    const mistakeNotebook = readRepositoryFile(
      "docs/codex-mistake-notebook.md",
    );

    expect(skill).toContain(
      "把所有可以安全解释、隔离和验证的现有修改提交掉",
    );
    expect(skill).toContain(
      "一个修改组失败或存在疑问时，继续处理其他独立修改组",
    );
    expect(skill).toContain("定时日报不得自行实施产品优化");
    expect(skill).toContain(
      "Codex 对话中的最终回复才是产品审计的交付面",
    );

    expect(runner).toContain("--no-write");
    expect(runner).toContain("--json >");
    expect(runner).not.toContain("PRODUCT_INSIGHT_MARKDOWN");
    expect(runner).toContain(
      "Git 收尾默认要把所有可以安全解释、隔离和验证的现有修改提交掉",
    );
    expect(runner).toContain(
      "不得把“请查看日志或文件”当成交付",
    );

    expect(readme).toContain("每日 09:30 日报只由 Codex 自动化调度");
    expect(mistakeNotebook).toContain(
      "日报分析和 Git 检查必须回到 Codex 对话形成闭环",
    );
  });
});
