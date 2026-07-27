import {
  avgViewSeconds,
  concentration,
  engagementRate,
  retentionPercent,
  type Derived,
} from "./analytics";
import { formatCompact, formatDuration, formatPercent } from "./format";

export type Insight = {
  title: string;
  detail: string;
  tone: "neutral" | "positive" | "warning";
};

function trendSlope(values: number[]): number {
  if (values.length < 4) return 0;

  const half = Math.floor(values.length / 2);
  let first = 0;
  let second = 0;
  for (let i = 0; i < half; i += 1) first += values[i];
  for (let i = values.length - half; i < values.length; i += 1) second += values[i];
  if (first <= 0) return 0;

  return ((second - first) / first) * 100;
}

export function buildInsights(derived: Derived): Insight[] {
  const insights: Insight[] = [];
  const { totals, types, accounts, videos, trend, lengths, weekdays } = derived;

  if (totals.views <= 0 || videos.length === 0) return insights;

  const shorts = types.find((group) => group.key === "Shorts");
  const longForm = types.find((group) => group.key === "Long Form");

  if (shorts && longForm) {
    const totalViews = shorts.views + longForm.views;
    const totalWatch = shorts.watchMin + longForm.watchMin;
    const lfViewShare = (longForm.views / totalViews) * 100;
    const lfWatchShare = (longForm.watchMin / totalWatch) * 100;

    insights.push({
      title: "Long Form owns watch time, Shorts split the views",
      detail:
        `Long Form takes ${formatPercent(lfViewShare, 0)} of views but ` +
        `${formatPercent(lfWatchShare, 0)} of watch time, because the average view lasts ` +
        `${formatDuration(avgViewSeconds(longForm))} versus ` +
        `${formatDuration(avgViewSeconds(shorts))} on Shorts.`,
      tone: "neutral",
    });

    const shortsEng = engagementRate(shorts);
    const lfEng = engagementRate(longForm);
    if (Math.abs(lfEng - shortsEng) > 0.2) {
      const leader = lfEng > shortsEng ? "Long Form" : "Shorts";
      insights.push({
        title: `${leader} converts attention into engagement better`,
        detail:
          `Engagement rate is ${formatPercent(Math.max(lfEng, shortsEng), 2)} on ${leader} ` +
          `against ${formatPercent(Math.min(lfEng, shortsEng), 2)} on the other format, ` +
          `a ${(Math.max(lfEng, shortsEng) / Math.max(0.001, Math.min(lfEng, shortsEng))).toFixed(1)}x gap.`,
        tone: "positive",
      });
    }
  }

  const top1 = concentration(videos, 0.01);
  const top10 = concentration(videos, 0.1);
  const best = videos.reduce((a, b) => (b.views > a.views ? b : a), videos[0]);
  const bestShare = (best.views / totals.views) * 100;

  insights.push({
    title: "Performance is extremely top-heavy",
    detail:
      `The top 1% of posts drive ${formatPercent(top1, 0)} of views and the top 10% drive ` +
      `${formatPercent(top10, 0)}. A single ${best.type} post, "${best.title.slice(0, 60)}", ` +
      `accounts for ${formatPercent(bestShare, 1)} of all views on its own (${formatCompact(best.views)}).`,
    tone: bestShare > 5 ? "warning" : "neutral",
  });

  if (accounts.length > 1) {
    const ranked = accounts.filter((account) => account.posts >= 5);
    if (ranked.length > 1) {
      const byAvg = [...ranked].sort((a, b) => b.views / b.posts - a.views / a.posts);
      const leader = byAvg[0];
      const laggard = byAvg[byAvg.length - 1];
      const topShare = (accounts[0].views / totals.views) * 100;

      insights.push({
        title: `${leader.key} is the most efficient channel per post`,
        detail:
          `${leader.key} averages ${formatCompact(leader.views / leader.posts)} views across ` +
          `${leader.posts} posts, roughly ${(
            leader.views / leader.posts / Math.max(1, laggard.views / laggard.posts)
          ).toFixed(1)}x ${laggard.key}. ` +
          `${accounts[0].key} alone contributes ${formatPercent(topShare, 0)} of total views.`,
        tone: "positive",
      });
    }
  }

  if (lengths.length > 2) {
    const shortest = lengths[0];
    const longest = lengths[lengths.length - 1];
    if (shortest.retention > 0 && longest.retention > 0) {
      insights.push({
        title: "Retention decays as videos get longer",
        detail:
          `${shortest.key} posts hold ${formatPercent(shortest.retention, 0)} of their runtime, ` +
          `falling to ${formatPercent(longest.retention, 0)} for ${longest.key} posts. ` +
          `Longer posts still win on absolute watch time per view.`,
        tone: "neutral",
      });
    }
  }

  const viewSlope = trendSlope(trend.map((point) => point.views));
  if (Math.abs(viewSlope) > 5 && trend.length >= 14) {
    const rising = viewSlope > 0;
    insights.push({
      title: rising ? "Daily views are trending up" : "Daily views are trending down",
      detail:
        `Comparing the two halves of the selected ${trend.length}-day window, daily views ` +
        `${rising ? "rose" : "fell"} ${formatPercent(Math.abs(viewSlope), 0)}. ` +
        `The library averages ${formatCompact(totals.views / trend.length)} views per day.`,
      tone: rising ? "positive" : "warning",
    });
  }

  const busiest = [...weekdays].sort((a, b) => b.avgViews - a.avgViews)[0];
  const quietest = [...weekdays]
    .filter((day) => day.posts > 0)
    .sort((a, b) => a.avgViews - b.avgViews)[0];
  if (busiest && quietest && busiest.key !== quietest.key && busiest.avgViews > 0) {
    insights.push({
      title: `${busiest.key} publications perform best`,
      detail:
        `Posts published on ${busiest.key} average ${formatCompact(busiest.avgViews)} views ` +
        `versus ${formatCompact(quietest.avgViews)} on ${quietest.key}. ` +
        `Publishing volume is ${busiest.posts} and ${quietest.posts} posts respectively.`,
      tone: "neutral",
    });
  }

  const zeroWatch = videos.filter(
    (video) => video.views > 1000 && video.watchMin === 0
  ).length;
  if (zeroWatch > 0) {
    insights.push({
      title: "Some high-view posts report no watch time",
      detail:
        `${zeroWatch} posts have over 1,000 views but zero recorded watch time, so retention ` +
        `figures exclude them. Treat this as a gap in the source export rather than real behaviour.`,
      tone: "warning",
    });
  }

  const overRetained = videos.filter(
    (video) =>
      video.lengthSec > 0 &&
      video.views > 500 &&
      retentionPercent(video, video.lengthSec) > 100
  ).length;
  if (overRetained > 0) {
    insights.push({
      title: "Replays push some posts past 100% retention",
      detail:
        `${overRetained} posts average more watch time per view than their own runtime, which ` +
        `indicates loops or replays — common on Shorts and a strong signal of rewatchability.`,
      tone: "positive",
    });
  }

  return insights;
}
