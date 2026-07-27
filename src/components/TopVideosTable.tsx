"use client";

import { useState } from "react";
import {
  avgViewSeconds,
  engagementRate,
  retentionPercent,
} from "@/lib/analytics";
import {
  formatCompact,
  formatDate,
  formatDuration,
  formatPercent,
} from "@/lib/format";
import type { VideoRow } from "@/lib/types";

type SortKey = "views" | "engagement" | "retention" | "watch" | "published";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "views", label: "Views" },
  { key: "watch", label: "Watch hours" },
  { key: "engagement", label: "Engagement" },
  { key: "retention", label: "Retention" },
  { key: "published", label: "Newest" },
];

function sortValue(video: VideoRow, key: SortKey): number {
  switch (key) {
    case "views":
      return video.views;
    case "watch":
      return video.watchMin;
    case "engagement":
      return engagementRate(video);
    case "retention":
      return retentionPercent(video, video.lengthSec);
    case "published":
      return video.published ? Date.parse(video.published) : 0;
  }
}

export default function TopVideosTable({
  videos,
  onSelect,
  limit = 25,
}: {
  videos: VideoRow[];
  onSelect: (id: string) => void;
  limit?: number;
}) {
  const [sort, setSort] = useState<SortKey>("views");

  // Ranking by rate needs a volume floor, otherwise a 3-view post tops the table.
  const eligible =
    sort === "engagement" || sort === "retention"
      ? videos.filter((video) => video.views >= 1000)
      : videos;

  const rows = [...eligible]
    .sort((a, b) => sortValue(b, sort) - sortValue(a, sort))
    .slice(0, limit);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-700 bg-slate-800/50">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700 px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">Top posts</h3>
          <p className="text-[11px] text-slate-500">
            Lifetime totals · showing {rows.length} of {videos.length} posts
            {(sort === "engagement" || sort === "retention") && " · min 1,000 views"}
          </p>
        </div>

        <div className="flex flex-wrap gap-1">
          {SORTS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setSort(option.key)}
              className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                sort === option.key
                  ? "bg-accent text-slate-900"
                  : "border border-slate-600 text-slate-400 hover:text-slate-200"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-h-[30rem] overflow-y-auto">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur">
            <tr className="text-[11px] uppercase tracking-wide text-slate-500">
              <th className="px-4 py-2 font-medium">Post</th>
              <th className="px-3 py-2 text-right font-medium">Views</th>
              <th className="px-3 py-2 text-right font-medium">Watch hrs</th>
              <th className="px-3 py-2 text-right font-medium">Eng.</th>
              <th className="px-3 py-2 text-right font-medium">Avg view</th>
              <th className="px-3 py-2 text-right font-medium">Retention</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((video) => {
              const retention = retentionPercent(video, video.lengthSec);

              return (
                <tr
                  key={video.id}
                  onClick={() => onSelect(video.id)}
                  className="cursor-pointer border-t border-slate-700/60 transition hover:bg-slate-700/30"
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      {video.thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={video.thumb}
                          alt=""
                          loading="lazy"
                          className="h-9 w-16 shrink-0 rounded object-cover"
                        />
                      ) : (
                        <div className="h-9 w-16 shrink-0 rounded bg-slate-700" />
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium text-slate-200">
                          {video.title}
                        </p>
                        <p className="truncate text-[11px] text-slate-500">
                          {video.account} · {video.type} ·{" "}
                          {formatDuration(video.lengthSec)} ·{" "}
                          {video.published ? formatDate(video.published) : "unknown date"}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right font-medium text-slate-200">
                    {formatCompact(video.views)}
                  </td>
                  <td className="px-3 py-2.5 text-right text-slate-400">
                    {formatCompact(video.watchMin / 60)}
                  </td>
                  <td className="px-3 py-2.5 text-right text-slate-400">
                    {formatPercent(engagementRate(video), 2)}
                  </td>
                  <td className="px-3 py-2.5 text-right text-slate-400">
                    {formatDuration(avgViewSeconds(video))}
                  </td>
                  <td
                    className={`px-3 py-2.5 text-right font-medium ${
                      retention >= 100
                        ? "text-emerald-400"
                        : retention >= 50
                          ? "text-slate-300"
                          : "text-slate-500"
                    }`}
                  >
                    {video.lengthSec > 0 ? formatPercent(retention, 0) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
