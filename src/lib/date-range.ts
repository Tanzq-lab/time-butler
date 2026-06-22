export type DatePeriod = "today" | "yesterday" | "last7days" | "month" | "year";

export interface DateRange {
  startDate: string;
  endDate: string;
  label: string;
}

export const PERIOD_OPTIONS: { value: DatePeriod; label: string }[] = [
  { value: "today", label: "今天" },
  { value: "yesterday", label: "昨天" },
  { value: "last7days", label: "最近 7 天" },
  { value: "month", label: "本月" },
  { value: "year", label: "今年" },
];

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function getDateRange(period: DatePeriod): DateRange {
  const today = new Date();
  const endDate = toISODate(today);

  switch (period) {
    case "today": {
      return { startDate: endDate, endDate, label: "今天" };
    }
    case "yesterday": {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return { startDate: toISODate(yesterday), endDate: toISODate(yesterday), label: "昨天" };
    }
    case "last7days": {
      const start = new Date(today);
      start.setDate(start.getDate() - 6);
      return { startDate: toISODate(start), endDate, label: "最近 7 天" };
    }
    case "month": {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      return { startDate: toISODate(start), endDate, label: "本月" };
    }
    case "year": {
      const start = new Date(today.getFullYear(), 0, 1);
      return { startDate: toISODate(start), endDate, label: "今年" };
    }
  }
}
