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

export class NotFoundError extends Error {
  constructor() {
    super("見つかりませんでした。");
    this.name = "NotFoundError";
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

export async function addWatchlistItem(
  userId: string,
  symbol: string,
  assetType: AssetType,
  /** When the user picked a specific result from the ticker-search
   *  autocomplete, use it directly instead of re-resolving by symbol —
   *  this matters most for crypto, where several tokens can share a
   *  ticker and re-searching by symbol text alone could land on a
   *  different coin than the one the user actually selected. */
  hint?: { providerId: string; displayName: string }
) {
  const trimmed = symbol.trim();
  if (!trimmed) throw new Error("銘柄コードを入力してください。");

  const { providerId, displayName } = hint ?? (await resolveSymbol(trimmed, assetType));

  return prisma.watchlistItem.create({
    data: {
      userId,
      symbol: trimmed.toUpperCase(),
      assetType,
      providerId,
      displayName,
    },
  });
}

export function listWatchlist(userId: string) {
  return prisma.watchlistItem.findMany({ where: { userId }, orderBy: { addedAt: "desc" } });
}

/** Every watchlist item across every user — for the cron refresh job
 *  only. Never expose this to a per-request handler. */
export function listAllWatchlistItemsForCron() {
  return prisma.watchlistItem.findMany({ orderBy: { addedAt: "desc" } });
}

/** Scoped to the requesting user — returns null both when the id doesn't
 *  exist and when it belongs to someone else, so callers can't tell the
 *  difference (same as a plain 404). */
export function getWatchlistItem(id: string, userId: string) {
  return prisma.watchlistItem.findFirst({ where: { id, userId } });
}

export async function removeWatchlistItem(id: string, userId: string) {
  const result = await prisma.watchlistItem.deleteMany({ where: { id, userId } });
  if (result.count === 0) throw new NotFoundError();
}

/** Sets or clears the current holding (quantity + average cost) for a
 *  watchlist item. Pass both as `null` to clear the holding (item stays
 *  on the watchlist, just drops off the portfolio page). */
export async function setHolding(
  id: string,
  userId: string,
  holding: { quantity: number | null; avgCostUsd: number | null }
) {
  const result = await prisma.watchlistItem.updateMany({
    where: { id, userId },
    data: { quantity: holding.quantity, avgCostUsd: holding.avgCostUsd },
  });
  if (result.count === 0) throw new NotFoundError();
  return getWatchlistItem(id, userId);
}

/** Watchlist items that currently represent an actual holding. */
export function listHoldings(userId: string) {
  return prisma.watchlistItem.findMany({
    where: { userId, quantity: { not: null } },
    orderBy: { addedAt: "desc" },
  });
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
