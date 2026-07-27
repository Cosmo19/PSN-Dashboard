# Content Performance Dashboard

A Dockerised Next.js dashboard that joins a YouTube post library to daily performance
deltas and visualises the result with D3.

- **Next.js 15** (App Router, TypeScript, standalone output)
- **Tailwind CSS** for the dark UI
- **D3** for scales, shapes and axes — marks are rendered by React so every chart is
  reactive and tooltip-driven
- **PapaParse** for CSV parsing, server-side

## Running

With Docker (serves on <http://localhost:3000>):

```bash
docker compose up --build
```

Locally:

```bash
npm install
npm run dev
```

## Data model

Two CSVs in `public/` are loaded automatically on first request and joined on `video_id`.

`posts.csv` — one row per post (2,326 rows in the bundled export):

| Column | Notes |
| --- | --- |
| `post_id`, `video_id` | `video_id` is the join key |
| `account_name` | 12 channels |
| `published_at_date` | ISO `YYYY-MM-DD` |
| `video_type` | `Shorts` or `Long Form` |
| `video_length` | **milliseconds** |
| `title`, `text`, `video_url`, `thumbnail_url` | |

`poststats.csv` — one row per post per day (187,974 rows):

| Column | Notes |
| --- | --- |
| `video_id` | join key |
| `data_date` | **day-first** `DD/MM/YYYY` |
| `likes`, `comments`, `shares`, `views` | daily deltas, not cumulative |
| `watchtime` | daily delta in **minutes** |

### Quirks handled during parsing

These are the reason the raw files understate performance if read naively:

1. **Thousands separators.** Roughly 4% of metric cells are quoted with commas
   (`"1,282,249"`). `Number()` returns `NaN` for those, which silently dropped the
   highest-traffic days and understated total views by about 7.5x. `parseNumber` in
   `src/lib/parse.ts` strips separators first.
2. **Day-first dates.** `data_date` is `DD/MM/YYYY`, so `new Date()` misreads any day
   above 12. `toIsoDate` normalises both files to ISO.
3. **Negative likes.** Some daily rows carry negative like counts (unlikes). These are
   genuine deltas and are preserved.
4. **Missing watch time.** A small number of high-view posts report zero watch time, so
   retention excludes them. The dashboard surfaces this as a warning insight rather than
   hiding it.

## What the dashboard shows

KPI cards, then auto-generated written conclusions, then:

- **Channel share of views** — bubble chart where each channel's **area** is proportional
  to its total views. D3's pack layout keeps the bubbles clustered in the centre. The
  chart height scales between 360px and 560px with its container width, and hovering a
  bubble shows the channel details without changing the active filters.
- **Daily views and watch time** — dual-axis trend across the selected window
- **Format split** — donuts for view share and watch-time share, plus a side-by-side
  metric table for Shorts against Long Form
- **Channel leaderboard** — total views and average views per post
- **Retention against length** — scatter on a log axis, coloured by format
- **Engagement against reach** — scatter that exposes outliers and regression to the mean
- **Length bands and publishing day** — average views with a secondary retention line
- **Top posts** — sortable table with thumbnails; clicking any row (or any scatter point)
  opens a drawer with that post's full daily curve

Filters for channel, format and date range recompute everything client-side. KPI cards and
the trend chart respect the date range because they derive from daily deltas; post-level
panels are labelled as lifetime totals.

All charts observe their container width and redraw when it changes. Margins, chart
heights, label truncation and tick counts tighten on narrow screens. The scatter plots use
explicit, meaningful log-axis intervals rather than D3's dense minor ticks: video length
is shown as readable durations (`0:10`, `1:00`, `10:00`, `3:00:00` on mobile), while
reach uses compact powers of ten (`1K`, `10K`, `100K`, `1M`, `10M`).

## Inspecting the data

**View dataset** opens a row-level inspector for whichever dataset is active, built for
checking that normalisation did what you expect. Each table shows the **raw CSV cells**
next to the **values the dashboard derived from them**, so `"1,282,249"` sits beside
`1282249` and `14/01/2026` beside `2026-01-14`. Raw cells still containing a separator are
highlighted, and the source line number is pinned to the left of every row.

Rows are tagged with flags, counted across the whole file in the summary bar:

| Flag | Meaning |
| --- | --- |
| `separators` | A metric cell was written with thousands separators |
| `negative` | A metric is below zero (unlikes are legitimate) |
| `non-numeric` | A non-empty metric could not be coerced to a number |
| `bad-date` | `data_date` or `published_at_date` could not be parsed |
| `orphan` | A poststats row references a `video_id` with no post |
| `no-stats` | A post has no matching poststats rows |
| `duplicate-id` | A repeated `video_id` in posts, ignored during the build |
| `zero-length` | `video_length` resolved to zero seconds |

Filter to **Flagged** or **Comma values** to jump straight to the rows that exercise the
parsing edge cases, search across raw and derived cells, page through at up to 200 rows,
and export the current page as JSON. On the bundled export, posts reports no anomalies and
poststats reports 29,930 rows with separators plus 3,286 with negative metrics.

## Replacing the data

Use **Replace CSVs** in the dashboard to upload a new `posts` and `poststats` pair.
Headers are validated before anything is swapped, and a bad pair returns a specific error
naming the missing columns. Uploads are held in memory for the process lifetime only —
nothing is written to disk, so the container filesystem stays read-only and
**Restore bundled data** always returns to the files in `public/`.

## API

| Route | Purpose |
| --- | --- |
| `GET /api/dataset` | Parsed, aggregated payload for the active dataset |
| `POST /api/dataset` | Multipart upload of `posts` + `poststats` |
| `DELETE /api/dataset` | Discard the upload and restore the bundled files |
| `GET /api/dataset/video/[id]` | Daily series for a single post |
| `GET /api/dataset/rows` | Raw and normalised rows for the inspector |

`/api/dataset/rows` accepts `table=posts\|poststats`, `offset`, `limit` (max 200),
`q` for a substring search across all cells, and `filter=all\|flagged\|separators`. It
rescans the source text per request so nothing extra is held in memory between calls:

```bash
curl 'http://localhost:3000/api/dataset/rows?table=poststats&filter=separators&limit=5'
```

The client receives post-level totals plus daily rows grouped by date, channel and format
(about 3,800 rows) rather than the full 188,000-row table, so every filter combination is
recomputed locally without another round trip.
