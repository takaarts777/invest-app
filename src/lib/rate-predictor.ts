import "server-only";

import * as yahoo from "@/lib/providers/yahoo";

// The market thesis: the 2-year Treasury yield prices in the *average*
// expected Fed policy rate over the next 2 years, so it tends to move
// ahead of actual FOMC decisions. When it diverges from the current
// short-term rate, that spread is read as the market pricing in future
// cuts (2yr below) or hikes (2yr above).
//
// Data sources (both free, no API key — FRED's direct CSV/API endpoints
// are unreachable from this environment, so this uses Yahoo Finance
// instead, consistent with the rest of the app):
// - 2-year yield: "2YY=F" (CBOT 2-Year Treasury Note Yield futures).
//   Thinly traded — `meta.regularMarketPrice` can be stale for weeks, so
//   "current" is always the latest non-null daily close, not the meta
//   price.
// - Fed policy rate proxy: "^IRX" (13-week T-bill yield). Short T-bills
//   trade almost exactly at the effective fed funds rate, so this is a
//   standard free stand-in for the policy rate itself (which has no
//   tradable Yahoo ticker).

export type RatePoint = { date: string; value: number };

export type RatePredictor = {
  history2y: RatePoint[];
  historyShortRate: RatePoint[];
  current2y: number | null;
  currentShortRate: number | null;
  /** current2y - currentShortRate, in percentage points. */
  spread: number | null;
  signal: "cuts" | "hikes" | "neutral" | null;
};

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
let cache: { data: RatePredictor; expiresAt: number } | null = null;

const EMPTY: RatePredictor = {
  history2y: [],
  historyShortRate: [],
  current2y: null,
  currentShortRate: null,
  spread: null,
  signal: null,
};

// A spread narrower than this (in percentage points) is treated as
// noise rather than a real directional signal.
const NEUTRAL_BAND = 0.25;

export async function getRatePredictor(): Promise<RatePredictor> {
  if (cache && cache.expiresAt > Date.now()) return cache.data;

  const [twoYearResult, shortRateResult] = await Promise.allSettled([
    yahoo.fetchChart("2YY=F", "1y"),
    yahoo.fetchChart("^IRX", "1y"),
  ]);

  const history2y =
    twoYearResult.status === "fulfilled"
      ? twoYearResult.value.bars.map((b) => ({ date: b.date, value: b.close }))
      : [];
  const historyShortRate =
    shortRateResult.status === "fulfilled"
      ? shortRateResult.value.bars.map((b) => ({ date: b.date, value: b.close }))
      : [];

  if (history2y.length === 0 && historyShortRate.length === 0) {
    return EMPTY;
  }

  const current2y = history2y.length ? history2y[history2y.length - 1].value : null;
  const currentShortRate = historyShortRate.length
    ? historyShortRate[historyShortRate.length - 1].value
    : null;

  const spread = current2y !== null && currentShortRate !== null ? current2y - currentShortRate : null;

  let signal: RatePredictor["signal"] = null;
  if (spread !== null) {
    if (spread < -NEUTRAL_BAND) signal = "cuts";
    else if (spread > NEUTRAL_BAND) signal = "hikes";
    else signal = "neutral";
  }

  const data: RatePredictor = {
    history2y,
    historyShortRate,
    current2y,
    currentShortRate,
    spread,
    signal,
  };
  cache = { data, expiresAt: Date.now() + CACHE_TTL_MS };
  return data;
}
