"use client";

import { useMemo, useState } from "react";
import * as d3 from "d3";
import ChartTooltip from "./ChartTooltip";
import { useChartWidth } from "./useChartWidth";

export type BubbleDatum = {
  key: string;
  value: number;
  tooltip: { label: string; value: string }[];
};

type BubbleChartProps = {
  data: BubbleDatum[];
  formatValue: (value: number) => string;
  /** Optional fixed height. Otherwise the chart scales between 360px and 560px. */
  height?: number;
};

type PackDatum = {
  key?: string;
  amount?: number;
  datum?: BubbleDatum;
  children?: PackDatum[];
};

const CHANNEL_COLORS: Record<string, string> = {
  "EMBN": "#22d3ee",
  "GCN": "#6366f1",
  "GCN AUF DEUTSCH": "#0ea5e9",
  "GCN EN ESPAÑOL": "#f59e0b",
  "GCN EN FRANÇAIS": "#14b8a6",
  "GCN ITALIA": "#3b82f6",
  "GCN RACING": "#ef4444",
  "GCN TECH": "#8b5cf6",
  "GCN TRAINING": "#a3e635",
  "GMBN": "#10b981",
  "GMBN TECH": "#06b6d4",
  "GTN": "#f97316",
};

function channelColor(channel: string): string {
  const configured = CHANNEL_COLORS[channel];
  if (configured) return configured;

  // Stable fallback for channels introduced through uploaded datasets.
  let hash = 0;
  for (const character of channel) {
    hash = (hash * 31 + character.charCodeAt(0)) | 0;
  }
  return d3.schemeTableau10[Math.abs(hash) % d3.schemeTableau10.length];
}

export default function BubbleChart({
  data,
  formatValue,
  height,
}: BubbleChartProps) {
  const { ref, width } = useChartWidth();
  const [hover, setHover] = useState<string | null>(null);
  const chartHeight = height ?? Math.max(360, Math.min(560, width * 0.48));

  const layout = useMemo(() => {
    const positive = data.filter((datum) => datum.value > 0);

    if (positive.length === 0 || width <= 0) return null;

    const total = positive.reduce((sum, datum) => sum + datum.value, 0);

    const clusterSize = Math.min(width, chartHeight);
    const root = d3
      .hierarchy<PackDatum>({
        children: positive.map((datum) => ({
          key: datum.key,
          amount: datum.value,
          datum,
        })),
      })
      .sum((node) => node.amount ?? 0)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

    const packed = d3
      .pack<PackDatum>()
      .size([clusterSize, clusterSize])
      .padding(5)(root);
    const xOffset = (width - clusterSize) / 2;
    const yOffset = (chartHeight - clusterSize) / 2;

    return {
      total,
      leaves: packed.leaves().map((leaf) => ({
        key: leaf.data.key ?? "",
        value: leaf.value ?? 0,
        r: leaf.r,
        x: leaf.x + xOffset,
        y: leaf.y + yOffset,
        fill: channelColor(leaf.data.key ?? ""),
        datum: leaf.data.datum,
      })),
    };
  }, [data, width, chartHeight]);

  if (!layout) {
    return (
      <div
        ref={ref}
        className="flex items-center justify-center rounded-xl border border-slate-700 bg-slate-800/40 text-sm text-slate-400"
        style={{ height: chartHeight }}
      >
        No channels in the current selection
      </div>
    );
  }

  const active = layout.leaves.find((leaf) => leaf.key === hover);

  return (
    <div ref={ref} className="relative">
      <svg
        width={width}
        height={chartHeight}
        className="block max-w-full"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Total views per channel, bubble area proportional to views"
      >
        {layout.leaves.map((leaf) => {
          const dimmed = hover !== null && hover !== leaf.key;
          const showName = leaf.r > 26;
          const showValue = leaf.r > 40;
          const maxChars = Math.max(3, Math.floor((leaf.r * 1.55) / 6));
          const label =
            leaf.key.length > maxChars
              ? `${leaf.key.slice(0, Math.max(1, maxChars - 1))}…`
              : leaf.key;

          return (
            <g
              key={leaf.key}
              transform={`translate(${leaf.x},${leaf.y})`}
              onMouseEnter={() => setHover(leaf.key)}
              onMouseLeave={() => setHover(null)}
            >
              <circle
                r={leaf.r}
                fill={leaf.fill}
                fillOpacity={dimmed ? 0.3 : 0.9}
                stroke={
                  hover === leaf.key
                    ? "rgb(var(--chart-hover))"
                    : "rgb(var(--bubble-outline))"
                }
                strokeWidth={hover === leaf.key ? 2 : 1}
              />

              {showName && (
                <text
                  textAnchor="middle"
                  dy={showValue ? "-0.15em" : "0.32em"}
                  className="pointer-events-none select-none fill-slate-950 text-[11px] font-semibold"
                  opacity={dimmed ? 0.45 : 1}
                >
                  {label}
                </text>
              )}

              {showValue && (
                <text
                  textAnchor="middle"
                  dy="1.15em"
                  className="pointer-events-none select-none fill-slate-950/75 text-[10px] font-medium"
                  opacity={dimmed ? 0.45 : 1}
                >
                  {formatValue(leaf.value)}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {active?.datum && (
        <ChartTooltip
          x={active.x + active.r * 0.4}
          y={active.y - active.r * 0.4}
          containerWidth={width}
          title={active.key}
          rows={[
            ...active.datum.tooltip,
            {
              label: "Share of views",
              value: `${((active.value / layout.total) * 100).toFixed(1)}%`,
            },
          ]}
        />
      )}
    </div>
  );
}
