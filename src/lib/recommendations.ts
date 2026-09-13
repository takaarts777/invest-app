import "server-only";

import * as yahoo from "@/lib/providers/yahoo";
import { analyzeTechnical, type TechnicalMetrics } from "@/lib/analysis/technical";
import { analyzeAnomaly, type AnomalyMetrics } from "@/lib/analysis/anomaly";
import { analyzeDivergence, type DivergenceMetrics } from "@/lib/analysis/divergence";
import { labelFor } from "@/lib/analysis/signal";
import { BREADTH_UNIVERSE } from "@/lib/data/breadth-universe";
import type { InvestmentHorizon } from "@/lib/recommendations-constants";

export type { InvestmentHorizon };

export type StockRecommendation = {
  symbol: string;
  displayName: string;
  price: number;
  changePercent: number | null;
  compositeScore: number;
  compositeLabel: string;
  horizon: InvestmentHorizon;
  reason: string;
};

// Deliberately technical/anomaly/divergence only — these three are all
// derived purely from price history (free, no API key), so scanning the
// whole ~110-name universe below costs nothing and needs no per-user
// Anthropic key. Fundamentals (Finnhub) and news sentiment (Claude) stay
// per-ticker, on the watchlist detail page, rather than being fetched
// for every candidate on every scan — that would mean ~100+ Finnhub
// calls and ~100+ Claude calls per refresh, billed to whichever user's
// key happens to trigger the cache miss.
const WEIGHTS = { technical: 0.5, anomaly: 0.2, divergence: 0.3 };

const MIN_BARS = 60;
const CONCURRENCY = 8;

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/**
 * Which holding period this read best suits: short-term signals are
 * momentum/mean-reversion (divergence, RSI extremes, price/volume
 * spikes) that tend to resolve in days-to-weeks; medium-term is trend
 * continuation (MACD, price vs SMA20/50) over weeks-to-months;
 * long-term is the durable trend (price vs SMA200, the 50/200 "golden
 * cross") over months-to-years. Whichever bucket has the strongest
 * pull of confirming signals wins, with a tie going to the longer
 * horizon (a trend that's also showing short-term confirmation is a
 * stronger long-term case, not a reason to shorten the horizon).
 */
function inferHorizon(
  technical: TechnicalMetrics | null,
  anomaly: AnomalyMetrics | null,
  divergence: DivergenceMetrics | null
): InvestmentHorizon {
  let short = 0;
  let medium = 0;
  let long = 0;

  if (divergence && divergence.signal !== "none") short += 2;
  if (anomaly?.findings.some((f) => f.type === "price_spike" || f.type === "deviation")) short += 1;
  if (anomaly?.findings.some((f) => f.type === "rsi_history")) short += 1;

  if (technical) {
    if (technical.macd && technical.macd.histogram > 0) medium += 1;
    if (technical.sma20 !== null && technical.price > technical.sma20) medium += 1;
    if (technical.sma50 !== null && technical.price > technical.sma50) long += 1;
    if (technical.sma200 !== null && technical.price > technical.sma200) long += 1;
    if (technical.sma50 !== null && technical.sma200 !== null && technical.sma50 > technical.sma200) {
      long += 2;
    }
  }

  if (long >= medium && long >= short) return "long";
  if (medium >= short) return "medium";
  return "short";
}

const HORIZON_INTRO: Record<InvestmentHorizon, string> = {
  short: "短期的な値動き・モメンタムの観点で注目",
  medium: "中期的なトレンド継続の観点で注目",
  long: "長期的な株価トレンドの観点で注目",
};

function buildReason(
  technical: TechnicalMetrics | null,
  anomaly: AnomalyMetrics | null,
  divergence: DivergenceMetrics | null,
  horizon: InvestmentHorizon
): string {
  const parts: string[] = [];
  if (divergence && divergence.signal !== "none" && divergence.events[0]) {
    parts.push(divergence.events[0].description);
  }
  if (technical) parts.push(...technical.signals.slice(0, 2));
  if (anomaly?.findings.length) parts.push(anomaly.findings[0].description);

  const detail = parts.slice(0, 3).join("。");
  return detail ? `${HORIZON_INTRO[horizon]}。${detail}。` : `${HORIZON_INTRO[horizon]}。`;
}

async function scanOne(symbol: string): Promise<StockRecommendation | null> {
  try {
    const chart = await yahoo.fetchChart(symbol, "1y");
    if (chart.bars.length < MIN_BARS) return null;

    const technical = analyzeTechnical(chart.bars);
    const anomaly = analyzeAnomaly({ assetType: "US_STOCK", symbol }, chart.bars);
    const divergence = analyzeDivergence(chart.bars);

    const parts: { weight: number; score: number }[] = [];
    if (technical) parts.push({ weight: WEIGHTS.technical, score: technical.score });
    if (anomaly) parts.push({ weight: WEIGHTS.anomaly, score: anomaly.score });
    if (divergence) parts.push({ weight: WEIGHTS.divergence, score: divergence.score });
    if (parts.length === 0) return null;

    const totalWeight = parts.reduce((s, p) => s + p.weight, 0);
    const compositeScore = parts.reduce((s, p) => s + p.weight * p.score, 0) / totalWeight;
    const horizon = inferHorizon(technical, anomaly, divergence);

    return {
      symbol,
      displayName: chart.displayName,
      price: chart.price,
      changePercent: chart.changePercent,
      compositeScore,
      compositeLabel: labelFor(compositeScore),
      horizon,
      reason: buildReason(technical, anomaly, divergence, horizon),
    };
  } catch {
    // One bad/delisted/rate-limited ticker shouldn't sink the whole scan.
    return null;
  }
}

// A full-universe scan (~110 Yahoo Finance calls) is too slow/heavy to
// run per request, and the underlying trend picture doesn't meaningfully
// change within a few hours — cache it like the other dashboard-wide
// panels (market-overview.ts, sector-heatmap.ts, zbt.ts).
const CACHE_TTL_MS = 4 * 60 * 60 * 1000;
let cache: { data: StockRecommendation[]; expiresAt: number } | null = null;

/**
 * Top-scoring stocks across a market-wide universe (BREADTH_UNIVERSE —
 * NOT the caller's watchlist/portfolio), ranked by a technical +
 * anomaly + divergence composite. Purely mechanical; not investment
 * advice, and deliberately excludes fundamentals/sentiment (see WEIGHTS
 * comment above).
 */
export async function getTopRecommendations(limit = 10): Promise<StockRecommendation[]> {
  if (cache && cache.expiresAt > Date.now()) return cache.data.slice(0, limit);

  const results = await mapWithConcurrency(BREADTH_UNIVERSE, CONCURRENCY, scanOne);
  const valid = results.filter((r): r is StockRecommendation => r !== null);
  valid.sort((a, b) => b.compositeScore - a.compositeScore);

  cache = { data: valid, expiresAt: Date.now() + CACHE_TTL_MS };
  return valid.slice(0, limit);
}
