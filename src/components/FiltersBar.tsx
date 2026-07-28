"use client";

import type { Filters } from "@/lib/analytics";
import type { DatasetMeta, VideoType } from "@/lib/types";

type FiltersBarProps = {
  meta: DatasetMeta;
  filters: Filters;
  onChange: (next: Filters) => void;
};

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value)
    ? list.filter((item) => item !== value)
    : [...list, value];
}

export default function FiltersBar({ meta, filters, onChange }: FiltersBarProps) {
  const allSelected = filters.accounts.length === meta.accounts.length;

  return (
    <div className="space-y-3 rounded-xl border border-slate-700 bg-slate-800/40 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          Channels
        </span>

        <button
          type="button"
          onClick={() =>
            onChange({
              ...filters,
              accounts: allSelected ? [] : [...meta.accounts],
            })
          }
          className="rounded-md border border-slate-600 px-2.5 py-1 text-[11px] font-medium text-slate-300 transition hover:border-accent hover:text-accent"
        >
          {allSelected ? "Clear all" : "Select all"}
        </button>

        {meta.accounts.map((account) => {
          const active = filters.accounts.includes(account);
          return (
            <button
              key={account}
              type="button"
              onClick={() =>
                onChange({ ...filters, accounts: toggle(filters.accounts, account) })
              }
              className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                active
                  ? "bg-accent text-slate-900"
                  : "border border-slate-600 text-slate-400 hover:text-slate-200"
              }`}
            >
              {account}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Format
          </span>
          {meta.types.map((type) => {
            const active = filters.types.includes(type);
            return (
              <button
                key={type}
                type="button"
                onClick={() =>
                  onChange({
                    ...filters,
                    types: toggle(filters.types, type) as VideoType[],
                  })
                }
                className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                  active
                    ? "bg-accent text-slate-900"
                    : "border border-slate-600 text-slate-400 hover:text-slate-200"
                }`}
              >
                {type}
              </button>
            );
          })}
        </div>

        <label className="flex items-center gap-2 text-[11px] text-slate-400">
          <span className="font-semibold uppercase tracking-wide">From</span>
          <input
            type="date"
            value={filters.from}
            min={meta.minDate}
            max={filters.to}
            onChange={(event) => onChange({ ...filters, from: event.target.value })}
            className="rounded-md border border-slate-600 bg-slate-900 px-2 py-1 text-slate-200"
          />
        </label>

        <label className="flex items-center gap-2 text-[11px] text-slate-400">
          <span className="font-semibold uppercase tracking-wide">To</span>
          <input
            type="date"
            value={filters.to}
            min={filters.from}
            max={meta.maxDate}
            onChange={(event) => onChange({ ...filters, to: event.target.value })}
            className="rounded-md border border-slate-600 bg-slate-900 px-2 py-1 text-slate-200"
          />
        </label>

        <button
          type="button"
          onClick={() =>
            onChange({
              accounts: [...meta.accounts],
              types: [...meta.types],
              from: meta.minDate,
              to: meta.maxDate,
            })
          }
          className="ml-auto text-[11px] font-medium text-slate-400 underline-offset-2 transition hover:text-accent hover:underline"
        >
          Reset filters
        </button>
      </div>
    </div>
  );
}
