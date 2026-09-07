import "server-only";

import { prisma } from "@/lib/db";
import type { AssetType, WatchlistItem } from "@prisma/client";
import * as yahoo from "@/lib/providers/yahoo";
import * as coingecko from "@/lib/providers/coingecko";
import type { DailyBar } from "@/lib/providers/types";

export class SymbolNotFoundError extends Error {
  constructor(symbol: string) {
    super(`銘柄「${symbol}」が見つかりませんでした。`);
    this.name = "SymbolNotFoundError";
  }
}

/** Resolves the provider-specific lookup id and a display name for a new
 *  watchlist entry, without writing to the database. */
async function resolveSymbol(
  symbol: string,
  assetType: AssetType
): Promise<{ providerId: string; displayName: string }> {
  if (assetType === "CRYPTO") {
    const match = await coingecko.searchCoin(symbol);
    if (!match) throw new SymbolNotFoundError(symbol);
    return { providerId: match.id, displayName: match.name };
  }

  // US_STOCK / LEVERAGED_ETF — Yahoo Finance takes the ticker as-is.
  try {
    const chart = await yahoo.fetchChart(symbol.toUpperCase(), "3mo");
    return { providerId: symbol.toUpperCase(), displayName: chart.displayName };
  } catch (error) {
    if (error instanceof yahoo.SymbolLookupError) {
      throw new SymbolNotFoundError(symbol);
    }
    throw error;
  }
}

export async function addWatchlistItem(symbol: string, assetType: AssetType) {
  const trimmed = symbol.trim();
  if (!trimmed) throw new Error("銘柄コードを入力してください。");

  const { providerId, displayName } = await resolveSymbol(trimmed, assetType);

  return prisma.watchlistItem.create({
    data: {
      symbol: trimmed.toUpperCase(),
      assetType,
      providerId,
      displayName,
    },
  });
}

export function listWatchlist() {
  return prisma.watchlistItem.findMany({ orderBy: { addedAt: "desc" } });
}

export function getWatchlistItem(id: string) {
  return prisma.watchlistItem.findUnique({ where: { id } });
}

export function removeWatchlistItem(id: string) {
  return prisma.watchlistItem.delete({ where: { id } });
}

export type Quote = {
  price: number;
  changePercent: number | null;
};

export type PriceData = {
  quote: Quote | null;
  history: DailyBar[];
};

export async function fetchPriceDataFor(item: WatchlistItem): Promise<PriceData> {
  if (item.assetType === "CRYPTO") {
    const [history, price] = await Promise.all([
      coingecko.fetchDailyHistory(item.providerId),
      coingecko.fetchCoinPrice(item.providerId).catch(() => null),
    ]);
    return {
      history,
      quote: price
        ? { price: price.usd, changePercent: price.usd_24h_change ?? null }
        : null,
    };
  }

  const chart = await yahoo.fetchChart(item.providerId, "1y");
  return {
    history: chart.bars,
    quote: { price: chart.price, changePercent: chart.changePercent },
  };
}
