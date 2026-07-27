import { NextResponse } from "next/server";
import { inspectPosts, inspectStats } from "@/lib/inspect";
import {
  ROW_FILTERS,
  type InspectOptions,
  type RowFilter,
} from "@/lib/inspectTypes";
import { getDataset, getSources } from "@/lib/serverDataset";

export const dynamic = "force-dynamic";

const MAX_LIMIT = 200;

function intParam(value: string | null, fallback: number): number {
  // Number(null) and Number("") are both 0, so absent params must be checked first.
  if (value === null || value.trim() === "") return fallback;

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const table = url.searchParams.get("table") === "poststats" ? "poststats" : "posts";
  const rawFilter = url.searchParams.get("filter") as RowFilter | null;

  const options: InspectOptions = {
    offset: intParam(url.searchParams.get("offset"), 0),
    limit: Math.min(MAX_LIMIT, Math.max(1, intParam(url.searchParams.get("limit"), 50))),
    query: url.searchParams.get("q") ?? "",
    filter: rawFilter && ROW_FILTERS.includes(rawFilter) ? rawFilter : "all",
  };

  try {
    const [{ payload }, sources] = await Promise.all([getDataset(), getSources()]);

    if (table === "posts") {
      const videos = new Map(payload.videos.map((video) => [video.id, video]));
      return NextResponse.json(inspectPosts(sources.posts, videos, options));
    }

    const knownIds = new Set(payload.videos.map((video) => video.id));
    return NextResponse.json(inspectStats(sources.poststats, knownIds, options));
  } catch (error) {
    return NextResponse.json(
      {
        error: "Could not read the source rows.",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
