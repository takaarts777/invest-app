// Forecast of the S&P 500's rise over the two years after a ZBT signal,
// based on the nine historical ZBT signals listed by the user, each with
// the decline from its cycle high to the low before the signal.
//
// The table gives only years, not dates. Each entry is placed on the first
// trading day of its year whose drawdown from the running cycle high reaches
// the listed decline. RSI is not part of the historical match. Two entries
// share a date (2023) and count once. Entries with no matching day, or whose
// two-year window isn't complete, are left out. For each remaining event,
// the rise to the highest close within the next 504 trading days is recorded.
//
// The running cycle high uses a causal 20% zigzag: it resets at each
// confirmed trough, and within a decline it's the last peak. The same
// definition is used for the historical matches and the current drawdown.
import { RSI } from "technicalindicators";

export type Bar = { date: string; close: number };

export type HistoricalSignal = { year: number; declinePct: number; knownDate?: string };

// The user's table: the decline from high to pre-signal low, per ZBT signal.
export const HISTORICAL_ZBT_SIGNALS: HistoricalSignal[] = [
  { year: 1950, declinePct: 14.02 },
  { year: 1962, declinePct: 27.97 },
  { year: 1962, declinePct: 26.36 },
  { year: 1982, declinePct: 27.12 },
  { year: 1984, declinePct: 14.38 },
  { year: 2019, declinePct: 19.78 },
  // The user confirmed a 2023 signal on 2023-03-31 (2-year rise 49.52%). Which of
  // the two 2023 entries it is hasn't been confirmed; it is assigned to the 19.61% row.
  { year: 2023, declinePct: 19.61, knownDate: "2023-03-31" },
  { year: 2023, declinePct: 14.16 },
  { year: 2025, declinePct: 18.9, knownDate: "2025-04-24" }, // signal date confirmed by the user; its 2-year window ends 2027-04-24
];

export const DRAWDOWN_TRIGGER_PCT = 19.61; // median of the table, used by the live signal
export const FORWARD_TRADING_DAYS = 504; // two years
const TURN_THRESHOLD = 0.2;
const DAYS_PER_YEAR = 365.25;

export type ForecastEvent = {
  date: string;
  close: number;
  /** Rise to the highest close within the next two years, in %. */
  riseToPeakPct: number;
  /** Trading days from the event to that highest close. */
  daysToPeak: number;
  /** Years listed in the source table for this event. */
  listedYear: number;
  listedDeclinePct: number;
};

export type Sp500Forecast = {
  asOf: string;
  latestClose: number;
  /** Current drawdown from the running cycle high, in %. */
  drawdownFromHighPct: number;
  /** Current cycle high (for display). */
  cycleHighClose: number;
  rsi14: number | null;
  events: ForecastEvent[];
  /** Table entries with no matching day, or no complete two-year window. */
  excluded: { year: number; declinePct: number; reason: string }[];
  sampleSize: number;
  medianRisePct: number | null;
  medianDaysToPeak: number | null;
  predictedHighClose: number | null;
  /** predicted high minus latest close, in index points */
  differencePoints: number | null;
  /** predicted rise from the latest close to the predicted high, in % */
  upsidePct: number | null;
  /** Approximate calendar date of the predicted high. */
  predictedHighDate: string | null;
  /** A confirmed signal whose two-year window hasn't finished yet: its close
   *  and the level the median rise implies for two years later. */
  pendingSignal: { date: string; close: number; targetDate: string; targetClose: number | null } | null;
};

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function analyzeSp500Forecast(bars: Bar[]): Sp500Forecast {
  const closes = bars.map((b) => b.close);
  const rsi = RSI.calculate({ period: 14, values: closes });

  // Causal running cycle high (see header).
  const drawdowns: number[] = [];
  const cycleHighs: number[] = [];
  let mode: "up" | "down" | null = null;
  let hi = bars[0];
  let lo = bars[0];
  let refHigh = bars[0].close;
  for (let i = 0; i < bars.length; i++) {
    const c = bars[i].close;
    if (mode === null) {
      if (c > hi.close) hi = bars[i];
      if (c < lo.close) lo = bars[i];
      if (c <= hi.close * (1 - TURN_THRESHOLD)) { mode = "down"; lo = bars[i]; refHigh = hi.close; }
      else if (c >= lo.close * (1 + TURN_THRESHOLD)) { mode = "up"; hi = bars[i]; refHigh = hi.close; }
      else refHigh = hi.close;
    } else if (mode === "up") {
      if (c > hi.close) hi = bars[i];
      refHigh = hi.close;
      if (c <= hi.close * (1 - TURN_THRESHOLD)) { mode = "down"; lo = bars[i]; }
    } else {
      if (c < lo.close) lo = bars[i];
      if (c >= lo.close * (1 + TURN_THRESHOLD)) { mode = "up"; hi = bars[i]; refHigh = hi.close; }
    }
    cycleHighs.push(refHigh);
    drawdowns.push((1 - c / refHigh) * 100);
  }

  // Match each table entry to the first trading day of its year that reaches its decline.
  const events: ForecastEvent[] = [];
  const pending: { date: string; close: number }[] = [];
  const excluded: Sp500Forecast["excluded"] = [];
  const usedDates = new Set<string>();
  const latestIdx = bars.length - 1;

  for (const sig of HISTORICAL_ZBT_SIGNALS) {
    const idx = sig.knownDate
      ? bars.findIndex((b) => b.date === sig.knownDate)
      : bars.findIndex(
          (b, i) => b.date.startsWith(String(sig.year)) && drawdowns[i] >= sig.declinePct
        );
    if (idx < 0 && sig.knownDate) {
      excluded.push({ ...sig, reason: "指定日がデータ上に無い" });
      continue;
    }
    if (idx < 0) {
      excluded.push({ ...sig, reason: "同年に該当する下落日がデータ上に見当たらない" });
      continue;
    }
    if (usedDates.has(bars[idx].date)) continue; // e.g. the two 2023 entries share a day
    usedDates.add(bars[idx].date);

    const end = idx + FORWARD_TRADING_DAYS;
    if (end > latestIdx) {
      excluded.push({ ...sig, reason: "発動から2年分のデータが揃っていない" });
      pending.push({ date: bars[idx].date, close: closes[idx] });
      continue;
    }
    let maxC = -Infinity;
    let maxIdx = idx;
    for (let j = idx + 1; j <= end; j++) {
      if (closes[j] > maxC) { maxC = closes[j]; maxIdx = j; }
    }
    events.push({
      date: bars[idx].date,
      close: closes[idx],
      riseToPeakPct: (maxC / closes[idx] - 1) * 100,
      daysToPeak: maxIdx - idx,
      listedYear: sig.year,
      listedDeclinePct: sig.declinePct,
    });
  }

  const latest = bars[latestIdx];
  const medRise = median(events.map((e) => e.riseToPeakPct));
  const medDays = median(events.map((e) => e.daysToPeak));

  // The predicted high is anchored on the most recent confirmed signal (its
  // two-year target), so the target date matches the signal, not today.
  const pendingRaw = pending.length ? pending[0] : null;
  const anchored = pendingRaw && medRise !== null ? pendingRaw.close * (1 + medRise / 100) : null;
  const anchoredDate = pendingRaw
    ? new Date(Date.parse(pendingRaw.date) + 2 * DAYS_PER_YEAR * 86400000).toISOString().slice(0, 10)
    : null;
  const predicted = anchored ?? (medRise === null ? null : latest.close * (1 + medRise / 100));
  const predictedDate =
    anchoredDate ??
    (medDays === null
      ? null
      : new Date(Date.parse(latest.date) + (medDays / 252) * DAYS_PER_YEAR * 86400000)
          .toISOString()
          .slice(0, 10));

  return {
    asOf: latest.date,
    latestClose: latest.close,
    drawdownFromHighPct: drawdowns[latestIdx],
    cycleHighClose: cycleHighs[latestIdx],
    rsi14: rsi.length ? rsi[rsi.length - 1] : null,
    events,
    excluded,
    sampleSize: events.length,
    medianRisePct: medRise,
    medianDaysToPeak: medDays,
    predictedHighClose: predicted,
    differencePoints: predicted === null ? null : predicted - latest.close,
    upsidePct: predicted === null ? null : (predicted / latest.close - 1) * 100,
    predictedHighDate: predictedDate,
    pendingSignal:
      pending.length === 0
        ? null
        : {
            date: pendingRaw!.date,
            close: pendingRaw!.close,
            targetDate: anchoredDate!,
            targetClose: anchored,
          },
  };
}
