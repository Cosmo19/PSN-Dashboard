"use client";

import { useRef, useState } from "react";
import { formatDate, formatNumber } from "@/lib/format";
import type { DatasetMeta } from "@/lib/types";
import DatasetInspector from "./DatasetInspector";

type DatasetPanelProps = {
  meta: DatasetMeta;
  busy: boolean;
  error: string | null;
  onUpload: (posts: File, poststats: File) => void;
  onReset: () => void;
};

export default function DatasetPanel({
  meta,
  busy,
  error,
  onUpload,
  onReset,
}: DatasetPanelProps) {
  const [open, setOpen] = useState(false);
  const [inspecting, setInspecting] = useState(false);
  const [posts, setPosts] = useState<File | null>(null);
  const [stats, setStats] = useState<File | null>(null);
  const postsRef = useRef<HTMLInputElement>(null);
  const statsRef = useRef<HTMLInputElement>(null);

  const submit = () => {
    if (posts && stats) onUpload(posts, stats);
  };

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-slate-400">
          <span className="font-semibold text-slate-200">
            {meta.source === "bundled" ? "Bundled dataset" : "Uploaded dataset"}
          </span>
          <span className="mx-2 text-slate-600">|</span>
          {formatNumber(meta.postCount)} posts ·{" "}
          {formatNumber(meta.statRowCount)} daily stat rows ·{" "}
          {meta.accounts.length} channels
          {meta.minDate && (
            <>
              <span className="mx-2 text-slate-600">|</span>
              {formatDate(meta.minDate)} – {formatDate(meta.maxDate)}
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {meta.source === "upload" && (
            <button
              type="button"
              onClick={onReset}
              disabled={busy}
              className="rounded-md border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-accent hover:text-accent disabled:opacity-50"
            >
              Restore bundled data
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-slate-900 transition hover:bg-accent-muted"
          >
            {open ? "Cancel" : "Replace CSVs"}
          </button>
          <button
            type="button"
            onClick={() => setInspecting(true)}
            className="rounded-md border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-accent hover:text-accent"
          >
            View dataset
          </button>
        </div>
      </div>

      {meta.warnings.length > 0 && (
        <ul className="mt-3 space-y-1 border-t border-slate-700 pt-3 text-[11px] text-amber-300/90">
          {meta.warnings.map((warning) => (
            <li key={warning}>· {warning}</li>
          ))}
        </ul>
      )}

      {open && (
        <div className="mt-4 space-y-3 border-t border-slate-700 pt-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <FilePicker
              label="posts.csv"
              hint="post_id, video_id, account_name, published_at_date, video_type, title, video_length…"
              file={posts}
              inputRef={postsRef}
              onPick={setPosts}
            />
            <FilePicker
              label="poststats.csv"
              hint="video_id, data_date, likes, comments, shares, views, watchtime"
              file={stats}
              inputRef={statsRef}
              onPick={setStats}
            />
          </div>

          {error && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {error}
            </p>
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={submit}
              disabled={!posts || !stats || busy}
              className="rounded-md bg-accent px-4 py-2 text-xs font-semibold text-slate-900 transition hover:bg-accent-muted disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? "Processing…" : "Load these files"}
            </button>
            <p className="text-[11px] text-slate-500">
              Both files are required and are joined on <code>video_id</code>.
              Uploads stay in memory and are not written to disk.
            </p>
          </div>
        </div>
      )}

      {inspecting && <DatasetInspector onClose={() => setInspecting(false)} />}
    </div>
  );
}

function FilePicker({
  label,
  hint,
  file,
  inputRef,
  onPick,
}: {
  label: string;
  hint: string;
  file: File | null;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onPick: (file: File) => void;
}) {
  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const dropped = event.dataTransfer.files?.[0];
    if (dropped) onPick(dropped);
  };

  return (
    <div
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
      className={`rounded-lg border-2 border-dashed p-3 transition ${
        file ? "border-accent/50 bg-accent/[0.06]" : "border-slate-600 bg-slate-900/40"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-slate-200">{label}</p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="rounded border border-slate-600 px-2 py-0.5 text-[11px] text-slate-300 transition hover:border-accent hover:text-accent"
        >
          Browse
        </button>
      </div>
      <p className="mt-1 truncate text-[11px] text-slate-500">
        {file ? `${file.name} · ${(file.size / 1_048_576).toFixed(1)} MB` : hint}
      </p>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(event) => {
          const picked = event.target.files?.[0];
          if (picked) onPick(picked);
        }}
      />
    </div>
  );
}
