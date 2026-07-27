"use client";

import { useMemo, useState } from "react";
import * as d3 from "d3";
import ChartTooltip from "./ChartTooltip";
import { useChartWidth } from "./useChartWidth";

export type ColumnDatum = {
  key: string;
  value: number;
  secondary?: number;
  tooltip: { label: string; value: string }[];
};

type ColumnChartProps = {
  data: ColumnDatum[];
  formatValue: (value: number) => string;
  height?: number;
  primaryLabel?: string;
  /** Draws a second series as a line against its own right-hand axis. */
  secondaryLabel?: string;
  formatSecondary?: (value: number) => string;
};

export default function ColumnChart({
  data,
  formatValue,
  height,
  primaryLabel = "Primary",
  secondaryLabel,
  formatSecondary,
}: ColumnChartProps) {
  const { ref, width } = useChartWidth();
  const [hover, setHover] = useState<number | null>(null);

  const chartHeight = height ?? Math.max(220, Math.min(280, width * 0.52));
  const margin = {
    top: 16,
    right: width < 420 ? 34 : 44,
    bottom: width < 420 ? 42 : 34,
    left: width < 420 ? 42 : 48,
  };
  const innerWidth = Math.max(80, width - margin.left - margin.right);
  const innerHeight = chartHeight - margin.top - margin.bottom;

  const scales = useMemo(() => {
    const x = d3
      .scaleBand()
      .domain(data.map((datum) => datum.key))
      .range([0, innerWidth])
      .padding(0.28);

    const y = d3
      .scaleLinear()
      .domain([0, d3.max(data, (datum) => datum.value) ?? 1])
      .nice()
      .range([innerHeight, 0]);

    const ySecondary = d3
      .scaleLinear()
      .domain([0, d3.max(data, (datum) => datum.secondary ?? 0) ?? 1])
      .nice()
      .range([innerHeight, 0]);

    const line = d3
      .line<ColumnDatum>()
      .x((datum) => (x(datum.key) ?? 0) + x.bandwidth() / 2)
      .y((datum) => ySecondary(datum.secondary ?? 0))
      .curve(d3.curveMonotoneX);

    return {
      x,
      y,
      ySecondary,
      secondaryPath: secondaryLabel ? line(data) ?? "" : "",
    };
  }, [data, innerWidth, innerHeight, secondaryLabel]);

  if (data.length === 0) {
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

  return (
    <div ref={ref} className="relative">
      <svg
        width={width}
        height={chartHeight}
        className="block max-w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        <g transform={`translate(${margin.left},${margin.top})`}>
          {scales.y.ticks(4).map((tick) => (
            <g key={tick} transform={`translate(0,${scales.y(tick)})`}>
              <line x2={innerWidth} stroke="#334155" strokeDasharray="2 4" />
              <text x={-8} dy="0.32em" textAnchor="end" className="fill-slate-500 text-[10px]">
                {formatValue(tick)}
              </text>
            </g>
          ))}

          {data.map((datum, index) => {
            const bandX = scales.x(datum.key) ?? 0;
            const barY = scales.y(datum.value);

            return (
              <g
                key={datum.key}
                onMouseEnter={() => setHover(index)}
                onMouseLeave={() => setHover(null)}
              >
                <rect
                  x={bandX}
                  y={barY}
                  width={scales.x.bandwidth()}
                  height={Math.max(1, innerHeight - barY)}
                  rx={4}
                  fill="#38bdf8"
                  opacity={hover === null || hover === index ? 0.9 : 0.4}
                />
                <text
                  x={bandX + scales.x.bandwidth() / 2}
                  y={innerHeight + 16}
                  textAnchor="middle"
                  className="fill-slate-400 text-[10px]"
                >
                  {datum.key}
                </text>
              </g>
            );
          })}

          {secondaryLabel && (
            <>
              <path
                d={scales.secondaryPath}
                fill="none"
                stroke="#f472b6"
                strokeWidth={2}
              />
              {data.map((datum) => (
                <circle
                  key={`dot-${datum.key}`}
                  cx={(scales.x(datum.key) ?? 0) + scales.x.bandwidth() / 2}
                  cy={scales.ySecondary(datum.secondary ?? 0)}
                  r={3}
                  fill="#f472b6"
                />
              ))}
              {scales.ySecondary.ticks(4).map((tick) => (
                <text
                  key={`sec-${tick}`}
                  x={innerWidth + 8}
                  y={scales.ySecondary(tick)}
                  dy="0.32em"
                  className="fill-pink-400/70 text-[10px]"
                >
                  {formatSecondary ? formatSecondary(tick) : tick}
                </text>
              ))}
            </>
          )}
        </g>
      </svg>

      {secondaryLabel && (
        <div className="mt-1 flex gap-4 pl-12 text-[11px] text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-accent" /> {primaryLabel}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded bg-pink-400" /> {secondaryLabel}
          </span>
        </div>
      )}

      {hover !== null && (
        <ChartTooltip
          x={margin.left + (scales.x(data[hover].key) ?? 0)}
          y={margin.top + scales.y(data[hover].value)}
          containerWidth={width}
          title={data[hover].key}
          rows={data[hover].tooltip}
        />
      )}
    </div>
  );
}
