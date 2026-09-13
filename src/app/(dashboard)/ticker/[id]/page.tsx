import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getWatchlistItem } from "@/lib/market";
import { getSessionUserId } from "@/lib/session";
import { getLatestSnapshot } from "@/lib/snapshots";
import type { DivergenceMetrics } from "@/lib/analysis/divergence";
import { PriceChart } from "@/components/PriceChart";
import { RsiChart } from "@/components/RsiChart";
import { AnalysisPanels } from "@/components/AnalysisPanels";
import { HoldingForm } from "@/components/HoldingForm";

const ASSET_TYPE_LABEL: Record<string, string> = {
  US_STOCK: "米国株",
  LEVERAGED_ETF: "レバレッジETF",
  CRYPTO: "暗号資産",
};

export default async function TickerPage(props: PageProps<"/ticker/[id]">) {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const { id } = await props.params;
  const item = await getWatchlistItem(id, userId);
  if (!item) notFound();
  const snapshot = await getLatestSnapshot(item.id);

  // Pulled out server-side so PriceChart/RsiChart can draw the same
  // divergence connector line the "保有期間別の売り時の目安" card
  // refers to, without either chart needing to know about
  // AnalysisSnapshot/rawDetails itself. Missing/old-shape rawDetails
  // (e.g. a snapshot saved before this axis existed) just yields null —
  // both charts already treat that as "nothing to draw".
  let divergence: DivergenceMetrics | null = null;
  if (snapshot?.rawDetails) {
    try {
      const parsed = JSON.parse(snapshot.rawDetails) as { divergence?: DivergenceMetrics };
      divergence = parsed.divergence ?? null;
    } catch {
      divergence = null;
    }
  }

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

      <PriceChart watchlistItemId={item.id} divergence={divergence} />

      <RsiChart watchlistItemId={item.id} divergence={divergence} />

      <AnalysisPanels watchlistItemId={item.id} initialSnapshot={snapshot} />

      <HoldingForm
        itemId={item.id}
        initialQuantity={item.quantity}
        initialAvgCostUsd={item.avgCostUsd}
      />
    </div>
  );
}
