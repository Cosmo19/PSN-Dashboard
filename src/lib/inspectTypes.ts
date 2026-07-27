/**
 * Shared with the client, so this module must stay free of server-only imports.
 * The parsing implementation lives in inspect.ts.
 */

export type InspectTable = "posts" | "poststats";
export type ColumnGroup = "raw" | "derived";
export type RowFilter = "all" | "flagged" | "separators";

export type InspectColumn = {
  key: string;
  label: string;
  group: ColumnGroup;
  align?: "right";
  width?: string;
};

export type InspectRow = {
  line: number;
  flags: string[];
  cells: Record<string, string>;
};

export type InspectResult = {
  table: InspectTable;
  columns: InspectColumn[];
  rows: InspectRow[];
  /** Rows matching the search term, before the flag filter is applied. */
  matched: number;
  /** Rows returned after the flag filter. */
  total: number;
  scanned: number;
  offset: number;
  limit: number;
  flagCounts: Record<string, number>;
  elapsedMs: number;
};

export type InspectOptions = {
  offset: number;
  limit: number;
  query: string;
  filter: RowFilter;
};

export const ROW_FILTERS: RowFilter[] = ["all", "flagged", "separators"];

export const FLAG_LABELS: Record<string, string> = {
  separators: "Thousands separators",
  "bad-date": "Unparseable date",
  "non-numeric": "Non-numeric metric",
  negative: "Negative metric",
  "no-video-id": "Missing video_id",
  "duplicate-id": "Duplicate video_id",
  "zero-length": "Zero video_length",
  orphan: "No matching post",
  "no-stats": "No matching poststats",
};
