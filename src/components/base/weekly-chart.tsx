import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface WeekPoint {
  day_name: string;
  pomo_count: number;
}

interface WeeklyChartProps {
  data: WeekPoint[];
}

const DAY_ORDER = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{
    value: number;
    payload: { day_name: string; pomo_count: number };
  }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  const d = payload[0];
  const pomos = d.value;

  if (!pomos)
    return (
      <div className="bg-sahara-bg border border-sahara-border/30 rounded-lg px-3 py-2 shadow-lg">
        <p className="text-[11px] font-semibold text-sahara-text">{label}</p>
        <p className="text-[10px] text-sahara-text-muted">没有完成番茄</p>
      </div>
    );

  return (
    <div className="bg-sahara-bg border border-sahara-border/30 rounded-lg px-3 py-2 shadow-lg">
      <p className="text-[11px] font-semibold text-sahara-text">{label}</p>
      <p className="text-[10px] text-sahara-primary font-bold tabular-nums">
        完成 {pomos} 个番茄
      </p>
    </div>
  );
}

export function WeeklyChart({ data }: WeeklyChartProps) {
  const sorted = [...data].sort(
    (a, b) => DAY_ORDER.indexOf(a.day_name) - DAY_ORDER.indexOf(b.day_name),
  );

  const chartData = sorted;
  const maxVal = Math.max(...chartData.map((d) => d.pomo_count), 1);

  return (
    <div className="w-full" style={{ height: 200 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 8, right: 4, left: -20, bottom: 0 }}
          barCategoryGap="25%"
        >
          <XAxis
            dataKey="day_name"
            axisLine={false}
            tickLine={false}
            tick={{
              fill: "#9ca3af",
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.05em",
            }}
            dy={8}
          />
          <YAxis hide domain={[0, Math.ceil(maxVal / 4) * 4 || 4]} />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ fill: "rgba(120, 119, 116, 0.08)", radius: 4 }}
          />
          <Bar
            dataKey="pomo_count"
            radius={[3, 3, 0, 0]}
            maxBarSize={48}
            animationDuration={800}
            animationEasing="ease-out"
          >
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.pomo_count > 0 ? "var(--color-sahara-primary)" : "var(--color-sahara-border)"}
                fillOpacity={entry.pomo_count > 0 ? 1 : 0.3}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
