import { useState, useEffect } from "react";
import { getCategoryBreakdown, type CategoryBreakdown } from "@/lib/db";
import {
  CategoryBreakdown as CategoryBreakdownBars,
  hasCategoryBreakdownData,
} from "@/components/base/category-breakdown";

interface AnalyticsCategoryBreakdownProps {
  startDate?: string;
  endDate?: string;
}

export function AnalyticsCategoryBreakdown({ startDate, endDate }: AnalyticsCategoryBreakdownProps) {
  const [breakdowns, setBreakdowns] = useState<CategoryBreakdown[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getCategoryBreakdown(startDate, endDate)
      .then((entries) => setBreakdowns(entries.filter((entry) =>
        Number.isFinite(entry.pomo_count),
      )))
      .catch(() => setBreakdowns([]))
      .finally(() => setLoading(false));
  }, [startDate, endDate]);

  if (loading) {
    return (
      <div className="rounded-[10px] border border-sahara-border bg-sahara-surface p-3.5 md:p-5">
        <p className="text-xs text-sahara-text-secondary">加载中…</p>
      </div>
    );
  }

  return (
    <div className="rounded-[10px] border border-sahara-border bg-sahara-surface p-3.5 md:p-5">
      <CategoryBreakdownBars breakdowns={breakdowns} />
      {!hasCategoryBreakdownData(breakdowns) && (
        <p className="py-6 text-center text-[15px] text-sahara-text-secondary">
          还没有分类数据
        </p>
      )}
    </div>
  );
}
