import { RSI } from "technicalindicators";
import type { DailyBar } from "@/lib/providers/types";

export type DivergenceSignal = "bullish" | "bearish" | "none";

export type DivergenceEvent = {
  signal: "bullish" | "bearish";
  fromDate: string;
  toDate: string;
  fromPrice: number;
  toPrice: number;
  fromRsi: number;
  toRsi: number;
  description: string;
};

export type DivergenceMetrics = {
  /** The most recent event within the lookback window, or "none" if no
   *  divergence was found. This is the headline read shown as a badge. */
  signal: DivergenceSignal;
  /** -1 (bearish) .. +1 (bullish), 0 when signal is "none" — contributes
   *  to the composite score as its own axis (see analysis/signal.ts). */
  score: number;
  /** Every divergence found within the lookback window, most recent
   *  first (capped at MAX_EVENTS) — not just the latest one, so the
   *  section can show a short history rather than a single verdict. */
  events: DivergenceEvent[];
};

// A swing point must be higher/lower than this many bars on *each* side
// to count as a confirmed pivot (filters noise; means a pivot can only be
// recognized once it's this many trading days in the past).
const PIVOT_WINDOW = 5;
// Only look at pivots within this many trading days, so the read stays
// relevant to current conditions (~3 months).
const LOOKBACK_DAYS = 60;
// Cap how many past events are kept for display.
const MAX_EVENTS = 5;
// Magnitude of a detected divergence's contribution to its own axis score
// (full ±1 would treat one occasional signal as equivalent to strong
// unanimous reads across every technical indicator, which overstates it).
const SIGNAL_MAGNITUDE = 0.6;

type PricePivot = { index: number; date: string; price: number; rsi: number };

/** Confirmed local price highs/lows, paired with RSI's value at that same
 *  bar so the two series can be compared point-for-point. */
function findPricePivots(
  bars: DailyBar[],
  closes: number[],
  rsiArr: number[],
  rsiOffset: number,
  kind: "high" | "low",
  window: number
): PricePivot[] {
  const pivots: PricePivot[] = [];
  for (let i = window; i < closes.length - window; i++) {
    const slice = closes.slice(i - window, i + window + 1);
    const isPivot =
      kind === "high" ? closes[i] === Math.max(...slice) : closes[i] === Math.min(...slice);
    if (!isPivot) continue;

    const rsiIdx = i - rsiOffset;
    if (rsiIdx < 0 || rsiIdx >= rsiArr.length) continue;

    pivots.push({ index: i, date: bars[i].date, price: closes[i], rsi: rsiArr[rsiIdx] });
  }
  return pivots;
}

/**
 * RSI/price divergence over the recent history: bearish divergence is
 * price making a higher high while RSI makes a lower high (momentum not
 * confirming the new high); bullish is the mirror image at swing lows.
 * Unlike a single latest-pivots-only check, this scans every consecutive
 * pivot pair in the lookback window so a short history of past
 * occurrences can be shown alongside the current read.
 */
export function analyzeDivergence(bars: DailyBar[]): DivergenceMetrics | null {
  if (bars.length < 30) return null;

  const closes = bars.map((b) => b.close);
  const rsiArr = RSI.calculate({ period: 14, values: closes });
  const offset = closes.length - rsiArr.length;

  if (rsiArr.length <= PIVOT_WINDOW * 2 + 2) {
    return { signal: "none", score: 0, events: [] };
  }

  const recentStart = Math.max(0, closes.length - LOOKBACK_DAYS);
  const highs = findPricePivots(bars, closes, rsiArr, offset, "high", PIVOT_WINDOW).filter(
    (p) => p.index >= recentStart
  );
  const lows = findPricePivots(bars, closes, rsiArr, offset, "low", PIVOT_WINDOW).filter(
    (p) => p.index >= recentStart
  );

  const events: DivergenceEvent[] = [];

  for (let i = 1; i < highs.length; i++) {
    const a = highs[i - 1];
    const b = highs[i];
    if (b.price > a.price && b.rsi < a.rsi) {
      events.push({
        signal: "bearish",
        fromDate: a.date,
        toDate: b.date,
        fromPrice: a.price,
        toPrice: b.price,
        fromRsi: a.rsi,
        toRsi: b.rsi,
        description: `${a.date}→${b.date}で価格は高値更新(${a.price.toFixed(2)}→${b.price.toFixed(
          2
        )})したが、RSIは逆に低下(${a.rsi.toFixed(1)}→${b.rsi.toFixed(
          1
        )})。上昇モメンタムの鈍化を示唆し、反落に注意。`,
      });
    }
  }

  for (let i = 1; i < lows.length; i++) {
    const a = lows[i - 1];
    const b = lows[i];
    if (b.price < a.price && b.rsi > a.rsi) {
      events.push({
        signal: "bullish",
        fromDate: a.date,
        toDate: b.date,
        fromPrice: a.price,
        toPrice: b.price,
        fromRsi: a.rsi,
        toRsi: b.rsi,
        description: `${a.date}→${b.date}で価格は安値更新(${a.price.toFixed(2)}→${b.price.toFixed(
          2
        )})したが、RSIは逆に上昇(${a.rsi.toFixed(1)}→${b.rsi.toFixed(
          1
        )})。下落モメンタムの鈍化を示唆し、反発の可能性。`,
      });
    }
  }

  events.sort((x, y) => y.toDate.localeCompare(x.toDate));
  const capped = events.slice(0, MAX_EVENTS);

  const latest = capped[0] ?? null;
  const signal: DivergenceSignal = latest?.signal ?? "none";
  const score = signal === "bearish" ? -SIGNAL_MAGNITUDE : signal === "bullish" ? SIGNAL_MAGNITUDE : 0;

  return { signal, score, events: capped };
}
