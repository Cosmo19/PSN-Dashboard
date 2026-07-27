import type { DailyRow, DatasetPayload, VideoRow, VideoType } from "./types";

export type Filters = {
  accounts: string[];
  types: VideoType[];
  from: string;
  to: string;
};

export type Metrics = {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  watchMin: number;
};

const ZERO: Metrics = { views: 0, likes: 0, comments: 0, shares: 0, watchMin: 0 };

function addInto(target: Metrics, row: Metrics): void {
  target.views += row.views;
  target.likes += row.likes;
  target.comments += row.comments;
  target.shares += row.shares;
  target.watchMin += row.watchMin;
}

export function engagementRate(metrics: Metrics): number {
  if (metrics.views <= 0) return 0;
  return ((metrics.likes + metrics.comments + metrics.shares) / metrics.views) * 100;
}

/** Mean seconds watched per view, derived from watch minutes. */
export function avgViewSeconds(metrics: Metrics): number {
  if (metrics.views <= 0) return 0;
  return (metrics.watchMin * 60) / metrics.views;
}

export function retentionPercent(metrics: Metrics, lengthSec: number): number {
  if (lengthSec <= 0 || metrics.views <= 0) return 0;
  return (avgViewSeconds(metrics) / lengthSec) * 100;
}

export function filterDaily(daily: DailyRow[], filters: Filters): DailyRow[] {
  const accounts = new Set(filters.accounts);
  const types = new Set<string>(filters.types);

  return daily.filter(
    (row) =>
      accounts.has(row.account) &&
      types.has(row.type) &&
      row.date >= filters.from &&
      row.date <= filters.to
  );
}

export function filterVideos(videos: VideoRow[], filters: Filters): VideoRow[] {
  const accounts = new Set(filters.accounts);
  const types = new Set<string>(filters.types);
  return videos.filter(
    (video) => accounts.has(video.account) && types.has(video.type)
  );
}

export function totalsOf(rows: Metrics[]): Metrics {
  const total = { ...ZERO };
  for (const row of rows) addInto(total, row);
  return total;
}

export type TrendPoint = Metrics & { date: string };

export function buildTrend(rows: DailyRow[]): TrendPoint[] {
  const index = new Map<string, TrendPoint>();

  for (const row of rows) {
    const point = index.get(row.date);
    if (point) addInto(point, row);
    else index.set(row.date, { date: row.date, ...pick(row) });
  }

  return Array.from(index.values()).sort((a, b) => a.date.localeCompare(b.date));
}

function pick(row: DailyRow): Metrics {
  return {
    views: row.views,
    likes: row.likes,
    comments: row.comments,
    shares: row.shares,
    watchMin: row.watchMin,
  };
}

export type GroupRollup = Metrics & {
  key: string;
  posts: number;
  lengthSecTotal: number;
};

function rollup(
  videos: VideoRow[],
  keyOf: (video: VideoRow) => string
): GroupRollup[] {
  const index = new Map<string, GroupRollup>();

  for (const video of videos) {
    const key = keyOf(video);
    let group = index.get(key);
    if (!group) {
      group = { key, posts: 0, lengthSecTotal: 0, ...ZERO };
      index.set(key, group);
    }
    group.posts += 1;
    group.lengthSecTotal += video.lengthSec;
    addInto(group, video);
  }

  return Array.from(index.values());
}

export function rollupByAccount(videos: VideoRow[]): GroupRollup[] {
  return rollup(videos, (video) => video.account).sort((a, b) => b.views - a.views);
}

export function rollupByType(videos: VideoRow[]): GroupRollup[] {
  return rollup(videos, (video) => video.type).sort((a, b) => b.views - a.views);
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export type WeekdayRollup = {
  key: string;
  posts: number;
  views: number;
  avgViews: number;
};

export function rollupByWeekday(videos: VideoRow[]): WeekdayRollup[] {
  const buckets = WEEKDAYS.map((key) => ({ key, posts: 0, views: 0, avgViews: 0 }));

  for (const video of videos) {
    if (!video.published) continue;
    const date = new Date(`${video.published}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) continue;

    const bucket = buckets[date.getUTCDay()];
    bucket.posts += 1;
    bucket.views += video.views;
  }

  for (const bucket of buckets) {
    bucket.avgViews = bucket.posts > 0 ? bucket.views / bucket.posts : 0;
  }

  // Present the week Monday-first.
  return [...buckets.slice(1), buckets[0]];
}

export type LengthBucket = {
  key: string;
  posts: number;
  avgViews: number;
  retention: number;
};

const LENGTH_BUCKETS: { key: string; max: number }[] = [
  { key: "0-30s", max: 30 },
  { key: "30-60s", max: 60 },
  { key: "1-3m", max: 180 },
  { key: "3-8m", max: 480 },
  { key: "8-15m", max: 900 },
  { key: "15-30m", max: 1800 },
  { key: "30m+", max: Number.POSITIVE_INFINITY },
];

export function rollupByLength(videos: VideoRow[]): LengthBucket[] {
  const buckets = LENGTH_BUCKETS.map((bucket) => ({
    key: bucket.key,
    max: bucket.max,
    posts: 0,
    views: 0,
    watchMin: 0,
    lengthWeighted: 0,
  }));

  for (const video of videos) {
    if (video.lengthSec <= 0) continue;
    const bucket = buckets.find((candidate) => video.lengthSec <= candidate.max);
    if (!bucket) continue;

    bucket.posts += 1;
    bucket.views += video.views;
    bucket.watchMin += video.watchMin;
    bucket.lengthWeighted += video.lengthSec * video.views;
  }

  return buckets
    .filter((bucket) => bucket.posts > 0)
    .map((bucket) => {
      const avgLength = bucket.views > 0 ? bucket.lengthWeighted / bucket.views : 0;
      const avgSeconds = bucket.views > 0 ? (bucket.watchMin * 60) / bucket.views : 0;
      return {
        key: bucket.key,
        posts: bucket.posts,
        avgViews: bucket.posts > 0 ? bucket.views / bucket.posts : 0,
        retention: avgLength > 0 ? (avgSeconds / avgLength) * 100 : 0,
      };
    });
}

/** Share of total views held by the top `fraction` of videos. */
export function concentration(videos: VideoRow[], fraction: number): number {
  if (videos.length === 0) return 0;

  const sorted = [...videos].sort((a, b) => b.views - a.views);
  let total = 0;
  for (const video of sorted) total += video.views;
  if (total <= 0) return 0;

  const take = Math.max(1, Math.round(sorted.length * fraction));
  let top = 0;
  for (let i = 0; i < take; i += 1) top += sorted[i].views;

  return (top / total) * 100;
}

export function topVideos(videos: VideoRow[], limit: number): VideoRow[] {
  return [...videos].sort((a, b) => b.views - a.views).slice(0, limit);
}

export type Derived = {
  totals: Metrics;
  trend: TrendPoint[];
  accounts: GroupRollup[];
  types: GroupRollup[];
  weekdays: WeekdayRollup[];
  lengths: LengthBucket[];
  videos: VideoRow[];
  activeDays: number;
};

export function derive(payload: DatasetPayload, filters: Filters): Derived {
  const dailyRows = filterDaily(payload.daily, filters);
  const videos = filterVideos(payload.videos, filters);
  const trend = buildTrend(dailyRows);

  return {
    totals: totalsOf(dailyRows),
    trend,
    accounts: rollupByAccount(videos),
    types: rollupByType(videos),
    weekdays: rollupByWeekday(videos),
    lengths: rollupByLength(videos),
    videos,
    activeDays: trend.length,
  };
}
