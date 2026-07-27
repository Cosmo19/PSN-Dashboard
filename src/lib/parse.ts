/**
 * Metric cells in poststats.csv are exported with thousands separators ("1,282,249").
 * Number() returns NaN for those, so they must be stripped before coercion.
 */
export function parseNumber(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;

  const cleaned = String(value).replace(/[,\s]/g, "");
  if (cleaned === "") return 0;

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * posts.csv publishes ISO dates, poststats.csv uses day-first D/M/YYYY.
 * Day-first is unambiguous here: the dataset contains first components up to 31
 * and second components never above 12.
 */
export function toIsoDate(value: unknown): string | null {
  if (value == null) return null;
  const raw = String(value).trim();
  if (raw === "") return null;

  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);

  const dayFirst = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dayFirst) {
    const [, day, month, year] = dayFirst;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  return null;
}

export function normaliseHeader(header: string): string {
  return header.trim().toLowerCase().replace(/\s+/g, "_");
}
