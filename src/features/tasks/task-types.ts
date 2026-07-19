export interface Task {
  id: number;
  name: string;
  project?: string;
  priority?: "low" | "medium" | "high";
  sort_order?: number;
  estimated_pomos: number;
  completed_pomos: number;
  category_id?: number | null;
  scheduled_for?: string | null;
  completed_at?: string | null;
  completion_review?: string | null;
  notes?: string | null;
  created_at: string;
  archived: number;
}
