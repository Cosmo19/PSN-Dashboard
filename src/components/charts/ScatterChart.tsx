"use client";

import { useMemo, useState } from "react";
import * as d3 from "d3";
import ChartTooltip from "./ChartTooltip";
import { useChartWidth } from "./useChartWidth";

export type ScatterPoint = {
  id: string;
  x: number;
  y: number;
  group: string;
  title: string;
  tooltip: { label: string; value: string }[];
};

type ScatterChartProps = {
  data: ScatterPoint[];
  xLabel: string;
  yLabel: string;
  formatX: (value: number) => string;
  formatY: (value: number) => string;
  colors: Record<string, string>;
  height?: number;
  logX?: boolean;
  /** Meaningful axis values to use instead of dense automatic log ticks. */
  xTicks?: number[];
  onSelect?: (id: string) => void;
};

export default function ScatterChart({
  data,
  xLabel,
  yLabel,
  formatX,
  formatY,
  colors,
  height,
  logX = false,
  xTicks,
  onSelect,
}: ScatterChartProps) {
  const { ref, width } = useChartWidth();
  const [hover, setHover] = useState<number | null>(null);

  const chartHeight = height ?? Math.max(270, Math.min(340, width * 0.62));
  const margin = {
    top: 16,
    right: width < 420 ? 10 : 20,
    bottom: width < 420 ? 52 : 44,
    left: width < 420 ? 44 : 52,
  };
  const innerWidth = Math.max(120, width - margin.left - margin.right);
  const innerHeight = chartHeight - margin.top - margin.bottom;

  const scales = useMemo(() => {
    if (data.length === 0) return null;

    const xValues = data.map((point) => point.x);
    const yValues = data.map((point) => point.y);

    const xDomainMin = logX
      ? Math.max(1, d3.min(xValues) ?? 1)
      : Math.min(0, d3.min(xValues) ?? 0);

    const x = logX
      ? d3
          .scaleLog()
          .domain([xDomainMin, d3.max(xValues) ?? 10])
          .range([0, innerWidth])
          .clamp(true)
      : d3
          .scaleLinear()
          .domain([xDomainMin, d3.max(xValues) ?? 1])
          .nice()
          .range([0, innerWidth]);

    const y = d3
      .scaleLinear()
      .domain([0, d3.max(yValues) ?? 1])
      .nice()
      .range([innerHeight, 0]);

    const domain = x.domain();
    const requestedTicks =
      xTicks ??
      (logX
        ? d3
            .range(
              Math.ceil(Math.log10(domain[0])),
              Math.floor(Math.log10(domain[1])) + 1
            )
            .map((power) => 10 ** power)
        : x.ticks(Math.max(3, Math.floor(innerWidth / 90))));
    const visibleTicks = requestedTicks.filter(
      (tick) => tick >= domain[0] && tick <= domain[1]
    );
    const minimumGap = width < 420 ? 54 : 68;
    const displayTicks: number[] = [];

    for (const tick of visibleTicks) {
      const previous = displayTicks.at(-1);
      if (previous === undefined || x(tick) - x(previous) >= minimumGap) {
        displayTicks.push(tick);
      }
    }

    const lastVisible = visibleTicks.at(-1);
    const lastDisplayed = displayTicks.at(-1);
    if (lastVisible !== undefined && lastVisible !== lastDisplayed) {
      if (
        lastDisplayed !== undefined &&
        x(lastVisible) - x(lastDisplayed) < minimumGap &&
        displayTicks.length > 1
      ) {
        displayTicks[displayTicks.length - 1] = lastVisible;
      } else {
        displayTicks.push(lastVisible);
      }
    }

    return { x, y, displayTicks };
  }, [data, innerWidth, innerHeight, logX, width, xTicks]);

  if (!scales) {
    return (
      <div
        ref={ref}
        className="flex items-center justify-center rounded-xl border border-slate-700 bg-slate-800/40 text-sm text-slate-400"
        style={{ height: chartHeight }}
      >
        No matching rows
      </div>
    );
  }

  const groups = Object.keys(colors);

  return (
    <div ref={ref} className="relative">
      <svg
        width={width}
        height={chartHeight}
        className="block max-w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        <g transform={`translate(${margin.left},${margin.top})`}>
          {scales.y.ticks(5).map((tick) => (
            <g key={tick} transform={`translate(0,${scales.y(tick)})`}>
              <line
                x2={innerWidth}
                stroke="rgb(var(--chart-grid))"
                strokeDasharray="2 4"
              />
              <text x={-8} dy="0.32em" textAnchor="end" className="fill-slate-500 text-[10px]">
                {formatY(tick)}
              </text>
            </g>
          ))}

          {scales.displayTicks.map((tick) => (
            <g key={tick} transform={`translate(${scales.x(tick)},0)`}>
              <line
                y1={innerHeight}
                y2={innerHeight + 4}
                stroke="rgb(var(--chart-axis))"
              />
              <text
                y={innerHeight + 16}
                textAnchor="middle"
                className="fill-slate-500 text-[10px]"
              >
                {formatX(tick)}
              </text>
            </g>
          ))}

          {data.map((point, index) => (
            <circle
              key={point.id}
              cx={scales.x(point.x)}
              cy={scales.y(point.y)}
              r={hover === index ? 6 : 3.5}
              fill={colors[point.group] ?? "#94a3b8"}
              fillOpacity={hover === null || hover === index ? 0.68 : 0.22}
              stroke={
                hover === index ? "rgb(var(--chart-hover))" : "none"
              }
              strokeWidth={1.5}
              className={onSelect ? "cursor-pointer" : undefined}
              onMouseEnter={() => setHover(index)}
              onMouseLeave={() => setHover(null)}
              onClick={() => onSelect?.(point.id)}
            />
          ))}

          <text
            x={innerWidth / 2}
            y={innerHeight + 36}
            textAnchor="middle"
            className="fill-slate-400 text-[11px]"
          >
            {xLabel}
          </text>
          <text
            transform={`rotate(-90) translate(${-innerHeight / 2},${-38})`}
            textAnchor="middle"
            className="fill-slate-400 text-[11px]"
          >
            {yLabel}
          </text>
        </g>
      </svg>

      <div className="mt-1 flex flex-wrap gap-4 pl-12 text-[11px] text-slate-400">
        {groups.map((group) => (
          <span key={group} className="flex items-center gap-1.5">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: colors[group] }}
            />
            {group}
          </span>
        ))}
      </div>

      {hover !== null && (
        <ChartTooltip
          x={margin.left + scales.x(data[hover].x)}
          y={margin.top + scales.y(data[hover].y)}
          containerWidth={width}
          title={data[hover].title}
          rows={data[hover].tooltip}
        />
      )}
    </div>
  );
}
