export type VideoType = "Shorts" | "Long Form";

export type VideoRow = {
  id: string;
  title: string;
  account: string;
  type: VideoType;
  published: string;
  lengthSec: number;
  url: string;
  thumb: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  watchMin: number;
  activeDays: number;
};

/** Daily deltas rolled up to date + account + type so the client can re-aggregate under any filter. */
export type DailyRow = {
  date: string;
  account: string;
  type: VideoType;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  watchMin: number;
};

export type DatasetMeta = {
  source: "bundled" | "upload";
  generatedAt: string;
  postCount: number;
  statRowCount: number;
  accounts: string[];
  types: VideoType[];
  minDate: string;
  maxDate: string;
  warnings: string[];
};

export type DatasetPayload = {
  meta: DatasetMeta;
  videos: VideoRow[];
  daily: DailyRow[];
};

export type VideoDailyPoint = {
  date: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  watchMin: number;
};
