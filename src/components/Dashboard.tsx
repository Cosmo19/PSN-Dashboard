"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  avgViewSeconds,
  derive,
  engagementRate,
  retentionPercent,
  type Filters,
} from "@/lib/analytics";
import {
  formatCompact,
  formatDuration,
  formatNumber,
  formatPercent,
} from "@/lib/format";
import { buildInsights } from "@/lib/insights";
import type { DatasetPayload } from "@/lib/types";
import BubbleChart from "./charts/BubbleChart";
import ColumnChart from "./charts/ColumnChart";
import DonutChart from "./charts/DonutChart";
import RankedBars from "./charts/RankedBars";
import ScatterChart, { type ScatterPoint } from "./charts/ScatterChart";
import TrendChart from "./charts/TrendChart";
import DatasetPanel from "./DatasetPanel";
import FiltersBar from "./FiltersBar";
import InsightsPanel from "./InsightsPanel";
import KpiGrid, { type Kpi } from "./KpiGrid";
import TopVideosTable from "./TopVideosTable";
import VideoDrawer from "./VideoDrawer";

const TYPE_COLORS: Record<string, string> = {
  Shorts: "#38bdf8",
  "Long Form": "#f472b6",
};

function defaultFilters(payload: DatasetPayload): Filters {
  return {
    accounts: [...payload.meta.accounts],
    types: [...payload.meta.types],
    from: payload.meta.minDate,
    to: payload.meta.maxDate,
  };
}

export default function Dashboard() {
  const [payload, setPayload] = useState<DatasetPayload | null>(null);
  const [filters, setFilters] = useState<Filters | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const adopt = useCallback((next: DatasetPayload) => {
    setPayload(next);
    setFilters(defaultFilters(next));
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/dataset")
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "Failed to load dataset.");
        return body as DatasetPayload;
      })
      .then((data) => {
        if (!cancelled) adopt(data);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : "Unknown error");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [adopt]);

  const handleUpload = useCallback(
    async (posts: File, poststats: File) => {
      setBusy(true);
      setUploadError(null);

      try {
        const form = new FormData();
        form.append("posts", posts);
        form.append("poststats", poststats);

        const response = await fetch("/api/dataset", { method: "POST", body: form });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "Upload failed.");

        adopt(body as DatasetPayload);
      } catch (error) {
        setUploadError(error instanceof Error ? error.message : "Upload failed.");
      } finally {
        setBusy(false);
      }
    },
    [adopt]
  );

  const handleReset = useCallback(async () => {
    setBusy(true);
    setUploadError(null);
    try {
      const response = await fetch("/api/dataset", { method: "DELETE" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Reset failed.");
      adopt(body as DatasetPayload);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Reset failed.");
    } finally {
      setBusy(false);
    }
  }, [adopt]);

  const derived = useMemo(
    () => (payload && filters ? derive(payload, filters) : null),
    [payload, filters]
  );

  const insights = useMemo(
    () => (derived ? buildInsights(derived) : []),
    [derived]
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-accent" />
          <p className="mt-3 text-sm text-slate-400">Parsing posts and poststats…</p>
        </div>
      </div>
    );
  }

  if (loadError || !payload || !filters || !derived) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md rounded-xl border border-red-500/30 bg-red-500/10 p-5 text-center">
          <h1 className="text-base font-semibold text-red-200">
            Could not load the dataset
          </h1>
          <p className="mt-2 text-sm text-red-300/80">{loadError}</p>
          <p className="mt-3 text-xs text-slate-400">
            Confirm that <code>public/posts.csv</code> and{" "}
            <code>public/poststats.csv</code> exist in the container.
          </p>
        </div>
      </div>
    );
  }

  const { totals, trend, accounts, types, weekdays, lengths, videos } = derived;
  const watchHours = totals.watchMin / 60;
  const shorts = types.find((group) => group.key === "Shorts");
  const longForm = types.find((group) => group.key === "Long Form");

  const kpis: Kpi[] = [
    {
      label: "Views",
      value: formatCompact(totals.views),
      hint: `${formatCompact(totals.views / Math.max(1, trend.length))} per day`,
    },
    {
      label: "Watch time",
      value: `${formatCompact(watchHours)} h`,
      hint: `${formatCompact(watchHours / 24)} days of viewing`,
    },
    {
      label: "Engagement rate",
      value: formatPercent(engagementRate(totals), 2),
      hint: `${formatCompact(totals.likes + totals.comments + totals.shares)} interactions`,
    },
    {
      label: "Avg view duration",
      value: formatDuration(avgViewSeconds(totals)),
      hint: "Watch time ÷ views",
    },
    {
      label: "Posts",
      value: formatNumber(videos.length),
      hint: `${accounts.length} channel${accounts.length === 1 ? "" : "s"} selected`,
    },
    {
      label: "Days covered",
      value: formatNumber(trend.length),
      hint: `${formatCompact(totals.likes)} likes · ${formatCompact(totals.comments)} comments`,
    },
  ];

  const scatterPoints: ScatterPoint[] = videos
    .filter((video) => video.lengthSec > 0 && video.views > 0)
    .map((video) => ({
      id: video.id,
      x: video.lengthSec,
      y: Math.min(200, retentionPercent(video, video.lengthSec)),
      group: video.type,
      title: video.title,
      tooltip: [
        { label: "Channel", value: video.account },
        { label: "Length", value: formatDuration(video.lengthSec) },
        { label: "Views", value: formatCompact(video.views) },
        {
          label: "Retention",
          value: formatPercent(retentionPercent(video, video.lengthSec), 0),
        },
        { label: "Avg view", value: formatDuration(avgViewSeconds(video)) },
      ],
    }));

  const engagementPoints: ScatterPoint[] = videos
    .filter((video) => video.views > 0)
    .map((video) => ({
      id: video.id,
      x: video.views,
      y: Math.min(25, engagementRate(video)),
      group: video.type,
      title: video.title,
      tooltip: [
        { label: "Channel", value: video.account },
        { label: "Views", value: formatCompact(video.views) },
        { label: "Engagement", value: formatPercent(engagementRate(video), 2) },
        { label: "Likes", value: formatCompact(video.likes) },
        { label: "Comments", value: formatCompact(video.comments) },
      ],
    }));

  return (
    <main className="min-h-screen pb-16">
      <header className="border-b border-slate-700 bg-slate-900/80 backdrop-blur">
        <div className="mx-auto max-w-[100rem] px-6 py-5">
          <h1 className="text-2xl font-bold tracking-tight text-white">
            PSN Content Performance Dashboard
          </h1>
        </div>
      </header>

      <div className="mx-auto max-w-[100rem] space-y-6 px-6 py-6">
        <DatasetPanel
          meta={payload.meta}
          busy={busy}
          error={uploadError}
          onUpload={handleUpload}
          onReset={handleReset}
        />

        <FiltersBar meta={payload.meta} filters={filters} onChange={setFilters} />

        <section>
          <KpiGrid items={kpis} />
        </section>

        <section>
          <h2 className="mb-1 text-lg font-semibold text-slate-100">
            What the data says
          </h2>
          <p className="mb-3 text-xs text-slate-500">
            Generated from the current selection, recomputed whenever filters change.
          </p>
          <InsightsPanel insights={insights} />
        </section>

        <section>
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <h2 className="text-lg font-semibold text-slate-100">
              Channel share of views
            </h2>
            <p className="text-xs text-slate-500">
              Bubble area is proportional to total views · hover for channel details
            </p>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-4">
            <BubbleChart
              data={accounts.map((account) => ({
                key: account.key,
                value: account.views,
                tooltip: [
                  { label: "Views", value: formatNumber(account.views) },
                  { label: "Posts", value: formatNumber(account.posts) },
                  {
                    label: "Avg views",
                    value: formatCompact(account.views / account.posts),
                  },
                  {
                    label: "Engagement",
                    value: formatPercent(engagementRate(account), 2),
                  },
                  {
                    label: "Watch hours",
                    value: formatCompact(account.watchMin / 60),
                  },
                ],
              }))}
              formatValue={formatCompact}
            />
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <h2 className="text-lg font-semibold text-slate-100">
              Daily views and watch time
            </h2>
            <p className="text-xs text-slate-500">
              Values are per-day deltas, not cumulative totals
            </p>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-4">
            <TrendChart data={trend} height={320} />
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-4">
            <h3 className="mb-1 text-sm font-semibold text-slate-100">
              Views by format
            </h3>
            <p className="mb-4 text-[11px] text-slate-500">Lifetime totals</p>
            <DonutChart
              data={types.map((group) => ({
                key: group.key,
                value: group.views,
                color: TYPE_COLORS[group.key] ?? "#94a3b8",
              }))}
              centerLabel="views"
              centerValue={formatCompact(types.reduce((sum, g) => sum + g.views, 0))}
              formatValue={formatCompact}
            />
          </div>

          <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-4">
            <h3 className="mb-1 text-sm font-semibold text-slate-100">
              Watch time by format
            </h3>
            <p className="mb-4 text-[11px] text-slate-500">Hours watched</p>
            <DonutChart
              data={types.map((group) => ({
                key: group.key,
                value: group.watchMin / 60,
                color: TYPE_COLORS[group.key] ?? "#94a3b8",
              }))}
              centerLabel="hours"
              centerValue={formatCompact(
                types.reduce((sum, group) => sum + group.watchMin / 60, 0)
              )}
              formatValue={formatCompact}
            />
          </div>

          <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-100">
              Format comparison
            </h3>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wide text-slate-500">
                  <th className="pb-2 font-medium">Metric</th>
                  <th className="pb-2 text-right font-medium">Shorts</th>
                  <th className="pb-2 text-right font-medium">Long Form</th>
                </tr>
              </thead>
              <tbody className="text-slate-300">
                {[
                  {
                    label: "Posts",
                    a: shorts ? formatNumber(shorts.posts) : "—",
                    b: longForm ? formatNumber(longForm.posts) : "—",
                  },
                  {
                    label: "Avg views",
                    a: shorts ? formatCompact(shorts.views / shorts.posts) : "—",
                    b: longForm ? formatCompact(longForm.views / longForm.posts) : "—",
                  },
                  {
                    label: "Engagement",
                    a: shorts ? formatPercent(engagementRate(shorts), 2) : "—",
                    b: longForm ? formatPercent(engagementRate(longForm), 2) : "—",
                  },
                  {
                    label: "Avg view time",
                    a: shorts ? formatDuration(avgViewSeconds(shorts)) : "—",
                    b: longForm ? formatDuration(avgViewSeconds(longForm)) : "—",
                  },
                  {
                    label: "Avg length",
                    a: shorts
                      ? formatDuration(shorts.lengthSecTotal / shorts.posts)
                      : "—",
                    b: longForm
                      ? formatDuration(longForm.lengthSecTotal / longForm.posts)
                      : "—",
                  },
                  {
                    label: "Watch hours",
                    a: shorts ? formatCompact(shorts.watchMin / 60) : "—",
                    b: longForm ? formatCompact(longForm.watchMin / 60) : "—",
                  },
                ].map((row) => (
                  <tr key={row.label} className="border-t border-slate-700/60">
                    <td className="py-1.5 text-slate-400">{row.label}</td>
                    <td className="py-1.5 text-right font-medium text-sky-300">{row.a}</td>
                    <td className="py-1.5 text-right font-medium text-pink-300">{row.b}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-4">
            <h3 className="mb-1 text-sm font-semibold text-slate-100">
              Channel leaderboard
            </h3>
            <p className="mb-4 text-[11px] text-slate-500">Lifetime views per channel</p>
            <RankedBars
              data={accounts.map((account) => ({
                key: account.key,
                value: account.views,
                tooltip: [
                  { label: "Posts", value: formatNumber(account.posts) },
                  { label: "Views", value: formatNumber(account.views) },
                  {
                    label: "Avg views",
                    value: formatCompact(account.views / account.posts),
                  },
                  {
                    label: "Engagement",
                    value: formatPercent(engagementRate(account), 2),
                  },
                  {
                    label: "Watch hours",
                    value: formatCompact(account.watchMin / 60),
                  },
                ],
              }))}
              formatValue={formatCompact}
            />
          </div>

          <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-4">
            <h3 className="mb-1 text-sm font-semibold text-slate-100">
              Average views per post
            </h3>
            <p className="mb-4 text-[11px] text-slate-500">
              Reach efficiency, independent of publishing volume
            </p>
            <RankedBars
              barColor="#34d399"
              data={[...accounts]
                .sort((a, b) => b.views / b.posts - a.views / a.posts)
                .map((account) => ({
                  key: account.key,
                  value: account.views / account.posts,
                  tooltip: [
                    { label: "Posts", value: formatNumber(account.posts) },
                    {
                      label: "Avg views",
                      value: formatNumber(account.views / account.posts),
                    },
                    { label: "Total views", value: formatCompact(account.views) },
                  ],
                }))}
              formatValue={formatCompact}
            />
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-4">
            <h3 className="mb-1 text-sm font-semibold text-slate-100">
              Retention falls as length grows
            </h3>
            <p className="mb-4 text-[11px] text-slate-500">
              Each point is a post · click to open details · retention capped at 200%
            </p>
            <ScatterChart
              data={scatterPoints}
              xLabel="Video length (log scale)"
              yLabel="Retention (%)"
              formatX={(value) => formatDuration(value)}
              formatY={(value) => `${value}%`}
              colors={TYPE_COLORS}
              logX
              xTicks={[10, 30, 60, 120, 300, 600, 1800, 3600, 7200, 10800]}
              onSelect={setSelected}
            />
          </div>

          <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-4">
            <h3 className="mb-1 text-sm font-semibold text-slate-100">
              Engagement versus reach
            </h3>
            <p className="mb-4 text-[11px] text-slate-500">
              High-reach posts regress toward the mean · engagement capped at 25%
            </p>
            <ScatterChart
              data={engagementPoints}
              xLabel="Views (log scale)"
              yLabel="Engagement rate (%)"
              formatX={formatCompact}
              formatY={(value) => `${value}%`}
              colors={TYPE_COLORS}
              logX
              xTicks={[10, 100, 1000, 10000, 100000, 1000000, 10000000]}
              onSelect={setSelected}
            />
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-4">
            <h3 className="mb-1 text-sm font-semibold text-slate-100">
              Performance by length band
            </h3>
            <p className="mb-4 text-[11px] text-slate-500">
              Average views per post against retention
            </p>
            <ColumnChart
              data={lengths.map((bucket) => ({
                key: bucket.key,
                value: bucket.avgViews,
                secondary: bucket.retention,
                tooltip: [
                  { label: "Posts", value: formatNumber(bucket.posts) },
                  { label: "Avg views", value: formatCompact(bucket.avgViews) },
                  { label: "Retention", value: formatPercent(bucket.retention, 0) },
                ],
              }))}
              formatValue={formatCompact}
              primaryLabel="Avg views"
              secondaryLabel="Retention %"
              formatSecondary={(value) => `${Math.round(value)}%`}
            />
          </div>

          <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-4">
            <h3 className="mb-1 text-sm font-semibold text-slate-100">
              Publishing day versus outcome
            </h3>
            <p className="mb-4 text-[11px] text-slate-500">
              Average lifetime views by day of week published
            </p>
            <ColumnChart
              data={weekdays.map((day) => ({
                key: day.key,
                value: day.avgViews,
                secondary: day.posts,
                tooltip: [
                  { label: "Posts", value: formatNumber(day.posts) },
                  { label: "Avg views", value: formatCompact(day.avgViews) },
                  { label: "Total views", value: formatCompact(day.views) },
                ],
              }))}
              formatValue={formatCompact}
              primaryLabel="Avg views"
              secondaryLabel="Posts published"
              formatSecondary={(value) => formatNumber(value)}
            />
          </div>
        </section>

        <TopVideosTable videos={videos} onSelect={setSelected} />
      </div>

      <VideoDrawer videoId={selected} onClose={() => setSelected(null)} />
    </main>
  );
}
