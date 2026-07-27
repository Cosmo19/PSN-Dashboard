import { NextResponse } from "next/server";
import { POSTS_COLUMNS, STATS_COLUMNS, validateHeaders } from "@/lib/dataset";
import { clearDataset, getDataset, replaceDataset } from "@/lib/serverDataset";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { payload } = await getDataset();
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Could not load the bundled dataset.",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Upload was not valid multipart form data." },
      { status: 400 }
    );
  }

  const postsFile = form.get("posts");
  const statsFile = form.get("poststats");

  if (!(postsFile instanceof File) || !(statsFile instanceof File)) {
    return NextResponse.json(
      { error: "Both a posts file and a poststats file are required." },
      { status: 400 }
    );
  }

  const [postsCsv, statsCsv] = await Promise.all([
    postsFile.text(),
    statsFile.text(),
  ]);

  const missingPosts = validateHeaders(postsCsv, POSTS_COLUMNS);
  const missingStats = validateHeaders(statsCsv, STATS_COLUMNS);

  if (missingPosts.length > 0 || missingStats.length > 0) {
    const problems = [
      missingPosts.length > 0
        ? `posts is missing: ${missingPosts.join(", ")}`
        : null,
      missingStats.length > 0
        ? `poststats is missing: ${missingStats.join(", ")}`
        : null,
    ].filter(Boolean);

    return NextResponse.json(
      { error: `Unexpected columns. ${problems.join(" · ")}` },
      { status: 422 }
    );
  }

  try {
    const { payload } = replaceDataset(postsCsv, statsCsv);
    if (payload.videos.length === 0) {
      clearDataset();
      return NextResponse.json(
        { error: "No usable rows were found in the uploaded files." },
        { status: 422 }
      );
    }
    return NextResponse.json(payload);
  } catch (error) {
    clearDataset();
    return NextResponse.json(
      {
        error: "Failed to parse the uploaded files.",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 422 }
    );
  }
}

export async function DELETE() {
  clearDataset();
  const { payload } = await getDataset();
  return NextResponse.json(payload);
}
