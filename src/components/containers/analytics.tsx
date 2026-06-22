import { useState, useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import {
  getWeeklyData,
  type DayData,
} from "@/lib/db";
import { StatCard } from "@/components/base/stat-card";
import { WeeklyChart } from "@/components/base/weekly-chart";
import { BadgeCard } from "@/components/base/badge-card";
import { AnalyticsCategoryBreakdown } from "@/components/base/analytics-category-breakdown";
import { DateRangePicker } from "@/components/base/date-range-picker";
import { MoodDistribution } from "@/components/base/mood-distribution";
import { SessionNotes } from "@/components/base/session-notes";
import { CompletedTasks } from "@/components/base/completed-tasks";
import { formatTotalTime, formatDuration } from "@/lib/session-utils";
import { type DatePeriod, getDateRange } from "@/lib/date-range";

interface AnalyticsDashboardProps {
  period?: DatePeriod;
  onPeriodChange?: (p: DatePeriod) => void;
}

export function AnalyticsDashboard({ period: externalPeriod, onPeriodChange }: AnalyticsDashboardProps) {
  const [weekData, setWeekData] = useState<DayData[]>([]);
  const loadingRef = useRef(true);
  const [internalPeriod, setInternalPeriod] = useState<DatePeriod>("last7days");

  const period = externalPeriod ?? internalPeriod;
  const setPeriod = onPeriodChange ?? setInternalPeriod;

  const range = getDateRange(period);

  useEffect(() => {
    let cancelled = false;
    loadingRef.current = true;

    Promise.all([
      getWeeklyData(range.startDate, range.endDate).catch(() => []),
    ]).then(([wd]) => {
      if (!cancelled) {
        setWeekData(wd);
        loadingRef.current = false;
      }
    });

    return () => {
      cancelled = true;
    };
  }, [range.startDate, range.endDate]);

  const totalFocusSec = weekData.reduce((s, d) => s + d.total_seconds, 0);
  const totalSessions = weekData.reduce((s, d) => s + d.session_count, 0);
  const avgSessionSec =
    totalSessions > 0 ? Math.round(totalFocusSec / totalSessions) : 0;
  const avgDailySec = weekData.length > 0
    ? Math.round(totalFocusSec / weekData.length)
    : 0;

  if (loadingRef.current && weekData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Loader2 className="size-8 text-sahara-primary animate-spin" />
        <p className="text-xs font-semibold text-sahara-text-muted uppercase tracking-wider">
          正在加载分析…
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-10">
      {/* Overview Stats */}
      <section>
        <div className="flex items-center justify-between mb-4 md:mb-6">
          <h2 className="font-serif text-lg font-semibold tracking-wide md:text-2xl text-sahara-text">
            概览
          </h2>
          <DateRangePicker value={period} onChange={setPeriod} />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
          <StatCard
            label="专注总时长"
            value={formatTotalTime(totalFocusSec)}
            icon="clock"
          />
          <StatCard
            label="记录数"
            value={String(totalSessions)}
            icon="target"
          />
          <StatCard
            label="平均单次"
            value={avgSessionSec > 0 ? formatDuration(avgSessionSec) : "0分钟"}
            icon="trending"
          />
          <StatCard
            label="日均专注"
            value={avgDailySec > 0 ? formatTotalTime(avgDailySec) : "0分钟"}
            icon="flame"
          />
        </div>
      </section>

      {/* Weekly Chart */}
      <section>
        <h2 className="font-serif text-lg font-semibold tracking-wide md:text-2xl text-sahara-text mb-4 md:mb-6">
          {range.label}
        </h2>
        <div className="bg-sahara-surface border border-sahara-border/20 rounded-xl md:rounded-2xl p-3.5 md:p-5">
          <WeeklyChart data={weekData.map(d => ({
            day_name: d.day_name || "",
            focus_seconds: d.total_seconds,
          }))} />
        </div>
      </section>

      {/* Badges */}
      <section>
        <h2 className="font-serif text-lg font-semibold tracking-wide md:text-2xl text-sahara-text mb-4 md:mb-6">
          成就
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          <BadgeCard
            title="早起专注者"
            description="早上 7 点前完成一次专注"
            earned={false}
          />
          <BadgeCard
            title="长跑型选手"
            description="一天内完成 4 次以上专注"
            earned={false}
          />
          <BadgeCard
            title="稳定节奏"
            description="保持 7 天连续记录"
            earned={false}
          />
        </div>
      </section>

      {/* Category Breakdown & Tasks */}
      <section>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          <div>
            <h2 className="font-serif text-lg font-semibold tracking-wide md:text-2xl text-sahara-text mb-4 md:mb-6">
              分类分布
            </h2>
            <AnalyticsCategoryBreakdown startDate={range.startDate} endDate={range.endDate} />
          </div>
          <div>
            <h2 className="font-serif text-lg font-semibold tracking-wide md:text-2xl text-sahara-text mb-4 md:mb-6">
              任务
            </h2>
            <CompletedTasks startDate={range.startDate} endDate={range.endDate} />
          </div>
        </div>
      </section>

      {/* Mood Distribution */}
      <section>
        <h2 className="font-serif text-lg font-semibold tracking-wide md:text-2xl text-sahara-text mb-4 md:mb-6">
          状态洞察
        </h2>
        <MoodDistribution startDate={range.startDate} endDate={range.endDate} />
      </section>

      {/* Session Notes */}
      <section>
        <h2 className="font-serif text-lg font-semibold tracking-wide md:text-2xl text-sahara-text mb-4 md:mb-6">
          专注笔记
        </h2>
        <SessionNotes startDate={range.startDate} endDate={range.endDate} />
      </section>
    </div>
  );
}
