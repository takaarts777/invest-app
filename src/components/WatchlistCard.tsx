"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { WatchlistItem } from "@prisma/client";
import type { SnapshotSummary } from "@/lib/snapshots";
import { LABEL_BADGE_COLOR } from "@/lib/signal-badge";

const ASSET_TYPE_LABEL: Record<WatchlistItem["assetType"], string> = {
  US_STOCK: "米国株",
  LEVERAGED_ETF: "レバレッジETF",
  CRYPTO: "暗号資産",
};

const DIVERGENCE_BADGE: Record<string, { label: string; className: string }> = {
  bullish: { label: "📈 強気乖離", className: "bg-emerald-500/15 text-emerald-300" },
  bearish: { label: "📉 弱気乖離", className: "bg-amber-500/15 text-amber-300" },
};

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
        {snapshot?.divergenceSignal && DIVERGENCE_BADGE[snapshot.divergenceSignal] && (
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
              DIVERGENCE_BADGE[snapshot.divergenceSignal].className
            }`}
            title="RSIダイバージェンスを検出しました（詳細は銘柄ページのダイバージェンス分析欄）"
          >
            {DIVERGENCE_BADGE[snapshot.divergenceSignal].label}
          </span>
        )}

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
