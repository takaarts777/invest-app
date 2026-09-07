import Link from "next/link";
import { notFound } from "next/navigation";
import { getWatchlistItem } from "@/lib/market";
import { getLatestSnapshot } from "@/lib/snapshots";
import { PriceChart } from "@/components/PriceChart";
import { AnalysisPanels } from "@/components/AnalysisPanels";

const ASSET_TYPE_LABEL: Record<string, string> = {
  US_STOCK: "米国株",
  LEVERAGED_ETF: "レバレッジETF",
  CRYPTO: "暗号資産",
};

export default async function TickerPage(props: PageProps<"/ticker/[id]">) {
  const { id } = await props.params;
  const item = await getWatchlistItem(id);
  if (!item) notFound();
  const snapshot = await getLatestSnapshot(item.id);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/" className="text-sm text-slate-500 hover:text-slate-300">
          ← ウォッチリストに戻る
        </Link>
        <div className="mt-2 flex items-center gap-2">
          <h1 className="text-xl font-semibold text-slate-100">
            {item.symbol}
          </h1>
          <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
            {ASSET_TYPE_LABEL[item.assetType]}
          </span>
        </div>
        {item.displayName && (
          <p className="text-sm text-slate-400">{item.displayName}</p>
        )}
      </div>

      <PriceChart watchlistItemId={item.id} />

      <AnalysisPanels watchlistItemId={item.id} initialSnapshot={snapshot} />
    </div>
  );
}
