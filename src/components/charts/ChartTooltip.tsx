"use client";

type ChartTooltipProps = {
  x: number;
  y: number;
  containerWidth: number;
  title: string;
  rows: { label: string; value: string }[];
};

export default function ChartTooltip({
  x,
  y,
  containerWidth,
  title,
  rows,
}: ChartTooltipProps) {
  const flip = x > containerWidth - 180;

  return (
    <div
      className="pointer-events-none absolute z-20 w-44 rounded-lg border border-slate-600 bg-slate-900/95 p-2.5 shadow-xl backdrop-blur"
      style={{
        left: flip ? x - 184 : x + 12,
        top: Math.max(0, y - 12),
      }}
    >
      <p className="mb-1.5 truncate text-xs font-semibold text-slate-100">{title}</p>
      <dl className="space-y-0.5">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between gap-2 text-[11px]">
            <dt className="text-slate-400">{row.label}</dt>
            <dd className="font-medium text-slate-200">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
