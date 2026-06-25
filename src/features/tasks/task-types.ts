export interface Task {
  id: number;
  name: string;
  project?: string;
  priority?: "low" | "medium" | "high";
  estimated_pomos: number;
  completed_pomos: number;
  category_id?: number | null;
  scheduled_for?: string | null;
  week_plan_item_id?: number | null;
  completed_at?: string | null;
  completion_review?: string | null;
  created_at: string;
  archived: number;
}
