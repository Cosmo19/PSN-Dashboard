"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatNumber } from "@/lib/format";
import type { InspectResult, InspectTable, RowFilter } from "@/lib/inspectTypes";
import { FLAG_LABELS, ROW_FILTERS } from "@/lib/inspectTypes";

const PAGE_SIZES = [25, 50, 100, 200];

const TABS: { key: InspectTable; label: string }[] = [
  { key: "posts", label: "posts.csv" },
  { key: "poststats", label: "poststats.csv" },
];

const FLAG_TONE: Record<string, string> = {
  separators: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  "bad-date": "bg-red-500/15 text-red-300 border-red-500/30",
  "non-numeric": "bg-red-500/15 text-red-300 border-red-500/30",
  negative: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  "no-video-id": "bg-red-500/15 text-red-300 border-red-500/30",
  "duplicate-id": "bg-amber-500/15 text-amber-300 border-amber-500/30",
  "zero-length": "bg-slate-500/15 text-slate-300 border-slate-500/30",
  orphan: "bg-red-500/15 text-red-300 border-red-500/30",
  "no-stats": "bg-amber-500/15 text-amber-300 border-amber-500/30",
};

export default function DatasetInspector({ onClose }: { onClose: () => void }) {
  const [table, setTable] = useState<InspectTable>("posts");
  const [filter, setFilter] = useState<RowFilter>("all");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);
  const [result, setResult] = useState<InspectResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setOffset(0);
  }, [table, filter, debounced, limit]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({
      table,
      filter,
      q: debounced,
      offset: String(offset),
      limit: String(limit),
    });

    fetch(`/api/dataset/rows?${params}`, { signal: controller.signal })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "Could not read rows.");
        return body as InspectResult;
      })
      .then(setResult)
      .catch((cause: unknown) => {
        if (cause instanceof Error && cause.name === "AbortError") return;
        setError(cause instanceof Error ? cause.message : "Unknown error");
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [table, filter, debounced, offset, limit]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const exportJson = useCallback(() => {
    if (!result) return;
    const blob = new Blob(
      [JSON.stringify(result.rows.map((row) => row.cells), null, 2)],
      { type: "application/json" }
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${result.table}-rows-${result.offset}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [result]);

  const rawColumns = useMemo(
    () => result?.columns.filter((column) => column.group === "raw") ?? [],
    [result]
  );
  const derivedColumns = useMemo(
    () => result?.columns.filter((column) => column.group === "derived") ?? [],
    [result]
  );

  const page = Math.floor(offset / limit) + 1;
  const pages = result ? Math.max(1, Math.ceil(result.total / limit)) : 1;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/30 p-3 backdrop-blur-sm sm:p-6">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-white">Dataset inspector</h2>
            <p className="text-[11px] text-slate-500">
              Source cells beside the values the dashboard derives from them
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex rounded-md border border-slate-600 p-0.5">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setTable(tab.key)}
                  className={`rounded px-3 py-1 text-[11px] font-medium transition ${
                    table === tab.key
                      ? "bg-accent text-slate-900"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-600 px-3 py-1.5 text-[11px] font-medium text-slate-300 transition hover:border-accent hover:text-accent"
            >
              Close
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-b border-slate-700 bg-slate-800/40 px-4 py-2.5">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search raw and derived cells…"
            className="w-56 rounded-md border border-slate-600 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:border-accent focus:outline-none"
          />

          <div className="flex items-center gap-1">
            {ROW_FILTERS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setFilter(option)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-medium capitalize transition ${
                  filter === option
                    ? "bg-accent text-slate-900"
                    : "border border-slate-600 text-slate-400 hover:text-slate-200"
                }`}
              >
                {option === "separators" ? "comma values" : option}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-1.5 text-[11px] text-slate-400">
            Rows
            <select
              value={limit}
              onChange={(event) => setLimit(Number(event.target.value))}
              className="rounded-md border border-slate-600 bg-slate-900 px-2 py-1 text-slate-200"
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={exportJson}
            disabled={!result || result.rows.length === 0}
            className="rounded-md border border-slate-600 px-2.5 py-1 text-[11px] font-medium text-slate-300 transition hover:border-accent hover:text-accent disabled:opacity-40"
          >
            Export page as JSON
          </button>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setOffset(Math.max(0, offset - limit))}
              disabled={offset === 0 || loading}
              className="rounded-md border border-slate-600 px-2 py-1 text-[11px] text-slate-300 transition hover:border-accent hover:text-accent disabled:opacity-30"
            >
              Prev
            </button>
            <span className="text-[11px] text-slate-400">
              Page {formatNumber(page)} / {formatNumber(pages)}
            </span>
            <button
              type="button"
              onClick={() => setOffset(offset + limit)}
              disabled={!result || offset + limit >= result.total || loading}
              className="rounded-md border border-slate-600 px-2 py-1 text-[11px] text-slate-300 transition hover:border-accent hover:text-accent disabled:opacity-30"
            >
              Next
            </button>
          </div>
        </div>

        {result && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-slate-700 px-4 py-2 text-[11px] text-slate-400">
            <span>
              <span className="font-semibold text-slate-200">
                {formatNumber(result.total)}
              </span>{" "}
              rows shown of {formatNumber(result.scanned)} in file
            </span>
            {debounced && (
              <span>
                search matched{" "}
                <span className="font-semibold text-slate-200">
                  {formatNumber(result.matched)}
                </span>
              </span>
            )}
            <span className="text-slate-600">·</span>
            {Object.entries(result.flagCounts).length === 0 ? (
              <span className="text-emerald-400">no anomalies detected</span>
            ) : (
              Object.entries(result.flagCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([flag, count]) => (
                  <span
                    key={flag}
                    className={`rounded border px-1.5 py-0.5 ${
                      FLAG_TONE[flag] ?? "border-slate-600 text-slate-300"
                    }`}
                  >
                    {FLAG_LABELS[flag] ?? flag}: {formatNumber(count)}
                  </span>
                ))
            )}
            <span className="ml-auto text-slate-600">parsed in {result.elapsedMs}ms</span>
          </div>
        )}

        {error && (
          <p className="m-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
            {error}
          </p>
        )}

        <div className="min-h-0 flex-1 overflow-auto">
          {result && (
            <table className="w-full border-collapse text-left font-mono text-[11px]">
              <thead className="sticky top-0 z-10">
                <tr>
                  <th
                    rowSpan={2}
                    className="sticky left-0 z-20 border-b border-r border-slate-700 bg-slate-900 px-2 py-1.5 text-right font-sans text-[10px] font-medium text-slate-500"
                  >
                    line
                  </th>
                  <th
                    colSpan={rawColumns.length}
                    className="border-b border-r border-slate-700 bg-slate-800 px-2 py-1 text-center font-sans text-[10px] font-semibold uppercase tracking-wide text-slate-400"
                  >
                    Raw CSV cells
                  </th>
                  <th
                    colSpan={derivedColumns.length}
                    className="border-b border-r border-slate-700 bg-accent/10 px-2 py-1 text-center font-sans text-[10px] font-semibold uppercase tracking-wide text-accent"
                  >
                    Normalised by the dashboard
                  </th>
                  <th
                    rowSpan={2}
                    className="border-b border-slate-700 bg-slate-900 px-2 py-1.5 font-sans text-[10px] font-medium text-slate-500"
                  >
                    flags
                  </th>
                </tr>
                <tr>
                  {rawColumns.map((column, index) => (
                    <th
                      key={column.key}
                      style={{ minWidth: column.width }}
                      className={`border-b border-slate-700 bg-slate-800/80 px-2 py-1.5 font-sans text-[10px] font-medium text-slate-400 ${
                        column.align === "right" ? "text-right" : ""
                      } ${index === rawColumns.length - 1 ? "border-r border-slate-700" : ""}`}
                    >
                      {column.label}
                    </th>
                  ))}
                  {derivedColumns.map((column, index) => (
                    <th
                      key={column.key}
                      style={{ minWidth: column.width }}
                      className={`border-b border-slate-700 bg-accent/[0.07] px-2 py-1.5 font-sans text-[10px] font-medium text-sky-300 ${
                        column.align === "right" ? "text-right" : ""
                      } ${
                        index === derivedColumns.length - 1
                          ? "border-r border-slate-700"
                          : ""
                      }`}
                    >
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row) => (
                  <tr key={`${row.line}`} className="hover:bg-slate-800/50">
                    <td className="sticky left-0 z-10 border-b border-r border-slate-700/60 bg-slate-900 px-2 py-1 text-right text-slate-600">
                      {row.line}
                    </td>
                    {rawColumns.map((column, index) => {
                      const value = row.cells[column.key] ?? "";
                      const flagged = value.includes(",") && column.align === "right";
                      return (
                        <td
                          key={column.key}
                          title={value}
                          className={`max-w-[16rem] truncate border-b border-slate-700/60 px-2 py-1 ${
                            column.align === "right" ? "text-right" : ""
                          } ${flagged ? "bg-sky-500/10 text-sky-300" : "text-slate-400"} ${
                            index === rawColumns.length - 1
                              ? "border-r border-slate-700/60"
                              : ""
                          }`}
                        >
                          {value === "" ? (
                            <span className="text-slate-700">empty</span>
                          ) : (
                            value
                          )}
                        </td>
                      );
                    })}
                    {derivedColumns.map((column, index) => {
                      const value = row.cells[column.key] ?? "";
                      return (
                        <td
                          key={column.key}
                          title={value}
                          className={`max-w-[16rem] truncate border-b border-slate-700/60 bg-accent/[0.04] px-2 py-1 ${
                            column.align === "right" ? "text-right" : ""
                          } ${value === "—" ? "text-slate-600" : "text-slate-200"} ${
                            index === derivedColumns.length - 1
                              ? "border-r border-slate-700/60"
                              : ""
                          }`}
                        >
                          {value}
                        </td>
                      );
                    })}
                    <td className="border-b border-slate-700/60 px-2 py-1">
                      <span className="flex flex-wrap gap-1">
                        {row.flags.map((flag) => (
                          <span
                            key={flag}
                            title={FLAG_LABELS[flag] ?? flag}
                            className={`rounded border px-1 py-0.5 font-sans text-[9px] ${
                              FLAG_TONE[flag] ?? "border-slate-600 text-slate-300"
                            }`}
                          >
                            {flag}
                          </span>
                        ))}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {loading && (
            <div className="flex items-center justify-center gap-2 py-10 text-xs text-slate-400">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-600 border-t-accent" />
              Reading source rows…
            </div>
          )}

          {result && !loading && result.rows.length === 0 && (
            <p className="py-10 text-center text-xs text-slate-500">
              No rows match the current search and filter.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
