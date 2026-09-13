import { RSI, SMA, EMA, MACD, BollingerBands } from "technicalindicators";
import type { DailyBar } from "@/lib/providers/types";

export type TechnicalMetrics = {
  price: number;
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
  ema20: number | null;
  rsi14: number | null;
  macd: { macd: number; signal: number; histogram: number } | null;
  bollinger: { upper: number; middle: number; lower: number; percentB: number } | null;
  /** -1 (strong sell) .. +1 (strong buy), averaged over the signals that
   *  had enough data to compute. */
  score: number;
  /** Human-readable (Japanese) notes for each signal that fired. */
  signals: string[];
};

function last<T>(arr: T[]): T | null {
  return arr.length ? arr[arr.length - 1] : null;
}

export type RsiPoint = { date: string; value: number };

/**
 * Full RSI(period) time series aligned back onto bar dates, for charting
 * (as opposed to analyzeTechnical's single latest-value read used for
 * scoring). RSI.calculate() drops the first `period` bars it needs to
 * seed the average gain/loss, so rsi[i] lines up with bars[period + i].
 */
export function calculateRsiSeries(bars: DailyBar[], period = 14): RsiPoint[] {
  if (bars.length <= period) return [];

  const closes = bars.map((b) => b.close);
  const values = RSI.calculate({ period, values: closes });

  return values.map((value, i) => ({ date: bars[period + i].date, value }));
}

export type SmaPoint = { date: string; value: number };

/**
 * Full SMA(period) time series aligned back onto bar dates, so the
 * price chart can overlay it directly (as opposed to analyzeTechnical's
 * single latest-value read used for scoring/the exit-criteria text).
 * SMA.calculate()'s first output is the average of the first `period`
 * closes, so sma[i] lines up with bars[period - 1 + i].
 */
export function calculateSmaSeries(bars: DailyBar[], period: number): SmaPoint[] {
  if (bars.length < period) return [];

  const closes = bars.map((b) => b.close);
  const values = SMA.calculate({ period, values: closes });

  return values.map((value, i) => ({ date: bars[period - 1 + i].date, value }));
}

/**
 * Rule-based technical read: trend (price vs SMA50/200, golden/death
 * cross), momentum (RSI, MACD histogram), and mean-reversion (Bollinger
 * %B). Returns null when there isn't enough history (needs 20+ bars,
 * ideally 200+ for the long-term trend signals).
 */
export function analyzeTechnical(bars: DailyBar[]): TechnicalMetrics | null {
  if (bars.length < 20) return null;

  const closes = bars.map((b) => b.close);
  const price = closes[closes.length - 1];

  const sma20 = last(SMA.calculate({ period: 20, values: closes }));
  const sma50 =
    bars.length >= 50 ? last(SMA.calculate({ period: 50, values: closes })) : null;
  const sma200 =
    bars.length >= 200 ? last(SMA.calculate({ period: 200, values: closes })) : null;
  const ema20 = last(EMA.calculate({ period: 20, values: closes }));
  const rsi14 =
    bars.length >= 15 ? last(RSI.calculate({ period: 14, values: closes })) : null;
  const macdLast =
    bars.length >= 35
      ? last(
          MACD.calculate({
            values: closes,
            fastPeriod: 12,
            slowPeriod: 26,
            signalPeriod: 9,
            SimpleMAOscillator: false,
            SimpleMASignal: false,
          })
        )
      : null;
  const bbLast =
    bars.length >= 20
      ? last(BollingerBands.calculate({ period: 20, values: closes, stdDev: 2 }))
      : null;

  let score = 0;
  let signalCount = 0;
  const signals: string[] = [];

  if (sma50 !== null) {
    signalCount++;
    if (price > sma50) {
      score += 1;
      signals.push("価格が50日移動平均線より上（上昇トレンド）");
    } else {
      score -= 1;
      signals.push("価格が50日移動平均線より下（下降トレンド）");
    }
  }

  if (sma200 !== null) {
    signalCount++;
    if (price > sma200) {
      score += 1;
      signals.push("価格が200日移動平均線より上（長期上昇トレンド）");
    } else {
      score -= 1;
      signals.push("価格が200日移動平均線より下（長期下降トレンド）");
    }
  }

  if (sma50 !== null && sma200 !== null) {
    signalCount++;
    if (sma50 > sma200) {
      score += 1;
      signals.push("ゴールデンクロス状態（50日線が200日線より上）");
    } else {
      score -= 1;
      signals.push("デッドクロス状態（50日線が200日線より下）");
    }
  }

  if (rsi14 !== null) {
    signalCount++;
    if (rsi14 < 30) {
      score += 1;
      signals.push(`RSIが${rsi14.toFixed(1)}で売られすぎ水準`);
    } else if (rsi14 > 70) {
      score -= 1;
      signals.push(`RSIが${rsi14.toFixed(1)}で買われすぎ水準`);
    } else {
      signals.push(`RSIは${rsi14.toFixed(1)}で中立`);
    }
  }

  if (macdLast?.histogram !== undefined) {
    signalCount++;
    if (macdLast.histogram > 0) {
      score += 1;
      signals.push("MACDヒストグラムがプラス（上昇モメンタム）");
    } else {
      score -= 1;
      signals.push("MACDヒストグラムがマイナス（下降モメンタム）");
    }
  }

  if (bbLast) {
    signalCount++;
    if (bbLast.pb < 0.1) {
      score += 1;
      signals.push("ボリンジャーバンド下限付近（売られすぎの可能性）");
    } else if (bbLast.pb > 0.9) {
      score -= 1;
      signals.push("ボリンジャーバンド上限付近（買われすぎの可能性）");
    }
  }

  return {
    price,
    sma20,
    sma50,
    sma200,
    ema20,
    rsi14,
    macd:
      macdLast?.MACD !== undefined &&
      macdLast.signal !== undefined &&
      macdLast.histogram !== undefined
        ? { macd: macdLast.MACD, signal: macdLast.signal, histogram: macdLast.histogram }
        : null,
    bollinger: bbLast
      ? { upper: bbLast.upper, middle: bbLast.middle, lower: bbLast.lower, percentB: bbLast.pb }
      : null,
    score: signalCount > 0 ? score / signalCount : 0,
    signals,
  };
}
