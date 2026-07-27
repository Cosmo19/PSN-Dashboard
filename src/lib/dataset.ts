import Papa from "papaparse";
import { normaliseHeader, parseNumber, toIsoDate } from "./parse";
import type {
  DailyRow,
  DatasetPayload,
  VideoDailyPoint,
  VideoRow,
  VideoType,
} from "./types";

export const POSTS_COLUMNS = [
  "post_id",
  "video_id",
  "account_name",
  "published_at_date",
  "video_url",
  "video_type",
  "title",
  "text",
  "video_length",
  "thumbnail_url",
] as const;

export const STATS_COLUMNS = [
  "video_id",
  "data_date",
  "likes",
  "comments",
  "shares",
  "views",
  "watchtime",
] as const;

export type BuiltDataset = {
  payload: DatasetPayload;
  videoDaily: Map<string, VideoDailyPoint[]>;
};

type RawRow = Record<string, string | undefined>;

function parseCsv(text: string): RawRow[] {
  const result = Papa.parse<RawRow>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: normaliseHeader,
  });
  return result.data;
}

export function validateHeaders(
  text: string,
  required: readonly string[]
): string[] {
  const firstLine = text.slice(0, text.indexOf("\n") === -1 ? undefined : text.indexOf("\n"));
  const headers = Papa.parse<string[]>(firstLine).data[0] ?? [];
  const present = new Set(headers.map(normaliseHeader));
  return required.filter((column) => !present.has(column));
}

function coerceType(value: string | undefined): VideoType {
  return String(value ?? "").trim().toLowerCase() === "shorts"
    ? "Shorts"
    : "Long Form";
}

export function buildDataset(
  postsCsv: string,
  statsCsv: string,
  source: "bundled" | "upload"
): BuiltDataset {
  const warnings: string[] = [];

  const postRows = parseCsv(postsCsv);
  const statRows = parseCsv(statsCsv);

  const videos = new Map<string, VideoRow>();
  let duplicatePosts = 0;

  for (const row of postRows) {
    const id = row.video_id?.trim();
    if (!id) continue;
    if (videos.has(id)) {
      duplicatePosts += 1;
      continue;
    }

    videos.set(id, {
      id,
      title: row.title?.trim() || "(untitled)",
      account: row.account_name?.trim() || "Unknown",
      type: coerceType(row.video_type),
      published: toIsoDate(row.published_at_date) ?? "",
      // video_length is exported in milliseconds.
      lengthSec: Math.round(parseNumber(row.video_length) / 1000),
      url: row.video_url?.trim() || "",
      thumb: row.thumbnail_url?.trim() || "",
      views: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      watchMin: 0,
      activeDays: 0,
    });
  }

  const dailyIndex = new Map<string, DailyRow>();
  const videoDaily = new Map<string, VideoDailyPoint[]>();

  let orphanStatRows = 0;
  let undatedStatRows = 0;

  for (const row of statRows) {
    const id = row.video_id?.trim();
    if (!id) continue;

    const date = toIsoDate(row.data_date);
    if (!date) {
      undatedStatRows += 1;
      continue;
    }

    const video = videos.get(id);
    if (!video) {
      orphanStatRows += 1;
      continue;
    }

    const views = parseNumber(row.views);
    const likes = parseNumber(row.likes);
    const comments = parseNumber(row.comments);
    const shares = parseNumber(row.shares);
    // watchtime is exported in minutes.
    const watchMin = parseNumber(row.watchtime);

    video.views += views;
    video.likes += likes;
    video.comments += comments;
    video.shares += shares;
    video.watchMin += watchMin;
    video.activeDays += 1;

    const key = `${date}|${video.account}|${video.type}`;
    const bucket = dailyIndex.get(key);
    if (bucket) {
      bucket.views += views;
      bucket.likes += likes;
      bucket.comments += comments;
      bucket.shares += shares;
      bucket.watchMin += watchMin;
    } else {
      dailyIndex.set(key, {
        date,
        account: video.account,
        type: video.type,
        views,
        likes,
        comments,
        shares,
        watchMin,
      });
    }

    const series = videoDaily.get(id);
    const point: VideoDailyPoint = { date, views, likes, comments, shares, watchMin };
    if (series) series.push(point);
    else videoDaily.set(id, [point]);
  }

  for (const series of videoDaily.values()) {
    series.sort((a, b) => a.date.localeCompare(b.date));
  }

  const daily = Array.from(dailyIndex.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  const videoList = Array.from(videos.values());
  const withoutStats = videoList.filter((video) => video.activeDays === 0).length;

  if (duplicatePosts > 0) {
    warnings.push(`${duplicatePosts} duplicate video_id rows in posts were ignored.`);
  }
  if (orphanStatRows > 0) {
    warnings.push(
      `${orphanStatRows.toLocaleString()} poststats rows reference a video_id absent from posts and were excluded.`
    );
  }
  if (undatedStatRows > 0) {
    warnings.push(`${undatedStatRows.toLocaleString()} poststats rows had an unparseable data_date.`);
  }
  if (withoutStats > 0) {
    warnings.push(`${withoutStats} posts have no matching poststats rows.`);
  }

  const dates = daily.map((row) => row.date);
  const accounts = Array.from(new Set(videoList.map((video) => video.account))).sort(
    (a, b) => a.localeCompare(b)
  );
  const types = Array.from(new Set(videoList.map((video) => video.type)));

  return {
    payload: {
      meta: {
        source,
        generatedAt: new Date().toISOString(),
        postCount: videoList.length,
        statRowCount: statRows.length,
        accounts,
        types: types.sort(),
        minDate: dates.length > 0 ? dates[0] : "",
        maxDate: dates.length > 0 ? dates[dates.length - 1] : "",
        warnings,
      },
      videos: videoList,
      daily,
    },
    videoDaily,
  };
}
