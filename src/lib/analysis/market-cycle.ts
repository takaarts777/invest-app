// Pure, deterministic S&P 500 cycle analysis — no I/O, so it can be
// reasoned about and tested on its own. The fetch + cache lives in
// lib/sp500-cycle.ts (server-only).
//
// Definitions (agreed with the user):
// - A "bottom" is a trough confirmed by a >= THRESHOLD (20%) rise off
//   the lowest close, after a >= THRESHOLD decline from the prior peak
//   (i.e. the conventional bear-market bottom).
// - A completed cycle runs from one bottom to the next peak. Cycles
//   shorter than one year are dropped: those are bear-market rallies
//   inside a larger decline, not the trough-to-top move this is about.
// - The median magnitude (peak / bottom - 1) and median duration are
//   used as the "typical" cycle. Medians rather than means so a single
//   outlier cycle (1987-2000 was +582%) doesn't dominate.
//
// The sample is small (roughly ten completed cycles since 1957), so
// every output here is a rough historical reference, not a forecast.

export type Bar = { date: string; close: number };

export const CYCLE_THRESHOLD = 0.2;
const MIN_CYCLE_YEARS = 1;
const DAYS_PER_YEAR = 365.25;

type Pivot = { date: string; close: number; type: "peak" | "trough" };

/** Percent zigzag: confirms a peak when price falls `thr` below the
 *  running high, and a trough when it rises `thr` above the running low. */
export function turningPoints(bars: Bar[], thr: number): Pivot[] {
  const pts: Pivot[] = [];
  if (bars.length === 0) return pts;

  let mode: "up" | "down" | null = null; // up: tracking a high; down: tracking a low
  let hi = bars[0];
  let lo = bars[0];

  for (const b of bars) {
    if (mode === null) {
      if (b.close > hi.close) hi = b;
      if (b.close < lo.close) lo = b;
      if (b.close <= hi.close * (1 - thr)) {
        pts.push({ date: hi.date, close: hi.close, type: "peak" });
        mode = "down";
        lo = b;
      } else if (b.close >= lo.close * (1 + thr)) {
        pts.push({ date: lo.date, close: lo.close, type: "trough" });
        mode = "up";
        hi = b;
      }
    } else if (mode === "up") {
      if (b.close > hi.close) hi = b;
      if (b.close <= hi.close * (1 - thr)) {
        pts.push({ date: hi.date, close: hi.close, type: "peak" });
        mode = "down";
        lo = b;
      }
    } else {
      if (b.close < lo.close) lo = b;
      if (b.close >= lo.close * (1 + thr)) {
        pts.push({ date: lo.date, close: lo.close, type: "trough" });
        mode = "up";
        hi = b;
      }
    }
  }
  return pts;
}

export type CompletedCycle = {
  bottomDate: string;
  bottomClose: number;
  peakDate: string;
  peakClose: number;
  /** peak / bottom - 1 */
  magnitude: number;
  years: number;
};

export function completedCycles(pivots: Pivot[]): CompletedCycle[] {
  const out: CompletedCycle[] = [];
  for (let i = 0; i < pivots.length - 1; i++) {
    const a = pivots[i];
    const b = pivots[i + 1];
    if (a.type !== "trough" || b.type !== "peak") continue;
    const years = (Date.parse(b.date) - Date.parse(a.date)) / (DAYS_PER_YEAR * 86400000);
    if (years < MIN_CYCLE_YEARS) continue;
    out.push({
      bottomDate: a.date,
      bottomClose: a.close,
      peakDate: b.date,
      peakClose: b.close,
      magnitude: b.close / a.close - 1,
      years,
    });
  }
  return out;
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export type CycleState = {
  bottomDate: string;
  bottomClose: number;
  /** Highest close since the bottom — the current cycle's high so far. */
  cycleHighDate: string;
  cycleHighClose: number;
  /** How far the latest close is below that high, in percent (0 = at high). */
  drawdownFromHighPct: number;
  /** Predicted top = bottom * (1 + median magnitude). */
  predictedTopClose: number;
  predictedTopDate: string;
  /** Where the latest close sits between the bottom and the predicted top. */
  progressPct: number;
  /** Predicted top / latest close - 1, in percent. Negative once price is
   *  already above the historical-median top. */
  upsideToTopPct: number;
  /** Years since the bottom, vs the median cycle length. */
  elapsedYears: number;
  medianYears: number;
  /** False if the latest pivot is a peak — we're in a decline and the
   *  current bottom hasn't been confirmed yet. */
  bottomConfirmed: boolean;
};

export type CycleAnalysis = {
  asOf: string;
  latestClose: number;
  threshold: number;
  sampleSize: number;
  medianMagnitudePct: number | null;
  medianYears: number | null;
  cycles: CompletedCycle[];
  current: CycleState | null;
};

export function analyzeMarketCycle(bars: Bar[], thr = CYCLE_THRESHOLD): CycleAnalysis {
  // The first bar of the series is only a pivot because the zigzag starts
  // there — it isn't a real bottom (1950's start is mid-decline for the
  // 1949 low), so drop it rather than let it count as a cycle start.
  const pivots = turningPoints(bars, thr).filter((p) => p.date !== bars[0].date);
  const cycles = completedCycles(pivots);
  const medMag = median(cycles.map((c) => c.magnitude));
  const medYears = median(cycles.map((c) => c.years));
  const latest = bars[bars.length - 1];
  const last = pivots[pivots.length - 1];

  let current: CycleState | null = null;
  if (last && medMag !== null && medYears !== null) {
    const bottom = last.type === "trough" ? last : pivots.filter((p) => p.type === "trough").at(-1);
    if (bottom) {
      const since = bars.filter((b) => b.date >= bottom.date);
      const high = since.reduce((a, b) => (b.close > a.close ? b : a));
      const predictedTop = bottom.close * (1 + medMag);
      const predictedDate = new Date(
        Date.parse(bottom.date) + medYears * DAYS_PER_YEAR * 86400000
      )
        .toISOString()
        .slice(0, 10);
      const elapsed =
        (Date.parse(latest.date) - Date.parse(bottom.date)) / (DAYS_PER_YEAR * 86400000);
      current = {
        bottomDate: bottom.date,
        bottomClose: bottom.close,
        cycleHighDate: high.date,
        cycleHighClose: high.close,
        drawdownFromHighPct: (1 - latest.close / high.close) * 100,
        predictedTopClose: predictedTop,
        predictedTopDate: predictedDate,
        progressPct: ((latest.close - bottom.close) / (predictedTop - bottom.close)) * 100,
        upsideToTopPct: (predictedTop / latest.close - 1) * 100,
        elapsedYears: elapsed,
        medianYears: medYears,
        bottomConfirmed: last.type === "trough",
      };
    }
  }

  return {
    asOf: latest.date,
    latestClose: latest.close,
    threshold: thr,
    sampleSize: cycles.length,
    medianMagnitudePct: medMag === null ? null : medMag * 100,
    medianYears: medYears,
    cycles,
    current,
  };
}
