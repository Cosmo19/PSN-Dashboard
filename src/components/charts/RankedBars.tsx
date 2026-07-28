"use client";

import { useMemo, useState } from "react";
import * as d3 from "d3";
import ChartTooltip from "./ChartTooltip";
import { useChartWidth } from "./useChartWidth";

export type RankedDatum = {
  key: string;
  value: number;
  tooltip: { label: string; value: string }[];
};

type RankedBarsProps = {
  data: RankedDatum[];
  formatValue: (value: number) => string;
  barColor?: string;
};

const ROW_HEIGHT = 26;

export default function RankedBars({
  data,
  formatValue,
  barColor = "#38bdf8",
}: RankedBarsProps) {
  const { ref, width } = useChartWidth();
  const [hover, setHover] = useState<number | null>(null);

  const margin = {
    top: 4,
    right: width < 420 ? 48 : 64,
    bottom: 4,
    left: width < 420 ? 88 : 132,
  };
  const innerWidth = Math.max(80, width - margin.left - margin.right);
  const height = data.length * ROW_HEIGHT + margin.top + margin.bottom;
  const labelChars = width < 420 ? 11 : 18;

  const x = useMemo(
    () =>
      d3
        .scaleLinear()
        .domain([0, d3.max(data, (datum) => datum.value) ?? 1])
        .nice()
        .range([0, innerWidth]),
    [data, innerWidth]
  );

  if (data.length === 0) {
    return (
      <div
        ref={ref}
        className="flex h-40 items-center justify-center rounded-xl border border-slate-700 bg-slate-800/40 text-sm text-slate-400"
      >
        No matching rows
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
      >
        <g transform={`translate(${margin.left},${margin.top})`}>
          {data.map((datum, index) => {
            const y = index * ROW_HEIGHT;
            const barWidth = Math.max(1, x(datum.value));

            return (
              <g
                key={datum.key}
                onMouseEnter={() => setHover(index)}
                onMouseLeave={() => setHover(null)}
              >
                <rect
                  x={-margin.left}
                  y={y}
                  width={width}
                  height={ROW_HEIGHT}
                  fill={
                    hover === index
                      ? "rgb(var(--chart-row-hover))"
                      : "transparent"
                  }
                />
                <text
                  x={-10}
                  y={y + ROW_HEIGHT / 2}
                  dy="0.32em"
                  textAnchor="end"
                  className="fill-slate-300 text-[11px]"
                >
                  {datum.key.length > labelChars
                    ? `${datum.key.slice(0, labelChars - 1)}…`
                    : datum.key}
                </text>
                <rect
                  y={y + 5}
                  width={barWidth}
                  height={ROW_HEIGHT - 12}
                  rx={3}
                  fill={barColor}
                  opacity={hover === index ? 1 : 0.82}
                />
                <text
                  x={barWidth + 8}
                  y={y + ROW_HEIGHT / 2}
                  dy="0.32em"
                  className="fill-slate-400 text-[10px]"
                >
                  {formatValue(datum.value)}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {hover !== null && (
        <ChartTooltip
          x={margin.left + x(data[hover].value)}
          y={margin.top + hover * ROW_HEIGHT}
          containerWidth={width}
          title={data[hover].key}
          rows={data[hover].tooltip}
        />
      )}
    </div>
  );
}
