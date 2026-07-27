import Papa from "papaparse";
import { formatDuration } from "./format";
import type {
  InspectColumn,
  InspectOptions,
  InspectResult,
  InspectRow,
  RowFilter,
} from "./inspectTypes";
import { normaliseHeader, parseNumber, toIsoDate } from "./parse";
import type { VideoRow } from "./types";

const POSTS_COLUMNS: InspectColumn[] = [
  { key: "video_id", label: "video_id", group: "raw", width: "7rem" },
  { key: "account_name", label: "account_name", group: "raw", width: "9rem" },
  { key: "video_type", label: "video_type", group: "raw", width: "6rem" },
  { key: "published_at_date", label: "published_at_date", group: "raw", width: "8rem" },
  { key: "video_length", label: "video_length", group: "raw", align: "right", width: "6rem" },
  { key: "title", label: "title", group: "raw", width: "16rem" },
  { key: "text_preview", label: "text", group: "raw", width: "14rem" },
  { key: "d_type", label: "type", group: "derived", width: "6rem" },
  { key: "d_published", label: "published (ISO)", group: "derived", width: "7rem" },
  { key: "d_lengthSec", label: "lengthSec", group: "derived", align: "right", width: "5rem" },
  { key: "d_lengthLabel", label: "duration", group: "derived", align: "right", width: "5rem" },
  { key: "d_views", label: "joined views", group: "derived", align: "right", width: "6rem" },
  { key: "d_watchMin", label: "joined watchMin", group: "derived", align: "right", width: "7rem" },
  { key: "d_activeDays", label: "stat rows", group: "derived", align: "right", width: "5rem" },
];

const STATS_COLUMNS: InspectColumn[] = [
  { key: "video_id", label: "video_id", group: "raw", width: "7rem" },
  { key: "data_date", label: "data_date", group: "raw", width: "7rem" },
  { key: "views", label: "views", group: "raw", align: "right", width: "6rem" },
  { key: "likes", label: "likes", group: "raw", align: "right", width: "5rem" },
  { key: "comments", label: "comments", group: "raw", align: "right", width: "5rem" },
  { key: "shares", label: "shares", group: "raw", align: "right", width: "5rem" },
  { key: "watchtime", label: "watchtime", group: "raw", align: "right", width: "6rem" },
  { key: "d_date", label: "date (ISO)", group: "derived", width: "7rem" },
  { key: "d_views", label: "views", group: "derived", align: "right", width: "6rem" },
  { key: "d_likes", label: "likes", group: "derived", align: "right", width: "5rem" },
  { key: "d_comments", label: "comments", group: "derived", align: "right", width: "5rem" },
  { key: "d_shares", label: "shares", group: "derived", align: "right", width: "5rem" },
  { key: "d_watchMin", label: "watchtime (min)", group: "derived", align: "right", width: "7rem" },
];

const STAT_METRICS = ["views", "likes", "comments", "shares", "watchtime"] as const;

type RawRow = Record<string, string | undefined>;

function parseCsv(text: string): RawRow[] {
  return Papa.parse<RawRow>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: normaliseHeader,
  }).data;
}

function preview(value: string | undefined, max = 90): string {
  if (!value) return "";
  const collapsed = value.replace(/\s*\n\s*/g, " ⏎ ").trim();
  return collapsed.length > max ? `${collapsed.slice(0, max)}…` : collapsed;
}

function cell(value: string | undefined): string {
  return value == null ? "" : String(value);
}

function matchesQuery(row: InspectRow, needle: string): boolean {
  if (needle === "") return true;
  for (const value of Object.values(row.cells)) {
    if (value.toLowerCase().includes(needle)) return true;
  }
  return false;
}

function passesFilter(row: InspectRow, filter: RowFilter): boolean {
  if (filter === "all") return true;
  if (filter === "flagged") return row.flags.length > 0;
  return row.flags.includes("separators");
}

/** Walks every row once so totals stay exact, but only retains the requested window. */
function collect(
  rows: InspectRow[],
  options: InspectOptions
): Pick<InspectResult, "rows" | "matched" | "total" | "flagCounts"> {
  const needle = options.query.trim().toLowerCase();
  const flagCounts: Record<string, number> = {};

  let matched = 0;
  let total = 0;
  const window: InspectRow[] = [];

  for (const row of rows) {
    if (!matchesQuery(row, needle)) continue;
    matched += 1;

    for (const flag of row.flags) {
      flagCounts[flag] = (flagCounts[flag] ?? 0) + 1;
    }

    if (!passesFilter(row, options.filter)) continue;

    if (total >= options.offset && window.length < options.limit) {
      window.push(row);
    }
    total += 1;
  }

  return { rows: window, matched, total, flagCounts };
}

export function inspectPosts(
  csv: string,
  videos: Map<string, VideoRow>,
  options: InspectOptions
): InspectResult {
  const started = Date.now();
  const raw = parseCsv(csv);
  const seen = new Set<string>();

  const rows: InspectRow[] = raw.map((row, index) => {
    const id = cell(row.video_id).trim();
    const rawDate = cell(row.published_at_date).trim();
    const iso = toIsoDate(rawDate);
    const lengthMs = parseNumber(row.video_length);
    const lengthSec = Math.round(lengthMs / 1000);
    const joined = videos.get(id);

    const flags: string[] = [];
    if (id === "") flags.push("no-video-id");
    else if (seen.has(id)) flags.push("duplicate-id");
    else seen.add(id);

    if (rawDate !== "" && iso === null) flags.push("bad-date");
    if (lengthSec === 0) flags.push("zero-length");
    if (id !== "" && (!joined || joined.activeDays === 0)) flags.push("no-stats");

    return {
      line: index + 2,
      flags,
      cells: {
        video_id: id,
        account_name: cell(row.account_name),
        video_type: cell(row.video_type),
        published_at_date: rawDate,
        video_length: cell(row.video_length),
        title: preview(row.title, 70),
        text_preview: preview(row.text, 70),
        d_type: joined?.type ?? "",
        d_published: iso ?? "—",
        d_lengthSec: String(lengthSec),
        d_lengthLabel: lengthSec > 0 ? formatDuration(lengthSec) : "—",
        d_views: joined ? String(joined.views) : "—",
        d_watchMin: joined ? String(joined.watchMin) : "—",
        d_activeDays: joined ? String(joined.activeDays) : "—",
      },
    };
  });

  return {
    table: "posts",
    columns: POSTS_COLUMNS,
    scanned: rows.length,
    offset: options.offset,
    limit: options.limit,
    elapsedMs: Date.now() - started,
    ...collect(rows, options),
  };
}

export function inspectStats(
  csv: string,
  knownIds: Set<string>,
  options: InspectOptions
): InspectResult {
  const started = Date.now();
  const raw = parseCsv(csv);

  const rows: InspectRow[] = raw.map((row, index) => {
    const id = cell(row.video_id).trim();
    const rawDate = cell(row.data_date).trim();
    const iso = toIsoDate(rawDate);

    const flags: string[] = [];
    if (id === "") flags.push("no-video-id");
    else if (!knownIds.has(id)) flags.push("orphan");
    if (rawDate === "" || iso === null) flags.push("bad-date");

    const parsed: Record<string, number> = {};
    let hasSeparator = false;
    let hasNegative = false;
    let hasNonNumeric = false;

    for (const metric of STAT_METRICS) {
      const rawValue = cell(row[metric]);
      const value = parseNumber(rawValue);
      parsed[metric] = value;

      if (rawValue.includes(",")) hasSeparator = true;
      if (value < 0) hasNegative = true;
      if (
        rawValue.trim() !== "" &&
        value === 0 &&
        !/^-?0*(\.0*)?$/.test(rawValue.replace(/[,\s]/g, ""))
      ) {
        hasNonNumeric = true;
      }
    }

    if (hasSeparator) flags.push("separators");
    if (hasNegative) flags.push("negative");
    if (hasNonNumeric) flags.push("non-numeric");

    return {
      line: index + 2,
      flags,
      cells: {
        video_id: id,
        data_date: rawDate,
        views: cell(row.views),
        likes: cell(row.likes),
        comments: cell(row.comments),
        shares: cell(row.shares),
        watchtime: cell(row.watchtime),
        d_date: iso ?? "—",
        d_views: String(parsed.views),
        d_likes: String(parsed.likes),
        d_comments: String(parsed.comments),
        d_shares: String(parsed.shares),
        d_watchMin: String(parsed.watchtime),
      },
    };
  });

  return {
    table: "poststats",
    columns: STATS_COLUMNS,
    scanned: rows.length,
    offset: options.offset,
    limit: options.limit,
    elapsedMs: Date.now() - started,
    ...collect(rows, options),
  };
}
