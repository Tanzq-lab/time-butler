import { invoke, isTauri } from "@/lib/tauri";

export type AiCategoryConfidence = "high" | "medium" | "low";

export interface AiApiKeyStatus {
  configured: boolean;
}

export interface AiCategoryCandidate {
  id: number;
  name: string;
}

export interface AiCategoryResult {
  categoryId: number;
  confidence: AiCategoryConfidence;
}

export async function getAiApiKeyStatus(): Promise<AiApiKeyStatus> {
  if (!isTauri()) return { configured: false };
  return invoke<AiApiKeyStatus>("ai_api_key_status");
}

export async function saveAiApiKey(apiKey: string): Promise<AiApiKeyStatus> {
  if (!isTauri()) throw new Error("ai_unavailable");
  return invoke<AiApiKeyStatus>("ai_api_key_save", { apiKey });
}

export async function clearAiApiKey(): Promise<AiApiKeyStatus> {
  if (!isTauri()) return { configured: false };
  return invoke<AiApiKeyStatus>("ai_api_key_clear");
}

export async function classifyTaskCategory(input: {
  taskName: string;
  project?: string;
  categories: AiCategoryCandidate[];
}): Promise<AiCategoryResult> {
  if (!isTauri()) throw new Error("ai_unavailable");
  return invoke<AiCategoryResult>("ai_classify_task", { request: input });
}
