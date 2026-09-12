import "server-only";

import type { WatchlistItem } from "@prisma/client";
import { listHoldings, fetchPriceDataFor } from "@/lib/market";
import { getLatestSnapshotsFor, type SnapshotSummary } from "@/lib/snapshots";
import { fetchUsdJpyRate } from "@/lib/providers/forex";

const ASSET_TYPE_LABEL: Record<string, string> = {
  US_STOCK: "米国株",
  LEVERAGED_ETF: "レバレッジETF",
  CRYPTO: "暗号資産",
};

export type HoldingRow = {
  item: WatchlistItem;
  currentPriceUsd: number | null;
  currentValueUsd: number | null;
  costBasisUsd: number;
  gainUsd: number | null;
  gainPercent: number | null;
  snapshot: SnapshotSummary | null;
};

export type AllocationSlice = {
  assetType: string;
  label: string;
  valueUsd: number;
  percent: number;
};

export type PortfolioSummary = {
  rows: HoldingRow[];
  totalValueUsd: number;
  totalCostUsd: number;
  totalGainUsd: number;
  totalGainPercent: number | null;
  /** null when the forex API is unreachable — the page falls back to USD-only. */
  usdJpyRate: number | null;
  allocation: AllocationSlice[];
};

const EMPTY_SUMMARY: PortfolioSummary = {
  rows: [],
  totalValueUsd: 0,
  totalCostUsd: 0,
  totalGainUsd: 0,
  totalGainPercent: null,
  usdJpyRate: null,
  allocation: [],
};

/**
 * Aggregates the current-state holdings (WatchlistItems with a quantity
 * set) into portfolio totals, per-holding P&L, and an asset-type
 * allocation breakdown. Current prices and the USD/JPY rate are fetched
 * live; a single failed price lookup degrades that one row to "price
 * unavailable" rather than failing the whole page.
 */
export async function getPortfolioSummary(userId: string): Promise<PortfolioSummary> {
  const holdings = await listHoldings(userId);
  if (holdings.length === 0) return EMPTY_SUMMARY;

  const [priceResults, snapshots, usdJpyRate] = await Promise.all([
    Promise.allSettled(holdings.map((h) => fetchPriceDataFor(h))),
    getLatestSnapshotsFor(holdings.map((h) => h.id)),
    fetchUsdJpyRate().catch(() => null),
  ]);

  const rows: HoldingRow[] = holdings.map((item, i) => {
    const priceResult = priceResults[i];
    const price =
      priceResult.status === "fulfilled" ? (priceResult.value.quote?.price ?? null) : null;

    const quantity = item.quantity ?? 0;
    const costBasisUsd = quantity * (item.avgCostUsd ?? 0);
    const currentValueUsd = price !== null ? quantity * price : null;
    const gainUsd = currentValueUsd !== null ? currentValueUsd - costBasisUsd : null;
    const gainPercent =
      gainUsd !== null && costBasisUsd > 0 ? (gainUsd / costBasisUsd) * 100 : null;

    return {
      item,
      currentPriceUsd: price,
      currentValueUsd,
      costBasisUsd,
      gainUsd,
      gainPercent,
      snapshot: snapshots.get(item.id) ?? null,
    };
  });

  const totalValueUsd = rows.reduce((s, r) => s + (r.currentValueUsd ?? 0), 0);
  const totalCostUsd = rows.reduce((s, r) => s + r.costBasisUsd, 0);
  const totalGainUsd = totalValueUsd - totalCostUsd;
  const totalGainPercent = totalCostUsd > 0 ? (totalGainUsd / totalCostUsd) * 100 : null;

  const valueByType = new Map<string, number>();
  for (const r of rows) {
    valueByType.set(
      r.item.assetType,
      (valueByType.get(r.item.assetType) ?? 0) + (r.currentValueUsd ?? 0)
    );
  }
  const allocation: AllocationSlice[] = Array.from(valueByType.entries())
    .map(([assetType, valueUsd]) => ({
      assetType,
      label: ASSET_TYPE_LABEL[assetType] ?? assetType,
      valueUsd,
      percent: totalValueUsd > 0 ? (valueUsd / totalValueUsd) * 100 : 0,
    }))
    .sort((a, b) => b.valueUsd - a.valueUsd);

  return { rows, totalValueUsd, totalCostUsd, totalGainUsd, totalGainPercent, usdJpyRate, allocation };
}
