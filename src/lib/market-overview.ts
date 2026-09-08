import "server-only";

import * as cnnfeargreed from "@/lib/providers/cnnfeargreed";
import * as feargreed from "@/lib/providers/feargreed";
import { analyzeSectorBasket, type SmartMoneyMetrics } from "@/lib/analysis/smartmoney";
import { MARKET_WIDE_BASKET } from "@/lib/data/sector-baskets";

export type MarketOverview = {
  stockFearGreed: { value: number; classification: string } | null;
  cryptoFearGreed: { value: number; classification: string } | null;
  smartMoney: SmartMoneyMetrics;
};

// This calls CNN + alternative.me + 7 Finnhub lookups, so it's cached
// in-process for a while rather than refetched on every dashboard load.
// NOTE: this in-memory cache only helps a long-lived process (local dev,
// or a Vercel deployment on a warm instance) — on serverless, a cold
// start bypasses it. If that turns out to matter after deploying, move
// this to the same DB-snapshot + cron pattern the per-ticker analyses use.
const CACHE_TTL_MS = 30 * 60 * 1000;
let cache: { data: MarketOverview; expiresAt: number } | null = null;

/**
 * Market-wide reference info for the dashboard — deliberately NOT tied to
 * any specific watchlist ticker. Dumb Money uses the same real indices as
 * the per-ticker sentiment axis (CNN for stocks, alternative.me for
 * crypto); Smart Money has no free market-wide equivalent, so it's
 * approximated from a mega-cap basket (see MARKET_WIDE_BASKET) — clearly
 * labeled as such in the UI, not presented as an official index.
 */
export async function getMarketOverview(): Promise<MarketOverview> {
  if (cache && cache.expiresAt > Date.now()) return cache.data;

  const [stockFg, cryptoFg, smart] = await Promise.allSettled([
    cnnfeargreed.fetchCnnFearGreedIndex(),
    feargreed.fetchFearGreedIndex(),
    analyzeSectorBasket(MARKET_WIDE_BASKET),
  ]);

  const data: MarketOverview = {
    stockFearGreed:
      stockFg.status === "fulfilled"
        ? { value: stockFg.value.value, classification: stockFg.value.classification }
        : null,
    cryptoFearGreed:
      cryptoFg.status === "fulfilled"
        ? { value: cryptoFg.value.value, classification: cryptoFg.value.classification }
        : null,
    smartMoney:
      smart.status === "fulfilled"
        ? smart.value
        : { available: false, reason: "取得に失敗しました。" },
  };

  cache = { data, expiresAt: Date.now() + CACHE_TTL_MS };
  return data;
}
