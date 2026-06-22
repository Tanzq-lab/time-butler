import { useState, useEffect, useRef } from "react";
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
  const loadingRef = useRef(true);

  useEffect(() => {
    loadingRef.current = true;
    getCategoryBreakdown(startDate, endDate)
      .then(setBreakdowns)
      .catch(() => setBreakdowns([]))
      .finally(() => { loadingRef.current = false; });
  }, [startDate, endDate]);

  if (loadingRef.current) {
    return (
      <div className="bg-sahara-surface border border-sahara-border/20 rounded-xl md:rounded-2xl p-3.5 md:p-5">
        <p className="text-xs text-sahara-text-muted">加载中…</p>
      </div>
    );
  }

  return (
    <div className="bg-sahara-surface border border-sahara-border/20 rounded-xl md:rounded-2xl p-3.5 md:p-5">
      {/* <h3 className="text-xs md:text-sm font-bold text-sahara-text-muted uppercase tracking-wider mb-3 md:mb-4">
        分类时间
      </h3> */}
      <CategoryBreakdownBars breakdowns={breakdowns} />
      {!hasCategoryBreakdownData(breakdowns) && (
        <p className="text-[15px] text-sahara-text-muted text-center py-6">
          还没有分类数据
        </p>
      )}
    </div>
  );
}
