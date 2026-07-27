"use client";

import { useMemo, useState } from "react";
import * as d3 from "d3";
import type { TrendPoint } from "@/lib/analytics";
import { formatCompact, formatDate, formatDateShort } from "@/lib/format";
import ChartTooltip from "./ChartTooltip";
import { useChartWidth } from "./useChartWidth";

type TrendChartProps = {
  data: TrendPoint[];
  height?: number;
};

export default function TrendChart({ data, height = 300 }: TrendChartProps) {
  const { ref, width } = useChartWidth();
  const [hover, setHover] = useState<number | null>(null);

  const margin = {
    top: 16,
    right: width < 480 ? 42 : 56,
    bottom: 32,
    left: width < 480 ? 46 : 56,
  };
  const innerWidth = Math.max(120, width - margin.left - margin.right);
  const innerHeight = height - margin.top - margin.bottom;

  const chart = useMemo(() => {
    if (data.length === 0) return null;

    const points = data.map((point) => ({
      ...point,
      parsed: new Date(`${point.date}T00:00:00Z`),
      watchHours: point.watchMin / 60,
    }));

    const x = d3
      .scaleTime()
      .domain(d3.extent(points, (point) => point.parsed) as [Date, Date])
      .range([0, innerWidth]);

    const yViews = d3
      .scaleLinear()
      .domain([0, d3.max(points, (point) => point.views) ?? 1])
      .nice()
      .range([innerHeight, 0]);

    const yWatch = d3
      .scaleLinear()
      .domain([0, d3.max(points, (point) => point.watchHours) ?? 1])
      .nice()
      .range([innerHeight, 0]);

    const area = d3
      .area<(typeof points)[number]>()
      .x((point) => x(point.parsed))
      .y0(innerHeight)
      .y1((point) => yViews(point.views))
      .curve(d3.curveMonotoneX);

    const viewsLine = d3
      .line<(typeof points)[number]>()
      .x((point) => x(point.parsed))
      .y((point) => yViews(point.views))
      .curve(d3.curveMonotoneX);

    const watchLine = d3
      .line<(typeof points)[number]>()
      .x((point) => x(point.parsed))
      .y((point) => yWatch(point.watchHours))
      .curve(d3.curveMonotoneX);

    return {
      points,
      x,
      yViews,
      yWatch,
      areaPath: area(points) ?? "",
      viewsPath: viewsLine(points) ?? "",
      watchPath: watchLine(points) ?? "",
    };
  }, [data, innerWidth, innerHeight]);

  const active = hover !== null && chart ? chart.points[hover] : null;

  const handleMove = (event: React.MouseEvent<SVGRectElement>) => {
    if (!chart) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const offset = event.clientX - bounds.left;
    const date = chart.x.invert(offset);
    const bisect = d3.bisector<(typeof chart.points)[number], Date>(
      (point) => point.parsed
    ).center;
    setHover(bisect(chart.points, date));
  };

  if (!chart) {
    return (
      <div
        ref={ref}
        className="flex items-center justify-center rounded-xl border border-slate-700 bg-slate-800/40 text-sm text-slate-400"
        style={{ height }}
      >
        No data in the selected range
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <svg
        width={width}
        height={height}
        className="block max-w-full"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Daily views and watch time"
      >
        <defs>
          <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.45} />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity={0} />
          </linearGradient>
        </defs>

        <g transform={`translate(${margin.left},${margin.top})`}>
          {chart.yViews.ticks(5).map((tick) => (
            <g key={tick} transform={`translate(0,${chart.yViews(tick)})`}>
              <line x2={innerWidth} stroke="#334155" strokeDasharray="2 4" />
              <text x={-10} dy="0.32em" textAnchor="end" className="fill-slate-500 text-[10px]">
                {formatCompact(tick)}
              </text>
            </g>
          ))}

          {chart.yWatch.ticks(5).map((tick) => (
            <text
              key={`watch-${tick}`}
              x={innerWidth + 10}
              y={chart.yWatch(tick)}
              dy="0.32em"
              className="fill-amber-500/70 text-[10px]"
            >
              {formatCompact(tick)}
            </text>
          ))}

          {chart.x
            .ticks(Math.max(2, Math.min(8, Math.floor(innerWidth / 90))))
            .map((tick) => (
            <text
              key={tick.toISOString()}
              x={chart.x(tick)}
              y={innerHeight + 18}
              textAnchor="middle"
              className="fill-slate-500 text-[10px]"
            >
              {formatDateShort(tick.toISOString().slice(0, 10))}
            </text>
            ))}

          <path d={chart.areaPath} fill="url(#trend-fill)" />
          <path d={chart.viewsPath} fill="none" stroke="#38bdf8" strokeWidth={2} />
          <path
            d={chart.watchPath}
            fill="none"
            stroke="#f59e0b"
            strokeWidth={1.75}
            strokeDasharray="4 3"
          />

          {active && (
            <g>
              <line
                x1={chart.x(active.parsed)}
                x2={chart.x(active.parsed)}
                y1={0}
                y2={innerHeight}
                stroke="#94a3b8"
                strokeDasharray="3 3"
              />
              <circle
                cx={chart.x(active.parsed)}
                cy={chart.yViews(active.views)}
                r={4}
                fill="#38bdf8"
                stroke="#0f172a"
                strokeWidth={1.5}
              />
              <circle
                cx={chart.x(active.parsed)}
                cy={chart.yWatch(active.watchHours)}
                r={4}
                fill="#f59e0b"
                stroke="#0f172a"
                strokeWidth={1.5}
              />
            </g>
          )}

          <rect
            width={innerWidth}
            height={innerHeight}
            fill="transparent"
            onMouseMove={handleMove}
            onMouseLeave={() => setHover(null)}
          />
        </g>
      </svg>

      <div className="mt-1 flex flex-wrap gap-4 pl-14 text-[11px]">
        <span className="flex items-center gap-1.5 text-slate-400">
          <span className="h-0.5 w-4 rounded bg-accent" /> Views (left)
        </span>
        <span className="flex items-center gap-1.5 text-slate-400">
          <span className="h-0.5 w-4 rounded bg-amber-500" /> Watch hours (right)
        </span>
      </div>

      {active && (
        <ChartTooltip
          x={margin.left + chart.x(active.parsed)}
          y={margin.top + chart.yViews(active.views)}
          containerWidth={width}
          title={formatDate(active.date)}
          rows={[
            { label: "Views", value: formatCompact(active.views) },
            { label: "Watch hours", value: formatCompact(active.watchHours) },
            { label: "Likes", value: formatCompact(active.likes) },
            { label: "Comments", value: formatCompact(active.comments) },
            { label: "Shares", value: formatCompact(active.shares) },
          ]}
        />
      )}
    </div>
  );
}
