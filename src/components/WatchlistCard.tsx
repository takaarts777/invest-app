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

export function WatchlistCard({ item }: { item: WatchlistItem }) {
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

      <button
        onClick={handleDelete}
        disabled={pending}
        aria-label={`${item.symbol}を削除`}
        className="rounded-md p-2 text-slate-500 transition hover:bg-slate-800 hover:text-red-400 disabled:opacity-50"
      >
        ✕
      </button>
    </Link>
  );
}
