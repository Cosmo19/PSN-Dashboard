"use client";

import { useMemo, useState } from "react";
import * as d3 from "d3";

export type DonutDatum = {
  key: string;
  value: number;
  color: string;
};

type DonutChartProps = {
  data: DonutDatum[];
  size?: number;
  centerLabel: string;
  centerValue: string;
  formatValue: (value: number) => string;
};

export default function DonutChart({
  data,
  size = 180,
  centerLabel,
  centerValue,
  formatValue,
}: DonutChartProps) {
  const [hover, setHover] = useState<string | null>(null);

  const arcs = useMemo(() => {
    const pie = d3
      .pie<DonutDatum>()
      .value((datum) => datum.value)
      .sort(null)
      .padAngle(0.02);

    const arc = d3
      .arc<d3.PieArcDatum<DonutDatum>>()
      .innerRadius(size / 2 - 26)
      .outerRadius(size / 2 - 4)
      .cornerRadius(3);

    return pie(data).map((slice) => ({
      key: slice.data.key,
      color: slice.data.color,
      value: slice.data.value,
      path: arc(slice) ?? "",
    }));
  }, [data, size]);

  const total = data.reduce((sum, datum) => sum + datum.value, 0);

  if (total <= 0) {
    return (
      <div className="flex h-44 items-center justify-center text-sm text-slate-400">
        No data
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col items-center gap-4 sm:flex-row sm:gap-5">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="h-auto w-36 shrink-0 sm:w-[180px]"
        role="img"
        aria-label={`${centerLabel}: ${centerValue}`}
      >
        <g transform={`translate(${size / 2},${size / 2})`}>
          {arcs.map((slice) => (
            <path
              key={slice.key}
              d={slice.path}
              fill={slice.color}
              opacity={hover === null || hover === slice.key ? 1 : 0.4}
              onMouseEnter={() => setHover(slice.key)}
              onMouseLeave={() => setHover(null)}
            />
          ))}
          <text textAnchor="middle" dy="-0.2em" className="fill-white text-lg font-bold">
            {centerValue}
          </text>
          <text textAnchor="middle" dy="1.2em" className="fill-slate-400 text-[10px]">
            {centerLabel}
          </text>
        </g>
      </svg>

      <ul className="w-full min-w-0 space-y-2 text-xs">
        {data.map((datum) => (
          <li
            key={datum.key}
            className="flex min-w-0 items-center gap-2"
            onMouseEnter={() => setHover(datum.key)}
            onMouseLeave={() => setHover(null)}
          >
            <span
              className="h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: datum.color }}
            />
            <span className="truncate text-slate-300">{datum.key}</span>
            <span className="ml-auto font-medium text-slate-200">
              {formatValue(datum.value)}
            </span>
            <span className="w-11 text-right text-slate-500">
              {((datum.value / total) * 100).toFixed(1)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
