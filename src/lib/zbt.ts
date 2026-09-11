import "server-only";

import * as yahoo from "@/lib/providers/yahoo";
import { BREADTH_UNIVERSE } from "@/lib/data/breadth-universe";

// Zweig Breadth Thrust: a 10-day EMA of (advancing issues / total issues)
// across the market. A "thrust" (bullish) signal fires when this EMA
// moves from below 0.40 to above 0.615 within 10 trading days — a rare,
// historically strong bullish breadth signal. See breadth-universe.ts for
// the caveat on the stock sample used here vs. the real NYSE/S&P 500 feed.

export type ZbtPoint = { date: string; ratio: number; ema: number };

export type ZbtSignal = "fired" | "waiting" | "none";

export type ZbtResult = {
  /** Recent EMA history for charting. */
  series: ZbtPoint[];
  latestEma: number | null;
  signal: ZbtSignal;
  /** Most recent date the EMA closed below 0.40, if any. */
  dipDate: string | null;
  /** Date the EMA closed above 0.615 after that dip, if it happened. */
  popDate: string | null;
  universeSize: number;
  sampledSize: number;
};

const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours — this is an end-of-day breadth measure
let cache: { data: ZbtResult; expiresAt: number } | null = null;

const EMA_PERIOD = 10;
const LOWER_THRESHOLD = 0.4;
const UPPER_THRESHOLD = 0.615;
const WINDOW_TRADING_DAYS = 10;
const OUTPUT_LOOKBACK_DAYS = 45;

const EMPTY: ZbtResult = {
  series: [],
  latestEma: null,
  signal: "none",
  dipDate: null,
  popDate: null,
  universeSize: BREADTH_UNIVERSE.length,
  sampledSize: 0,
};

export async function getZbtIndicator(): Promise<ZbtResult> {
  if (cache && cache.expiresAt > Date.now()) return cache.data;

  const results = await Promise.allSettled(
    BREADTH_UNIVERSE.map((s) => yahoo.fetchChart(s, "3mo"))
  );

  const perSymbolCloses: { date: string; close: number }[][] = [];
  for (const r of results) {
    if (r.status === "fulfilled" && r.value.bars.length > 5) {
      perSymbolCloses.push(r.value.bars.map((b) => ({ date: b.date, close: b.close })));
    }
  }

  if (perSymbolCloses.length < BREADTH_UNIVERSE.length * 0.5) {
    // Too many lookups failed to trust the sample for a real signal.
    return { ...EMPTY, sampledSize: perSymbolCloses.length };
  }

  const dateSet = new Set<string>();
  for (const series of perSymbolCloses) for (const p of series) dateSet.add(p.date);
  const dates = Array.from(dateSet).sort();

  const closeMaps = perSymbolCloses.map((series) => {
    const m = new Map<string, number>();
    for (const p of series) m.set(p.date, p.close);
    return m;
  });

  // Daily advance ratio: advancing issues / issues with data on both this
  // day and the prior day (so a stock missing one day doesn't skew it).
  const ratios: { date: string; ratio: number }[] = [];
  for (let i = 1; i < dates.length; i++) {
    const date = dates[i];
    const prevDate = dates[i - 1];
    let advances = 0;
    let total = 0;
    for (const m of closeMaps) {
      const c = m.get(date);
      const p = m.get(prevDate);
      if (c !== undefined && p !== undefined) {
        total++;
        if (c > p) advances++;
      }
    }
    if (total >= Math.floor(BREADTH_UNIVERSE.length * 0.5)) {
      ratios.push({ date, ratio: advances / total });
    }
  }

  const k = 2 / (EMA_PERIOD + 1);
  const series: ZbtPoint[] = [];
  let ema: number | null = null;
  for (const r of ratios) {
    ema = ema === null ? r.ratio : r.ratio * k + ema * (1 - k);
    series.push({ date: r.date, ratio: r.ratio, ema });
  }

  const recent = series.slice(-OUTPUT_LOOKBACK_DAYS);

  // Scan backward for the most recent qualifying dip, then look forward
  // (within the thrust window) for a pop above the upper threshold.
  let dipDate: string | null = null;
  let popDate: string | null = null;
  let signal: ZbtSignal = "none";

  for (let i = recent.length - 1; i >= 0; i--) {
    if (recent[i].ema < LOWER_THRESHOLD) {
      dipDate = recent[i].date;
      const dipIndex = i;
      for (let j = dipIndex + 1; j <= Math.min(dipIndex + WINDOW_TRADING_DAYS, recent.length - 1); j++) {
        if (recent[j].ema >= UPPER_THRESHOLD) {
          popDate = recent[j].date;
          break;
        }
      }
      if (popDate) {
        signal = "fired";
      } else {
        const daysSinceDip = recent.length - 1 - dipIndex;
        signal = daysSinceDip <= WINDOW_TRADING_DAYS ? "waiting" : "none";
      }
      break;
    }
  }

  const data: ZbtResult = {
    series: recent,
    latestEma: recent.length ? recent[recent.length - 1].ema : null,
    signal,
    dipDate,
    popDate,
    universeSize: BREADTH_UNIVERSE.length,
    sampledSize: perSymbolCloses.length,
  };

  cache = { data, expiresAt: Date.now() + CACHE_TTL_MS };
  return data;
}
