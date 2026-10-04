import "server-only";

import * as yahoo from "@/lib/providers/yahoo";
import { BREADTH_UNIVERSE } from "@/lib/data/breadth-universe";
import { getSp500Cycle } from "@/lib/sp500-cycle";
import { decideZbtSignal, DRAWDOWN_TRIGGER_PCT, ZBT_LEVEL, GATE_MIN_UPSIDE_PCT, type ZbtSignalState } from "@/lib/analysis/zbt-signal";

export { DRAWDOWN_TRIGGER_PCT, ZBT_LEVEL, GATE_MIN_UPSIDE_PCT };

// Zweig Breadth Thrust: a 10-day EMA of (advancing issues / total issues)
// across the market. See breadth-universe.ts for the caveat on the stock
// sample used here vs. the real NYSE/S&P 500 feed.
//
// Buy signal (as specified by the user):
//   1. The S&P 500 has fallen >= DRAWDOWN_TRIGGER_PCT from the high of its
//      current cycle (see lib/analysis/market-cycle.ts), AND
//   2. The ZBT EMA has come down to <= ZBT_LEVEL, AND
//   3. The cycle gate is open: the historical-median top is still more
//      than GATE_MIN_UPSIDE_PCT above the current price. If not, the
//      conditions are met but the signal is "suppressed" — shown, not fired.
// This replaces the earlier "dip below 0.40, then pop above 0.615" rule.

export type ZbtPoint = { date: string; ratio: number; ema: number };

export type ZbtSignal = ZbtSignalState;

export type ZbtResult = {
  /** Recent EMA history for charting. */
  series: ZbtPoint[];
  latestEma: number | null;
  signal: ZbtSignal;
  /** Most recent date the EMA closed at or below ZBT_LEVEL. */
  dipDate: string | null;
  universeSize: number;
  sampledSize: number;
  /** The S&P 500 side of the signal, so the UI can show why it fired
   *  (or didn't). Null if the cycle data couldn't be loaded. */
  sp500: {
    /** Drawdown of the latest close from the current cycle's high, in %. */
    drawdownPct: number | null;
    drawdownReached: boolean;
    /** Upside from the latest close to the historical-median cycle top, in %. */
    upsideToTopPct: number | null;
    gateOpen: boolean;
    predictedTopClose: number | null;
    predictedTopDate: string | null;
  } | null;
};

const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours — this is an end-of-day breadth measure
let cache: { data: ZbtResult; expiresAt: number } | null = null;

const EMA_PERIOD = 10;
const OUTPUT_LOOKBACK_DAYS = 45;

const EMPTY: ZbtResult = {
  series: [],
  latestEma: null,
  signal: "none",
  dipDate: null,
  universeSize: BREADTH_UNIVERSE.length,
  sampledSize: 0,
  sp500: null,
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
  const latestEma = recent.length ? recent[recent.length - 1].ema : null;
  const dipDate = [...recent].reverse().find((p) => p.ema <= ZBT_LEVEL)?.date ?? null;

  // S&P 500 side. A failure here shouldn't take the whole ZBT panel down —
  // it just means no S&P context, so the signal can't fire.
  const cycle = await getSp500Cycle().catch(() => null);
  const current = cycle?.current ?? null;
  const drawdownPct = current ? current.drawdownFromHighPct : null;
  const upsideToTopPct = current ? current.upsideToTopPct : null;
  const { signal, drawdownReached, gateOpen } = decideZbtSignal({ drawdownPct, latestEma, upsideToTopPct });

  const data: ZbtResult = {
    series: recent,
    latestEma,
    signal,
    dipDate,
    universeSize: BREADTH_UNIVERSE.length,
    sampledSize: perSymbolCloses.length,
    sp500: cycle
      ? {
          drawdownPct,
          drawdownReached,
          upsideToTopPct,
          gateOpen,
          predictedTopClose: current?.predictedTopClose ?? null,
          predictedTopDate: current?.predictedTopDate ?? null,
        }
      : null,
  };

  cache = { data, expiresAt: Date.now() + CACHE_TTL_MS };
  return data;
}
