import { NextResponse } from "next/server";
import { getDataset } from "@/lib/serverDataset";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { payload, videoDaily } = await getDataset();

  const video = payload.videos.find((candidate) => candidate.id === id);
  if (!video) {
    return NextResponse.json({ error: "Unknown video_id." }, { status: 404 });
  }

  return NextResponse.json({
    video,
    series: videoDaily.get(id) ?? [],
  });
}
