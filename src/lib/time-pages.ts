export type TimePageType = "overview" | "year" | "month" | "week" | "day";

export interface TimeWorkspaceKeys {
  overview: string;
  year: string;
  month: string;
  week: string;
  day: string;
  weekStart: string;
  weekEnd: string;
}

export function toLocalISODate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function parseLocalDate(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function startOfISOWeek(date: Date): Date {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = next.getDay() || 7;
  next.setDate(next.getDate() - day + 1);
  return next;
}

export function endOfISOWeek(date: Date): Date {
  const start = startOfISOWeek(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return end;
}

export function getISOWeekKey(date: Date): string {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNumber = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNumber);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil((((target.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${target.getUTCFullYear()}-W${String(weekNumber).padStart(2, "0")}`;
}

export function getWorkspaceKeys(date = new Date()): TimeWorkspaceKeys {
  const day = toLocalISODate(date);
  const year = String(date.getFullYear());
  const month = `${year}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  const weekStart = startOfISOWeek(date);
  const weekEnd = endOfISOWeek(date);

  return {
    overview: "overview",
    year,
    month,
    week: getISOWeekKey(date),
    day,
    weekStart: toLocalISODate(weekStart),
    weekEnd: toLocalISODate(weekEnd),
  };
}

export function getWeekDateRangeFromKey(weekKey: string): { start: string; end: string } | null {
  const match = /^(\d{4})-W(\d{2})$/.exec(weekKey);
  if (!match) return null;

  const year = Number(match[1]);
  const week = Number(match[2]);
  const januaryFourth = new Date(year, 0, 4);
  const firstWeekStart = startOfISOWeek(januaryFourth);
  const start = new Date(firstWeekStart);
  start.setDate(firstWeekStart.getDate() + (week - 1) * 7);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  return { start: toLocalISODate(start), end: toLocalISODate(end) };
}

export function getPageTitle(type: TimePageType, dateKey: string): string {
  switch (type) {
    case "overview":
      return "时间计划总览";
    case "year":
      return `${dateKey} 年`;
    case "month": {
      const [, month] = dateKey.split("-");
      return `${dateKey.slice(0, 4)} 年 ${Number(month)} 月`;
    }
    case "week":
      return `${dateKey} 周记录`;
    case "day": {
      const date = parseLocalDate(dateKey);
      const weekday = new Intl.DateTimeFormat("zh-CN", { weekday: "long" }).format(date);
      return `${dateKey} ${weekday}`;
    }
  }
}

export function getDefaultPageContent(type: TimePageType, title: string): string {
  switch (type) {
    case "overview":
      return "## 总览记录\n\n这里可以写当前阶段最重要的判断、提醒和复盘。";
    case "year":
      return `## 年计划\n\n- \n\n## 年复盘\n\n`;
    case "month":
      return `## 月计划\n\n- \n\n## 月复盘\n\n`;
    case "week":
      return `## 周复盘\n\n- 本周推进了什么：\n- 下周要继续什么：\n- 哪些任务需要调整：\n`;
    case "day":
      return `## 今日记录\n\n\n## 今日复盘\n\n- 今天完成了什么：\n- 哪些没完成：\n- 明天要继续：\n`;
    default:
      return `# ${title}\n`;
  }
}
