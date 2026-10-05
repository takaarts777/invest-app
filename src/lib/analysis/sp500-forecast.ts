// Forecast of the S&P 500's rise over the two years after a buy-signal
// setup, using S&P 500 history since the 2009 bottom (the current bull).
//
// Setup (index-only, because a historical breadth series for ZBT isn't
// available): the index is down >= DRAWDOWN_TRIGGER_PCT from its running
// cycle high AND its daily RSI(14) <= RSI_LEVEL. Each episode of that
// condition is one historical event, taken at its first day. Episodes
// closer than EPISODE_GAP_DAYS trading days merge into one. For each event,
// the rise to the highest close within the next two years (504 trading
// days) is recorded. Events without a full two-year window are dropped.
//
// The running cycle high uses a causal 20% zigzag: the high is reset at
// each confirmed trough, and within a decline it's the last peak. So the
// same definition is used for the historical events and the current drawdown.
import { RSI } from "technicalindicators";

export type Bar = { date: string; close: number };

export const BULL_START = "2009-03-09";
export const DRAWDOWN_TRIGGER_PCT = 19.61; // median pre-signal decline, 9 historical ZBT signals
export const RSI_LEVEL = 30;
export const FORWARD_TRADING_DAYS = 504; // two years
export const EPISODE_GAP_DAYS = 60;
const TURN_THRESHOLD = 0.2;
const DAYS_PER_YEAR = 365.25;

export type ForecastEvent = {
  date: string;
  close: number;
  /** Rise to the highest close within the next two years, in %. */
  riseToPeakPct: number;
  /** Trading days from the event to that highest close. */
  daysToPeak: number;
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
  const rsiOffset = closes.length - rsi.length; // rsi[i - rsiOffset] belongs to bar i

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

  // Setup condition per day, and episodes of consecutive/near-consecutive setups.
  const flags = bars.map((_, i) => {
    const r = i - rsiOffset >= 0 ? rsi[i - rsiOffset] : null;
    return drawdowns[i] >= DRAWDOWN_TRIGGER_PCT && r !== null && r <= RSI_LEVEL;
  });

  const bullIdx = Math.max(1, bars.findIndex((b) => b.date >= BULL_START));
  const episodeStarts: number[] = [];
  let lastTrue = -Infinity;
  for (let i = bullIdx; i < bars.length; i++) {
    if (!flags[i]) continue;
    if (i - lastTrue > EPISODE_GAP_DAYS) episodeStarts.push(i);
    lastTrue = i;
  }

  const events: ForecastEvent[] = [];
  for (const i of episodeStarts) {
    const end = i + FORWARD_TRADING_DAYS;
    if (end > bars.length - 1) continue; // needs the full two years
    let maxC = -Infinity;
    let maxIdx = i;
    for (let j = i + 1; j <= end; j++) {
      if (closes[j] > maxC) { maxC = closes[j]; maxIdx = j; }
    }
    events.push({
      date: bars[i].date,
      close: closes[i],
      riseToPeakPct: (maxC / closes[i] - 1) * 100,
      daysToPeak: maxIdx - i,
    });
  }

  const latest = bars[bars.length - 1];
  const latestIdx = bars.length - 1;
  const medRise = median(events.map((e) => e.riseToPeakPct));
  const medDays = median(events.map((e) => e.daysToPeak));
  const predicted = medRise === null ? null : latest.close * (1 + medRise / 100);
  const predictedDate =
    medDays === null
      ? null
      : new Date(Date.parse(latest.date) + (medDays / 252) * DAYS_PER_YEAR * 86400000)
          .toISOString()
          .slice(0, 10);

  return {
    asOf: latest.date,
    latestClose: latest.close,
    drawdownFromHighPct: drawdowns[latestIdx],
    cycleHighClose: cycleHighs[latestIdx],
    rsi14: rsi.length ? rsi[rsi.length - 1] : null,
    events,
    sampleSize: events.length,
    medianRisePct: medRise,
    medianDaysToPeak: medDays,
    predictedHighClose: predicted,
    differencePoints: predicted === null ? null : predicted - latest.close,
    upsidePct: predicted === null ? null : (predicted / latest.close - 1) * 100,
    predictedHighDate: predictedDate,
  };
}
