export const TASK_CATEGORY_NAMES = {
  codeChange: "代码修改",
  bugFix: "问题修复",
  testVerification: "测试验证",
  configuration: "配置部署",
  dataCollection: "资料收集",
  materialOrganization: "资料整理",
  informationOrganization: "信息整理",
  planDesign: "方案设计",
  implementationWriting: "实现写作",
  writing: "写作输出",
  review: "检查复盘",
  communication: "沟通",
  workflowOptimization: "工作流优化",
  administration: "行政办理",
  readingResearch: "阅读研究",
  memoryReview: "记忆复习",
} as const;

export type TaskCategoryName =
  (typeof TASK_CATEGORY_NAMES)[keyof typeof TASK_CATEGORY_NAMES];

export interface DefaultTaskCategory {
  name: TaskCategoryName;
  color: string;
}

export const DEFAULT_TASK_CATEGORIES: readonly DefaultTaskCategory[] = [
  { name: TASK_CATEGORY_NAMES.codeChange, color: "#5B8FA3" },
  { name: TASK_CATEGORY_NAMES.bugFix, color: "#E07A5F" },
  { name: TASK_CATEGORY_NAMES.testVerification, color: "#81B29A" },
  { name: TASK_CATEGORY_NAMES.configuration, color: "#9B7EBD" },
  { name: TASK_CATEGORY_NAMES.dataCollection, color: "#D4A574" },
  { name: TASK_CATEGORY_NAMES.materialOrganization, color: "#8B9E6B" },
  { name: TASK_CATEGORY_NAMES.informationOrganization, color: "#4A7C59" },
  { name: TASK_CATEGORY_NAMES.planDesign, color: "#C17767" },
  { name: TASK_CATEGORY_NAMES.implementationWriting, color: "#6B9080" },
  { name: TASK_CATEGORY_NAMES.writing, color: "#B08968" },
  { name: TASK_CATEGORY_NAMES.review, color: "#F2CC8F" },
  { name: TASK_CATEGORY_NAMES.communication, color: "#7A9E9F" },
  { name: TASK_CATEGORY_NAMES.workflowOptimization, color: "#8E7DBE" },
  { name: TASK_CATEGORY_NAMES.administration, color: "#A98467" },
  { name: TASK_CATEGORY_NAMES.readingResearch, color: "#6D8A96" },
  { name: TASK_CATEGORY_NAMES.memoryReview, color: "#A06C75" },
] as const;

interface DatabaseExecutor {
  execute: (query: string, bindValues?: unknown[]) => Promise<unknown>;
}

export async function seedDefaultTaskCategories(
  database: DatabaseExecutor,
): Promise<void> {
  for (const category of DEFAULT_TASK_CATEGORIES) {
    await database.execute(
      "INSERT OR IGNORE INTO categories (name, color) VALUES ($1, $2)",
      [category.name, category.color],
    );
  }
}
