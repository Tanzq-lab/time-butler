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
              pomo_count: Number.isFinite(day.pomo_count) ? day.pomo_count : 0,
            })),
        );
        loadingRef.current = false;
      }
    });

    return () => {
      cancelled = true;
    };
  }, [range.startDate, range.endDate]);

  const totalPomos = weekData.reduce((sum, day) => sum + day.pomo_count, 0);
  const activePomoDays = weekData.filter((day) => day.pomo_count > 0);
  const avgDailyPomos = activePomoDays.length > 0
    ? Math.round((totalPomos / activePomoDays.length) * 10) / 10
    : 0;
  const peakDailyPomos = Math.max(...weekData.map((day) => day.pomo_count), 0);

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
            label="完成番茄"
            value={`${totalPomos} 个番茄`}
            icon="target"
          />
          <StatCard
            label="日均番茄"
            value={`${avgDailyPomos} 个番茄`}
            icon="flame"
          />
          <StatCard
            label="高峰单日"
            value={`${peakDailyPomos} 个番茄`}
            icon="trending"
          />
          <StatCard
            label="活跃天数"
            value={`${activePomoDays.length} 天`}
            icon="clock"
          />
        </div>
      </section>

      {/* Weekly Chart */}
      <section>
        <SectionHeader title={`${range.label} · 每日番茄`} className="mb-4 md:mb-6" />
        <div className="border-y border-sahara-border bg-sahara-surface py-4 md:py-5">
          {weekData.length > 0 ? (
            <WeeklyChart data={weekData.map(d => ({
              day_name: d.day_name || "",
              pomo_count: d.pomo_count,
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
