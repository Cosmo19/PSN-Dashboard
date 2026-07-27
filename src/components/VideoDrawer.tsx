"use client";

import { useEffect, useState } from "react";
import {
  avgViewSeconds,
  engagementRate,
  retentionPercent,
  type TrendPoint,
} from "@/lib/analytics";
import {
  formatCompact,
  formatDate,
  formatDuration,
  formatNumber,
  formatPercent,
} from "@/lib/format";
import type { VideoDailyPoint, VideoRow } from "@/lib/types";
import TrendChart from "./charts/TrendChart";

type Payload = { video: VideoRow; series: VideoDailyPoint[] };

export default function VideoDrawer({
  videoId,
  onClose,
}: {
  videoId: string | null;
  onClose: () => void;
}) {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!videoId) {
      setData(null);
      setError(null);
      return;
    }

    const controller = new AbortController();
    setData(null);
    setError(null);

    fetch(`/api/dataset/video/${encodeURIComponent(videoId)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load this post.");
        return (await response.json()) as Payload;
      })
      .then(setData)
      .catch((cause: unknown) => {
        if (cause instanceof Error && cause.name === "AbortError") return;
        setError(cause instanceof Error ? cause.message : "Unknown error");
      });

    return () => controller.abort();
  }, [videoId]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!videoId) return null;

  const trend: TrendPoint[] =
    data?.series.map((point) => ({
      date: point.date,
      views: point.views,
      likes: point.likes,
      comments: point.comments,
      shares: point.shares,
      watchMin: point.watchMin,
    })) ?? [];

  const peak = data?.series.reduce(
    (best, point) => (point.views > (best?.views ?? -1) ? point : best),
    null as VideoDailyPoint | null
  );

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <button
        type="button"
        aria-label="Close details"
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
      />

      <aside className="relative flex h-full w-full max-w-2xl flex-col overflow-y-auto border-l border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-700 p-5">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-accent">
              Post detail
            </p>
            <h2 className="mt-1 text-lg font-bold leading-snug text-white">
              {data?.video.title ?? "Loading…"}
            </h2>
            {data && (
              <p className="mt-1 text-xs text-slate-400">
                {data.video.account} · {data.video.type} ·{" "}
                {formatDuration(data.video.lengthSec)} ·{" "}
                {data.video.published ? formatDate(data.video.published) : "unknown date"}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md border border-slate-600 px-2.5 py-1 text-xs text-slate-300 transition hover:border-accent hover:text-accent"
          >
            Close
          </button>
        </div>

        {error && (
          <p className="m-5 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
            {error}
          </p>
        )}

        {data && (
          <div className="space-y-6 p-5">
            <div className="flex gap-4">
              {data.video.thumb && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={data.video.thumb}
                  alt=""
                  className="h-24 w-40 shrink-0 rounded-lg object-cover"
                />
              )}
              <dl className="grid flex-1 grid-cols-2 gap-x-4 gap-y-2 text-xs">
                <div>
                  <dt className="text-slate-500">Views</dt>
                  <dd className="text-base font-bold text-white">
                    {formatNumber(data.video.views)}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Watch hours</dt>
                  <dd className="text-base font-bold text-white">
                    {formatNumber(data.video.watchMin / 60)}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Engagement rate</dt>
                  <dd className="text-base font-bold text-white">
                    {formatPercent(engagementRate(data.video), 2)}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Avg view / retention</dt>
                  <dd className="text-base font-bold text-white">
                    {formatDuration(avgViewSeconds(data.video))}
                    <span className="ml-1 text-xs font-medium text-slate-400">
                      {data.video.lengthSec > 0
                        ? `(${formatPercent(retentionPercent(data.video, data.video.lengthSec), 0)})`
                        : ""}
                    </span>
                  </dd>
                </div>
              </dl>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                { label: "Likes", value: data.video.likes },
                { label: "Comments", value: data.video.comments },
                { label: "Shares", value: data.video.shares },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-lg border border-slate-700 bg-slate-800/60 py-2.5"
                >
                  <p className="text-[10px] uppercase tracking-wide text-slate-500">
                    {stat.label}
                  </p>
                  <p className="text-sm font-bold text-slate-100">
                    {formatNumber(stat.value)}
                  </p>
                </div>
              ))}
            </div>

            <section>
              <h3 className="mb-2 text-sm font-semibold text-slate-200">
                Daily performance
              </h3>
              <p className="mb-3 text-[11px] text-slate-500">
                {data.series.length} days of data
                {peak &&
                  ` · peaked at ${formatCompact(peak.views)} views on ${formatDate(peak.date)}`}
              </p>
              <TrendChart data={trend} height={240} />
            </section>

            {data.video.url && (
              <a
                href={data.video.url}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-accent transition hover:underline"
              >
                Open on YouTube
                <span aria-hidden>↗</span>
              </a>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
