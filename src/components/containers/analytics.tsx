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
import { SectionHeader } from "@/components/ui/page-header";

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
        setWeekData(
          wd
            .filter((day) => Boolean(day.date && day.day_name))
            .map((day) => ({
              ...day,
              total_seconds: Number.isFinite(day.total_seconds) ? day.total_seconds : 0,
              session_count: Number.isFinite(day.session_count) ? day.session_count : 0,
            })),
        );
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
      <div className="flex h-64 flex-col items-center justify-center gap-4">
        <Loader2 className="size-8 text-sahara-primary animate-spin" />
        <p className="text-xs font-medium text-sahara-text-secondary">
          正在加载分析…
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-10">
      {/* Overview Stats */}
      <section>
        <SectionHeader title="概览" actions={<DateRangePicker value={period} onChange={setPeriod} />} className="mb-4 md:mb-6" />
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
        <SectionHeader title={range.label} className="mb-4 md:mb-6" />
        <div className="border-y border-sahara-border bg-sahara-surface py-4 md:py-5">
          {weekData.length > 0 ? (
            <WeeklyChart data={weekData.map(d => ({
              day_name: d.day_name || "",
              focus_seconds: d.total_seconds,
            }))} />
          ) : (
            <div className="flex h-24 items-center justify-center text-sm text-sahara-text-secondary md:h-28">
              这个时间范围还没有专注记录
            </div>
          )}
        </div>
      </section>

      {/* Badges */}
      <section>
        <SectionHeader title="成就" className="mb-4 md:mb-6" />
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
            <SectionHeader title="分类分布" className="mb-4 md:mb-6" />
            <AnalyticsCategoryBreakdown startDate={range.startDate} endDate={range.endDate} />
          </div>
          <div>
            <SectionHeader title="任务" className="mb-4 md:mb-6" />
            <CompletedTasks startDate={range.startDate} endDate={range.endDate} />
          </div>
        </div>
      </section>

      {/* Mood Distribution */}
      <section>
        <SectionHeader title="状态洞察" className="mb-4 md:mb-6" />
        <MoodDistribution startDate={range.startDate} endDate={range.endDate} />
      </section>

      {/* Session Notes */}
      <section>
        <SectionHeader title="专注笔记" className="mb-4 md:mb-6" />
        <SessionNotes startDate={range.startDate} endDate={range.endDate} />
      </section>
    </div>
  );
}
