import { TASK_CATEGORY_NAMES } from "@/lib/db/default-categories";

export type TaskPriority = "low" | "medium" | "high";
export type TaskConfidence = "high" | "medium" | "low";

export interface ParsedTaskDraft {
  name: string;
  estimatedPomos: number;
  project?: string;
  priority?: TaskPriority;
  categoryName?: string;
  notes?: string;
  confidence: TaskConfidence;
  warnings?: string[];
  needsBreakdown?: boolean;
  breakdownReason?: string;
  suggestedSubtasks?: ParsedTaskDraft[];
  estimationReason?: string;
}

const TASK_PREFIX_RE = /^(?:加任务|添加任务|新建任务|创建任务)\s*[:：]\s*/i;
const SENTENCE_END_RE = /[。.!！?？]+$/;

function cleanTaskName(input: string): string {
  return input.trim().replace(TASK_PREFIX_RE, "").trim().replace(SENTENCE_END_RE, "");
}

function includesAny(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}

function countMatches(text: string, keywords: string[]): number {
  return keywords.reduce((count, keyword) => count + (text.includes(keyword) ? 1 : 0), 0);
}

function baseDraft(
  name: string,
  estimatedPomos: number,
  confidence: TaskConfidence,
  estimationReason: string,
): ParsedTaskDraft {
  return {
    name,
    estimatedPomos,
    confidence,
    estimationReason,
    notes: estimationReason,
    needsBreakdown: false,
  };
}

function makeSubtask(
  name: string,
  estimatedPomos: number,
  categoryName: string,
  estimationReason: string,
): ParsedTaskDraft {
  return {
    name,
    estimatedPomos,
    categoryName,
    confidence: "medium",
    estimationReason,
    notes: estimationReason,
    needsBreakdown: false,
  };
}

function buildCodexSubtasks(name: string): ParsedTaskDraft[] {
  const hasCodexIntake = name.includes("Codex") && name.includes("自然语言");
  if (!hasCodexIntake) return [];

  return [
    makeSubtask(
      "梳理 Codex 自然语言加任务入口需求",
      1,
      TASK_CATEGORY_NAMES.planDesign,
      "先明确入口、字段和验收流程，避免直接进入大任务实现。",
    ),
    makeSubtask(
      "实现 Codex 自然语言任务解析和添加入口",
      2,
      TASK_CATEGORY_NAMES.codeChange,
      "涉及解析规则和添加任务数据流，按 2 个番茄预估。",
    ),
    makeSubtask(
      "增加超过 4 个番茄的任务分解提醒",
      1,
      TASK_CATEGORY_NAMES.codeChange,
      "提醒展示和分支动作相对独立，按 1 个番茄预估。",
    ),
    makeSubtask(
      "增加番茄预估备忘录和日志机制",
      2,
      TASK_CATEGORY_NAMES.materialOrganization,
      "需要新增可读经验库和追加式记录，按 2 个番茄预估。",
    ),
    makeSubtask(
      "测试任务录入、预估和偏差记录流程",
      1,
      TASK_CATEGORY_NAMES.review,
      "覆盖解析、拆分提醒和日志闭环，按 1 个番茄预估。",
    ),
  ];
}

function buildGenericSubtasks(name: string): ParsedTaskDraft[] {
  return [
    makeSubtask(
      `收集「${name}」相关资料`,
      1,
      TASK_CATEGORY_NAMES.dataCollection,
      "大型任务先收集输入和约束，按 1 个番茄预估。",
    ),
    makeSubtask(
      `整理「${name}」关键信息`,
      1,
      TASK_CATEGORY_NAMES.informationOrganization,
      "将资料归纳成可执行清单，按 1 个番茄预估。",
    ),
    makeSubtask(
      `设计「${name}」执行方案`,
      1,
      TASK_CATEGORY_NAMES.planDesign,
      "先拆出步骤、风险和验收点，按 1 个番茄预估。",
    ),
    makeSubtask(
      `完成「${name}」主要实现或写作`,
      2,
      TASK_CATEGORY_NAMES.implementationWriting,
      "主产出通常需要连续推进，按 2 个番茄预估。",
    ),
    makeSubtask(
      `检查并复盘「${name}」结果`,
      1,
      TASK_CATEGORY_NAMES.review,
      "收尾检查和记录偏差，按 1 个番茄预估。",
    ),
  ];
}

function withBreakdown(draft: ParsedTaskDraft): ParsedTaskDraft {
  if (draft.estimatedPomos <= 4 && !draft.needsBreakdown) return draft;

  const suggestedSubtasks =
    buildCodexSubtasks(draft.name).length > 0
      ? buildCodexSubtasks(draft.name)
      : buildGenericSubtasks(draft.name);

  return {
    ...draft,
    needsBreakdown: true,
    breakdownReason: "这个任务预计超过 4 个番茄，建议拆分后执行。",
    warnings: [
      ...(draft.warnings ?? []),
      "这个任务预计超过 4 个番茄，建议拆分。",
    ],
    suggestedSubtasks,
  };
}

export function parseTaskDraft(input: string): ParsedTaskDraft {
  const name = cleanTaskName(input);

  if (!name) {
    return baseDraft("", 1, "low", "任务名称为空，先按 1 个番茄占位。");
  }

  const text = name.toLowerCase();

  if (includesAny(text, ["anki"]) || includesAny(name, ["背诵", "复习"])) {
    const draft = baseDraft(
      name,
      1,
      "medium",
      "记忆复习或背诵类任务通常可以先按 1 个番茄起步，复杂背诵内容后续按完成偏差修正。",
    );
    draft.categoryName = TASK_CATEGORY_NAMES.memoryReview;
    if (includesAny(text, ["anki"])) draft.project = "ANKI";
    return withBreakdown(draft);
  }

  if (includesAny(name, ["日报", "周报", "月报", "复盘", "总结"])) {
    const draft = baseDraft(
      name,
      1,
      "medium",
      "复盘总结类任务通常先按 1 个番茄起步，若包含资料整理再拆分。",
    );
    draft.categoryName = TASK_CATEGORY_NAMES.review;
    return withBreakdown(draft);
  }

  const isInterviewQuestionRefinement = /^优化(?:问题|题目)\s*[:：]/.test(name);
  if (
    includesAny(name, ["面试题", "面经", "逐字稿", "回答"])
    || isInterviewQuestionRefinement
    || includesAny(text, ["prompt", "提示词"])
  ) {
    const draft = baseDraft(
      name,
      2,
      "medium",
      "面试回答和提示词优化通常需要先形成观点再组织表达，按 2 个番茄预估。",
    );
    draft.categoryName = TASK_CATEGORY_NAMES.writing;
    return withBreakdown(draft);
  }

  if (
    includesAny(name, ["快速回复", "回复"]) &&
    includesAny(name, ["邮件", "消息", "客服"])
  ) {
    const draft = baseDraft(
      name,
      1,
      "high",
      "快速回复消息或邮件属于明确、短输出任务，按 1 个番茄预估。",
    );
    draft.categoryName = TASK_CATEGORY_NAMES.communication;
    if (name.includes("OpenAI")) draft.project = "OpenAI";
    return withBreakdown(draft);
  }

  if (includesAny(name, ["旅行", "攻略"]) && includesAny(name, ["整理", "资料"])) {
    const draft = baseDraft(
      name,
      3,
      "medium",
      "旅行攻略整理比普通资料整理更复杂，通常需要筛选、归纳和结构化输出，按 3 个番茄预估。",
    );
    draft.project = "旅游";
    draft.categoryName = TASK_CATEGORY_NAMES.materialOrganization;
    return withBreakdown(draft);
  }

  if (includesAny(name, ["阅读", "读书", "看书"])) {
    const draft = baseDraft(
      name,
      1,
      "medium",
      "阅读研究类任务先按 1 个番茄起步；如果还要整理输出，再单独拆出资料整理。",
    );
    draft.categoryName = TASK_CATEGORY_NAMES.readingResearch;
    return withBreakdown(draft);
  }

  if (includesAny(name, ["资料", "整理", "阅读", "总结", "归纳"])) {
    const draft = baseDraft(
      name,
      2,
      "medium",
      "资料整理类任务通常需要筛选、归纳和输出结构化内容，按 2 个番茄预估。",
    );
    draft.categoryName = TASK_CATEGORY_NAMES.materialOrganization;
    return withBreakdown(draft);
  }

  const codeKeywordCount = countMatches(name, [
    "实现",
    "开发",
    "修改",
    "重构",
    "接入",
    "新增",
    "增加",
    "测试",
    "日志",
    "入口",
    "机制",
    "ui",
    "cli",
  ]);
  const listComplexity = (name.match(/[、，,]/g) ?? []).length;
  const isCompleteFeature =
    includesAny(name, ["完整实现", "完整功能", "一整套"]) ||
    (includesAny(name, ["完整"]) && codeKeywordCount >= 3);

  if (isCompleteFeature || codeKeywordCount + listComplexity >= 6) {
    const estimatedPomos = Math.min(8, Math.max(5, 4 + Math.ceil((codeKeywordCount + listComplexity) / 3)));
    const draft = baseDraft(
      name,
      estimatedPomos,
      "medium",
      "该任务包含多个实现点和验证环节，预计超过 4 个番茄，按大型任务处理。",
    );
    draft.categoryName = TASK_CATEGORY_NAMES.codeChange;
    return withBreakdown(draft);
  }

  if (includesAny(text, ["refactor"]) || includesAny(name, ["重构"])) {
    const draft = baseDraft(
      name,
      4,
      "medium",
      "重构需要理解旧逻辑、修改和检查，按 4 个番茄预估。",
    );
    draft.categoryName = TASK_CATEGORY_NAMES.codeChange;
    return withBreakdown(draft);
  }

  if (includesAny(name, ["实现", "开发", "修改", "接入", "新增", "增加"])) {
    const estimatedPomos = codeKeywordCount >= 3 || listComplexity >= 2 ? 4 : 2;
    const draft = baseDraft(
      name,
      estimatedPomos,
      "medium",
      estimatedPomos >= 4
        ? "任务涉及多个修改点，按 4 个番茄预估。"
        : "轻量代码修改或单点实现，按 2 个番茄预估。",
    );
    draft.categoryName = TASK_CATEGORY_NAMES.codeChange;
    return withBreakdown(draft);
  }

  return withBreakdown(
    baseDraft(
      name,
      1,
      "low",
      "任务描述较短且未命中复杂规则，先按 1 个番茄预估。",
    ),
  );
}
