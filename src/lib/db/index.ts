export { initDb } from "./schema";
export { getDb } from "./schema";
export type { Session, Category, Todo, CategoryBreakdown, DayData, WeekSession, WeekSummary, MoodStat, SessionNoteEntry, CompletedTaskEntry, TimePage, TimePageType } from "./types";
export type { AppEvent, AppEventSummary } from "./app-events";
export {
  recordAppEvent,
  getRecentAppEvents,
  getAppEventSummary,
} from "./app-events";
export {
  getTasks,
  addTask,
  updateTask,
  updateTaskCategoryIfUnchanged,
  deleteTask,
  toggleTaskArchived,
  incrementTaskPomos,
  completeTask,
  appendTaskNote,
  getTaskTimeToday,
} from "./tasks";
export {
  getTodos,
  addTodo,
  reorderTodos,
  updateTodoTitle,
  setTodoCompleted,
  archiveTodo,
} from "./todos";
export {
  addSession,
  startSession,
  finishSession,
  creditSessionPomo,
  updateSessionAttribution,
  reassignCompletedPomo,
  updateSessionReflection,
  abandonSession,
  getSessions,
  getTodaySessions,
  getWeekSessions,
  getWeekSummary,
} from "./sessions";
export { getSetting, setSetting } from "./settings";
export {
  getCategories,
  getCategory,
  addCategory,
  updateCategory,
  deleteCategory,
} from "./categories";
export {
  getCategoryBreakdown,
  getAllCategoryBreakdown,
  getWeeklyData,
  getAllTimeStats,
  getCurrentStreak,
  getBestStreak,
  getMoodDistribution,
  getSessionNotes,
  getCompletedTasksForPeriod,
} from "./analytics";
export { getPresets, addPreset, updatePreset, deletePreset } from "./presets";
export type { TimerPreset } from "./presets";

export {
  ensureTimeWorkspace,
  getTimePages,
  updateTimePageContent,
  addTaskActivityLog,
} from "./time-pages";
