# Section A - SQL Analysis

Before developing the dashboard, the supplied CSV datasets were imported into **DB Browser for SQLite**. This stage ensured the data was correctly structured, cleaned where necessary, and suitable for SQL analysis.

## Importing the datasets

The provided `posts.csv` and `poststats.csv` files were imported into SQLite.

The database schema was reviewed to ensure:

- Appropriate data types were assigned
- Primary and foreign keys were correctly configured
- The relationship between `posts.video_id` and `poststats.video_id` was established

## Data normalisation

### Converting dates to ISO format

The `poststats.data_date` column was stored as `DD/MM/YYYY`, which SQLite does not treat as a standard date format. This prevented reliable filtering and chronological ordering when executing SQL queries.

The dates were normalised into ISO (`YYYY-MM-DD`) format using:

```sql
UPDATE poststats
SET data_date =
    substr(data_date, 7, 4) || '-' ||
    substr(data_date, 4, 2) || '-' ||
    substr(data_date, 1, 2)
WHERE data_date LIKE '__/__/____';
```

### Converting mixed data types

Inspection of the `views` column showed that it contained mixed storage types.

The following query was used to identify the different data types:

```sql
SELECT typeof(views), COUNT(*)
FROM poststats
GROUP BY typeof(views);
```

The values were then converted into integers:

```sql
UPDATE poststats
SET views = CAST(views AS INTEGER);
```

## SQL Analysis

<img width="1072" height="1134" alt="table_schema" src="https://github.com/user-attachments/assets/397bccbe-45fc-4f29-b3d0-aef01d22e2b0" />

### 1. Total views per video

Calculates the lifetime total number of views for every video.

```sql
SELECT
    p.video_id,
    p.title,
    SUM(ps.views) AS total_views
FROM posts p
JOIN poststats ps
    ON p.video_id = ps.video_id
GROUP BY
    p.video_id,
    p.title
ORDER BY total_views DESC;
```

### 2. Video views by video type over time

Aggregates daily views for each video format (Shorts and Long Form).

```sql
SELECT
    p.video_type,
    ps.data_date,
    SUM(ps.views) AS daily_views
FROM posts p
JOIN poststats ps
    ON p.video_id = ps.video_id
GROUP BY
    p.video_type,
    ps.data_date
ORDER BY
    ps.data_date ASC,
    p.video_type;
```

### 3. Top five videos by views over the previous 28 days

Returns the five highest-performing videos during the latest 28-day reporting period (since last upload, as the dataset 28 days ago from today's date returns nothing).

```sql
SELECT
    p.video_id,
    p.title,
    SUM(ps.views) AS views_last_28_days
FROM posts p
JOIN poststats ps
    ON p.video_id = ps.video_id
WHERE ps.data_date >= (
    SELECT DATE(MAX(data_date), '-28 days')
    FROM poststats
)
GROUP BY
    p.video_id,
    p.title
ORDER BY views_last_28_days DESC
LIMIT 5;
```

# Section B - Dashboard Implementation

<img width="1728" height="1117" alt="dashboard" src="https://github.com/user-attachments/assets/aad8f045-5211-423f-8775-2736eabd5939" />

## Content Performance Dashboard

A Dockerised Next.js dashboard that joins a YouTube post library to daily performance deltas and visualises the result with D3.

- **Next.js** (App Router, TypeScript, standalone output)
- **Tailwind CSS** for the UI components
- **D3** for scales, shapes and axes - marks are rendered by React so every chart is reactive and tooltip-driven
- **PapaParse** for CSV parsing

---

### Docker

Docker isn't directly related to Next.js, YouTube data, or D3. It's simply the technology used to package and run the dashboard reliably across any device be MacOS or Windows.

The application can be started using Docker and is served on <http://localhost:3000>.

---

```bash
docker compose up --build
```

### Local development

```bash
npm install
npm run dev
```

## Data model

Two CSV files located in `public/` are loaded automatically on the first request and joined using `video_id`.

### `posts.csv`

One row per post (2,326 rows in the bundled dataset).

| Column | Notes |
| --- | --- |
| `post_id`, `video_id` | `video_id` is the join key |
| `account_name` | One of 12 YouTube channels |
| `published_at_date` | ISO `YYYY-MM-DD` |
| `video_type` | `Shorts` or `Long Form` |
| `video_length` | Stored in milliseconds |
| `title`, `text`, `video_url`, `thumbnail_url` | Post metadata |

### `poststats.csv`

One row per post per day (187,974 rows).

| Column | Notes |
| --- | --- |
| `video_id` | Join key |
| `data_date` | Source format `DD/MM/YYYY` |
| `likes`, `comments`, `shares`, `views` | Daily metric deltas |
| `watchtime` | Daily watch time in minutes |

## Parsing considerations

Several inconsistencies in the raw CSV files required additional handling during parsing.

### 1. Thousands separators

Approximately 4% of metric values were written using quoted thousands separators, for example `"1,282,249"`.

Passing these values directly to `Number()` returns `NaN`, causing the largest traffic days to be ignored and understating total views by approximately 7.5 times.

The `parseNumber` helper in `src/lib/parse.ts` removes separators before converting the value.

### 2. Day-first dates

The `poststats.data_date` field uses `DD/MM/YYYY`, which JavaScript incorrectly interprets for many values when using `new Date()`.

The `toIsoDate` helper converts all dates into ISO format before processing.

### 3. Negative likes

Some daily records contain negative like counts, representing users removing likes.

These values are preserved because they are valid daily deltas.

### 4. Missing watch time

A small number of high-view posts report zero watch time.

These posts are excluded from retention calculations, and the dashboard displays a warning rather than silently excluding them.

## Dashboard features

The dashboard includes:

- KPI summary cards
- Automatically generated written insights
- Channel share of views bubble chart
- Daily views and watch time trend chart
- Format comparison for Shorts and Long Form
- Channel leaderboard
- Retention against video length scatter plot
- Engagement against reach scatter plot
- Length band and publishing day analysis
- Sortable top posts table
- Individual post performance drawer

Filters for channel, format and date range are applied entirely on the client.

Daily KPI cards and trend charts respect the selected date range because they are calculated from daily deltas.

Post-level visualisations are clearly labelled as lifetime totals.

All charts automatically observe their container width and redraw when resized. Margins, chart heights, tick density and label truncation are adjusted for smaller displays.

The scatter plots use meaningful logarithmic intervals rather than D3's default minor ticks. Video length is displayed as readable durations such as `0:10`, `1:00`, `10:00` and `3:00:00`, while reach is displayed using compact labels such as `1K`, `10K`, `100K`, `1M` and `10M`.

## Dataset Inspector

The **View dataset** feature provides a row-level inspection interface for validating the parsing process.

Each row displays:

- Original CSV values
- Parsed values
- Source line number
- Parsing flags

Rows containing comma-separated numeric values remain highlighted to demonstrate that parsing has been performed correctly.

### Available flags:

| Flag | Meaning |
| --- | --- |
| `separators` | A metric contains thousands separators |
| `negative` | A metric value is below zero |
| `non-numeric` | A non-empty metric could not be converted into a number |
| `bad-date` | A date value could not be parsed |
| `orphan` | A `poststats` row has no matching post |
| `no-stats` | A post has no matching statistics |
| `duplicate-id` | A duplicate `video_id` exists in `posts` |
| `zero-length` | A video's duration resolves to zero seconds |

The inspector allows users to:

- Filter flagged rows
- Search raw and parsed values
- Page through up to 200 rows
- Export the current page as JSON

For the bundled dataset:

- `posts` reports no anomalies.
- `poststats` reports:
  - 29,930 rows containing thousands separators
  - 3,286 rows containing negative metric values

## Replacing the data

The **Replace CSVs** feature allows users to upload a replacement `posts.csv` and `poststats.csv` pair.

The upload process:

- Validates all required column headers
- Returns specific validation errors if required columns are missing
- Stores uploaded files in memory only
- Does not write data to disk
- Allows the bundled dataset to be restored at any time

## API

| Route | Purpose |
| --- | --- |
| `GET /api/dataset` | Returns the parsed and aggregated dataset |
| `POST /api/dataset` | Uploads replacement CSV files |
| `DELETE /api/dataset` | Restores the bundled dataset |
| `GET /api/dataset/video/[id]` | Returns the daily series for a single video |
| `GET /api/dataset/rows` | Returns raw and parsed rows for the dataset inspector |

`/api/dataset/rows` accepts the following query parameters:

| Parameter | Description |
| --- | --- |
| `table` | `posts` or `poststats` |
| `offset` | Starting row |
| `limit` | Maximum of 200 rows |
| `q` | Searches across all cells |
| `filter` | `all`, `flagged` or `separators` |

**Example:**

```bash
curl "http://localhost:3000/api/dataset/rows?table=poststats&filter=separators&limit=5"
```

# Section C - Reflection & AI Tooling

### Using Claude & Cursor in my workflow:

I view AI as an extension of my knowledge rather than a replacement for it. For this exercise, I used Cursor's AI tooling throughout the development process. It helped scaffold the Dockerised Next.js dashboard, generate D3 visualisations, implement CSV parsing and data normalisation, troubleshoot issues, and refine responsiveness and theming. It accelerated development by handling repetitive implementation tasks and providing starting points, allowing me to spend more time evaluating the visualisations and improving the overall user experience with quick troubleshooting. I remained responsible for reviewing, testing, and adapting the generated code to ensure it met the projects requirements.

### One thing I'd improve if I had more time:

Albeit a quick exercise in creating a simple dashboard for the content & data team, I wanted to develop further on this by adding even more metrics of visualisations to the dashboard. Also, I would've wanted to improve mobile usability, add better data checks, save uploaded data permanently (maybe use a PostgreSQL container?), and let users export reports or customise the charts axes?
