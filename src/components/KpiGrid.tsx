"use client";

export type Kpi = {
  label: string;
  value: string;
  hint: string;
};

export default function KpiGrid({ items }: { items: Kpi[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-3.5"
        >
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
            {item.label}
          </p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-white">
            {item.value}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">{item.hint}</p>
        </div>
      ))}
    </div>
  );
}
