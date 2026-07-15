export interface Session {
  id: number;
  task_id: number | null;
  task_name?: string | null;
  phase: string;
  started_at: string;
  ended_at: string | null;
  duration_sec: number;
  completed: number;
  pomo_counted?: number;
  category_id: number | null;
  category_name?: string | null;
  category_color?: string | null;
  intention: string | null;
  mood: string | null;
  notes: string | null;
}

export interface Category {
  id: number;
  name: string;
  color: string;
  created_at: string;
}

export interface Todo {
  id: number;
  title: string;
  completed_at: string | null;
  archived: number;
  created_at: string;
  updated_at: string;
}

export interface CategoryBreakdown {
  category_id: number | null;
  intention: string | null;
  category_name: string | null;
  category_color: string | null;
  total_seconds: number;
  session_count: number;
}

export interface DayData {
  date: string;
  day_name: string;
  total_seconds: number;
  session_count: number;
}

export interface WeekSession {
  id: number;
  task_id: number | null;
  task_name: string | null;
  phase: string;
  started_at: string;
  duration_sec: number;
  completed: number;
  category_id: number | null;
  category_name: string | null;
  category_color: string | null;
  intention: string | null;
  mood: string | null;
  notes: string | null;
}

export interface WeekSummary {
  total_seconds: number;
  total_sessions: number;
  work_sessions: number;
  break_sessions: number;
  avg_daily_seconds: number;
  peak_day: string | null;
  peak_day_seconds: number;
}

export interface MoodStat {
  mood: string;
  count: number;
}

export interface SessionNoteEntry {
  id: number;
  started_at: string;
  ended_at: string | null;
  duration_sec: number;
  mood: string | null;
  notes: string | null;
  category_name: string | null;
  category_color: string | null;
  task_name: string | null;
}

export type TimePageType = "overview" | "year" | "month" | "week" | "day";

export interface TimePage {
  id: number;
  type: TimePageType;
  title: string;
  date_key: string;
  parent_id: number | null;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface CompletedTaskEntry {
  task_id: number;
  task_name: string;
  category_name: string | null;
  category_color: string | null;
  total_seconds: number;
  session_count: number;
  completed_pomos: number;
  estimated_pomos: number;
}
