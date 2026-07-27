"use client";

import type { Insight } from "@/lib/insights";

const TONE_STYLES: Record<Insight["tone"], string> = {
  neutral: "border-slate-700 bg-slate-800/50",
  positive: "border-emerald-500/30 bg-emerald-500/[0.07]",
  warning: "border-amber-500/30 bg-amber-500/[0.07]",
};

const TONE_DOT: Record<Insight["tone"], string> = {
  neutral: "bg-slate-400",
  positive: "bg-emerald-400",
  warning: "bg-amber-400",
};

export default function InsightsPanel({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) {
    return (
      <p className="rounded-xl border border-slate-700 bg-slate-800/40 p-4 text-sm text-slate-400">
        Not enough data in the current selection to draw conclusions.
      </p>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {insights.map((insight) => (
        <article
          key={insight.title}
          className={`rounded-xl border p-4 ${TONE_STYLES[insight.tone]}`}
        >
          <h3 className="flex items-start gap-2 text-sm font-semibold text-slate-100">
            <span
              className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${TONE_DOT[insight.tone]}`}
            />
            {insight.title}
          </h3>
          <p className="mt-1.5 pl-3.5 text-[13px] leading-relaxed text-slate-400">
            {insight.detail}
          </p>
        </article>
      ))}
    </div>
  );
}
