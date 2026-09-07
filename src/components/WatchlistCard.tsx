"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { WatchlistItem } from "@prisma/client";

const ASSET_TYPE_LABEL: Record<WatchlistItem["assetType"], string> = {
  US_STOCK: "米国株",
  LEVERAGED_ETF: "レバレッジETF",
  CRYPTO: "暗号資産",
};

const LABEL_BADGE_COLOR: Record<string, string> = {
  強い買い: "bg-emerald-500/15 text-emerald-400",
  買い: "bg-emerald-500/10 text-emerald-300",
  中立: "bg-slate-700/50 text-slate-300",
  売り: "bg-red-500/10 text-red-300",
  強い売り: "bg-red-500/15 text-red-400",
};

type SnapshotSummary = { compositeLabel: string | null; compositeScore: number | null };

export function WatchlistCard({
  item,
  snapshot,
}: {
  item: WatchlistItem;
  snapshot?: SnapshotSummary | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`「${item.symbol}」をウォッチリストから削除しますか？`)) return;

    setPending(true);
    try {
      await fetch(`/api/watchlist/${item.id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Link
      href={`/ticker/${item.id}`}
      className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 p-4 transition hover:border-slate-700"
    >
      <div>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-100">{item.symbol}</span>
          <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
            {ASSET_TYPE_LABEL[item.assetType]}
          </span>
        </div>
        {item.displayName && (
          <p className="mt-0.5 text-sm text-slate-400">{item.displayName}</p>
        )}
      </div>

      <div className="flex items-center gap-2">
        {snapshot?.compositeLabel && (
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
              LABEL_BADGE_COLOR[snapshot.compositeLabel] ?? "bg-slate-800 text-slate-300"
            }`}
          >
            {snapshot.compositeLabel}
          </span>
        )}

        <button
          onClick={handleDelete}
          disabled={pending}
          aria-label={`${item.symbol}を削除`}
          className="rounded-md p-2 text-slate-500 transition hover:bg-slate-800 hover:text-red-400 disabled:opacity-50"
        >
          ✕
        </button>
      </div>
    </Link>
  );
}
