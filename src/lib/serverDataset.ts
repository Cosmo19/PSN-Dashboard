import fs from "node:fs/promises";
import path from "node:path";
import { buildDataset, type BuiltDataset } from "./dataset";

const BUNDLED_POSTS = "posts.csv";
const BUNDLED_STATS = "poststats.csv";

export type DatasetSources = {
  posts: string;
  poststats: string;
};

type CacheEntry = {
  built: BuiltDataset;
  /** Kept so the inspector can re-read the original cells behind each normalised value. */
  sources: DatasetSources;
};

/**
 * Uploaded datasets replace the bundled ones for the process lifetime only.
 * Nothing is written to disk, which keeps the container filesystem read-only.
 */
let cache: CacheEntry | null = null;

async function readBundled(name: string): Promise<string> {
  return fs.readFile(path.join(process.cwd(), "public", name), "utf8");
}

async function load(): Promise<CacheEntry> {
  if (cache) return cache;

  const [posts, poststats] = await Promise.all([
    readBundled(BUNDLED_POSTS),
    readBundled(BUNDLED_STATS),
  ]);

  cache = {
    built: buildDataset(posts, poststats, "bundled"),
    sources: { posts, poststats },
  };
  return cache;
}

export async function getDataset(): Promise<BuiltDataset> {
  return (await load()).built;
}

export async function getSources(): Promise<DatasetSources> {
  return (await load()).sources;
}

export function replaceDataset(postsCsv: string, statsCsv: string): BuiltDataset {
  cache = {
    built: buildDataset(postsCsv, statsCsv, "upload"),
    sources: { posts: postsCsv, poststats: statsCsv },
  };
  return cache.built;
}

export function clearDataset(): void {
  cache = null;
}
