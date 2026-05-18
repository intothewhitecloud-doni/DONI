import type { MetricChartType } from "../../lib/domain/types";

export type MetricChartPoint = {
  label: string;
  value: number;
  observedAt?: string;
};

type MetricChartStatus = "normal" | "warning" | "critical";

type MetricChartProps = {
  chartType: MetricChartType;
  id: string;
  points: MetricChartPoint[];
  status: MetricChartStatus;
  unit: string;
  compact?: boolean;
};

const chartColors: Record<MetricChartStatus, { bar: string; fill: string; stroke: string }> = {
  normal: {
    bar: "bg-blue-500",
    fill: "rgba(37, 99, 235, 0.14)",
    stroke: "#2563eb"
  },
  warning: {
    bar: "bg-amber-500",
    fill: "rgba(245, 158, 11, 0.16)",
    stroke: "#f59e0b"
  },
  critical: {
    bar: "bg-rose-500",
    fill: "rgba(244, 63, 94, 0.16)",
    stroke: "#f43f5e"
  }
};

export function MetricChart({ chartType, compact = false, id, points, status, unit }: MetricChartProps) {
  if (chartType === "pie") {
    return <MetricPieChart points={points} status={status} unit={unit} />;
  }

  if (chartType === "line" || chartType === "time_series") {
    return (
      <MetricLineChart
        compact={compact}
        id={id}
        points={points}
        status={status}
        unit={unit}
        variant={chartType === "time_series" ? "time_series" : "line"}
      />
    );
  }

  return <MetricBarChart compact={compact} id={id} points={points} status={status} unit={unit} />;
}

function MetricBarChart({
  compact,
  id,
  points,
  status,
  unit
}: {
  compact: boolean;
  id: string;
  points: MetricChartPoint[];
  status: MetricChartStatus;
  unit: string;
}) {
  const maxValue = maxPointValue(points);
  const color = chartColors[status].bar;

  return (
    <div className={`mt-4 flex ${compact ? "h-32" : "h-40"} items-end gap-2 pb-1`}>
      {points.map((point, index) => {
        const isCurrent = index === points.length - 1;
        const heightPercent = Math.max(10, (point.value / maxValue) * 100);

        return (
          <div key={`${id}-${point.label}`} className="flex h-full flex-1 flex-col items-center justify-end">
            <span className={`text-xs font-bold ${isCurrent ? "text-slate-900" : "text-slate-500"}`}>
              {point.value}{unit}
            </span>
            <div className={`${compact ? "h-20" : "h-24"} mt-1 flex w-full items-end`}>
              <div className={`w-full rounded-t-md ${isCurrent ? color : "bg-slate-200"}`} style={{ height: `${heightPercent}%` }} />
            </div>
            <p className="mt-2 min-h-8 w-full text-center text-xs font-semibold leading-4 text-slate-600">{point.label}</p>
          </div>
        );
      })}
    </div>
  );
}

function MetricLineChart({
  compact,
  id,
  points,
  status,
  unit,
  variant
}: {
  compact: boolean;
  id: string;
  points: MetricChartPoint[];
  status: MetricChartStatus;
  unit: string;
  variant: "line" | "time_series";
}) {
  const orderedPoints = variant === "time_series" ? [...points].sort(compareTimeSeriesPoints) : points;
  const maxValue = maxPointValue(orderedPoints);
  const colors = chartColors[status];
  const width = compact ? 280 : 420;
  const height = compact ? 118 : 152;
  const paddingX = compact ? 24 : 34;
  const paddingTop = compact ? 22 : 26;
  const paddingBottom = compact ? 32 : 38;
  const plotWidth = width - paddingX * 2;
  const plotHeight = height - paddingTop - paddingBottom;
  const bottomY = paddingTop + plotHeight;
  const xAxisLabelY = height - (compact ? 7 : 9);
  const coordinates = orderedPoints.map((point, index) => {
    const x = orderedPoints.length === 1 ? width / 2 : paddingX + (plotWidth * index) / (orderedPoints.length - 1);
    const y = paddingTop + (1 - point.value / maxValue) * plotHeight;

    return { ...point, x, y };
  });
  const linePoints = coordinates.map((point) => `${point.x},${point.y}`).join(" ");
  const areaPoints = coordinates.length > 0
    ? `${coordinates[0].x},${bottomY} ${linePoints} ${coordinates[coordinates.length - 1].x},${bottomY}`
    : "";

  return (
    <div className="mt-4">
      <div className={compact ? "h-32" : "h-40"}>
        <svg aria-label={`${variant === "time_series" ? "시계열" : "선"} 그래프`} className="h-full w-full" role="img" viewBox={`0 0 ${width} ${height}`}>
          <line stroke="#cbd5e1" strokeWidth="1" x1={paddingX} x2={width - paddingX} y1={bottomY} y2={bottomY} />
          {variant === "time_series" && areaPoints && <polygon fill={colors.fill} points={areaPoints} />}
          {variant === "time_series" && coordinates.map((point) => (
            <line key={`${id}-${point.label}-grid`} stroke="#e2e8f0" strokeWidth="1" x1={point.x} x2={point.x} y1={paddingTop} y2={bottomY} />
          ))}
          <polyline fill="none" points={linePoints} stroke={colors.stroke} strokeLinecap="round" strokeLinejoin="round" strokeWidth={compact ? "3" : "3.5"} />
          {coordinates.map((point, index) => {
            const isCurrent = index === coordinates.length - 1;
            const labelY = Math.max(9, point.y - 6);

            return (
              <g key={`${id}-${point.label}-point`}>
                <circle cx={point.x} cy={point.y} fill="white" r={compact ? "4" : "4.5"} stroke={isCurrent ? colors.stroke : "#94a3b8"} strokeWidth="2.5" />
                <text fill={isCurrent ? "#0f172a" : "#64748b"} fontSize={compact ? "8" : "9"} fontWeight="700" textAnchor="middle" x={point.x} y={labelY}>
                  {point.value}{unit}
                </text>
              </g>
            );
          })}
          {coordinates.map((point, index) => {
            const isFirst = index === 0;
            const isLast = index === coordinates.length - 1;

            return (
              <text
                key={`${id}-${point.label}-axis-label`}
                fill="#475569"
                fontSize={compact ? "10" : "11"}
                fontWeight="700"
                textAnchor={isFirst ? "start" : isLast ? "end" : "middle"}
                x={point.x}
                y={xAxisLabelY}
              >
                {point.label}
              </text>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

function MetricPieChart({ points, status, unit }: { points: MetricChartPoint[]; status: MetricChartStatus; unit: string }) {
  const maxValue = maxPointValue(points);
  const current = points.at(-1)?.value ?? 0;
  const percent = Math.min(100, Math.max(0, (current / maxValue) * 100));
  const colors = chartColors[status];

  return (
    <div className="mt-5 grid grid-cols-[96px_1fr] items-center gap-4">
      <div
        className="h-24 w-24 rounded-full border border-slate-200"
        style={{ background: `conic-gradient(${colors.stroke} ${percent * 3.6}deg, #e2e8f0 0deg)` }}
      />
      <div className="space-y-2 text-sm text-slate-600">
        {points.map((point) => <p key={point.label}>{point.label}: {point.value}{unit}</p>)}
      </div>
    </div>
  );
}

function maxPointValue(points: MetricChartPoint[]): number {
  return Math.max(1, ...points.map((point) => point.value));
}

function compareTimeSeriesPoints(left: MetricChartPoint, right: MetricChartPoint): number {
  const leftTime = left.observedAt ? Date.parse(left.observedAt) : Number.NaN;
  const rightTime = right.observedAt ? Date.parse(right.observedAt) : Number.NaN;

  if (Number.isNaN(leftTime) || Number.isNaN(rightTime)) {
    return left.label.localeCompare(right.label);
  }

  return leftTime - rightTime;
}
