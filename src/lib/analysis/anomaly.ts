import { RSI } from "technicalindicators";
import type { WatchlistItem } from "@prisma/client";
import type { DailyBar } from "@/lib/providers/types";

export type AnomalySeverity = "info" | "opportunity" | "warning" | "alert";

export type AnomalyFinding = {
  type: string;
  description: string;
  severity: AnomalySeverity;
};

export type AnomalyMetrics = {
  /** -1 (bearish/risk) .. +1 (bullish) — only findings that imply a
   *  directional read contribute; purely informational findings (e.g.
   *  calendar effects) are listed but don't move the score. */
  score: number;
  findings: AnomalyFinding[];
};

// Common leveraged/inverse ETFs and their approximate daily leverage
// multiple (negative = inverse). Best-effort lookup — anything not listed
// falls back to an assumed 2x for the decay estimate below.
const LEVERAGE_MAP: Record<string, number> = {
  TQQQ: 3, SQQQ: -3, SOXL: 3, SOXS: -3, SPXL: 3, SPXU: -3, UPRO: 3, SPXS: -3,
  TNA: 3, TZA: -3, LABU: 3, LABD: -3, FNGU: 3, FNGD: -3, TECL: 3, TECS: -3,
  UDOW: 3, SDOW: -3, DRN: 3, DRV: -3,
  SSO: 2, SDS: -2, QLD: 2, QID: -2, DDM: 2, DXD: -2, UWM: 2, TWM: -2,
  ROM: 2, REW: -2, UYG: 2, SKF: -2,
};

function mean(values: number[]): number {
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function stddev(values: number[]): number {
  const m = mean(values);
  const variance = mean(values.map((v) => (v - m) ** 2));
  return Math.sqrt(variance);
}

/**
 * Rule-based anomaly scan over price/volume history:
 * volume & price spikes, calendar effects, leveraged-ETF volatility decay,
 * statistical deviation from the 20-day average, and an RSI-trough
 * historical comparison. RSI/price divergence used to live here too but
 * is now its own axis — see analysis/divergence.ts. Returns null when
 * there isn't enough history.
 */
export function analyzeAnomaly(
  item: WatchlistItem,
  bars: DailyBar[]
): AnomalyMetrics | null {
  if (bars.length < 30) return null;

  const findings: AnomalyFinding[] = [];
  let score = 0;
  let n = 0;

  const closes = bars.map((b) => b.close);
  const returns = closes.slice(1).map((c, i) => (c - closes[i]) / closes[i]);

  // 1. Volume spike (z-score of latest volume vs trailing 20 days).
  const volumes = bars.map((b) => b.volume);
  if (volumes.length >= 21 && volumes.every((v) => v > 0)) {
    const window = volumes.slice(-21, -1);
    const sd = stddev(window);
    if (sd > 0) {
      const z = (volumes[volumes.length - 1] - mean(window)) / sd;
      if (Math.abs(z) > 2) {
        findings.push({
          type: "volume_spike",
          description: `出来高が直近20日平均から${z.toFixed(1)}σ乖離（急増）`,
          severity: "warning",
        });
      }
    }
  }

  // 2. Price move spike (z-score of latest daily return vs trailing 20 days).
  if (returns.length >= 21) {
    const window = returns.slice(-21, -1);
    const sd = stddev(window);
    if (sd > 0) {
      const latest = returns[returns.length - 1];
      const z = (latest - mean(window)) / sd;
      if (Math.abs(z) > 2) {
        n++;
        score += z > 0 ? 0.3 : -0.3; // a sudden move can precede continuation or reversal; treat mildly
        findings.push({
          type: "price_spike",
          description: `直近の値動きが急変（前日比${(latest * 100).toFixed(1)}%、${z.toFixed(1)}σ）`,
          severity: "warning",
        });
      }
    }
  }

  // 3. Calendar effect (informational only — no score impact).
  const lastDate = new Date(bars[bars.length - 1].date + "T00:00:00Z");
  const dayOfMonth = lastDate.getUTCDate();
  const daysInMonth = new Date(
    Date.UTC(lastDate.getUTCFullYear(), lastDate.getUTCMonth() + 1, 0)
  ).getUTCDate();
  if (dayOfMonth <= 3) {
    findings.push({
      type: "calendar",
      description: "月初（一般に機関投資家のリバランス買いが入りやすいとされる時期）",
      severity: "info",
    });
  } else if (dayOfMonth >= daysInMonth - 2) {
    findings.push({
      type: "calendar",
      description: "月末（ポートフォリオ調整の売買が入りやすいとされる時期）",
      severity: "info",
    });
  }

  // 4. Leveraged ETF volatility decay risk.
  if (item.assetType === "LEVERAGED_ETF") {
    const leverage = Math.abs(LEVERAGE_MAP[item.symbol] ?? 2);
    const window = returns.slice(-60);
    if (window.length >= 20) {
      const dailyVol = stddev(window);
      const annualizedVol = dailyVol * Math.sqrt(252);
      // Standard variance-drag approximation for a daily-rebalanced
      // leveraged fund: annual drag ≈ 0.5 * L * (L-1) * σ².
      const decayDrag = 0.5 * leverage * (leverage - 1) * annualizedVol ** 2;
      n++;
      score -= Math.min(decayDrag, 1); // long-term negative regardless of direction
      findings.push({
        type: "leverage_decay",
        description: `レバレッジ${leverage}倍(推定)・直近の年率ボラティリティ${(annualizedVol * 100).toFixed(
          0
        )}%を単純な近似式(0.5×L×(L-1)×σ²)に当てはめると、理論上の減価(ボラティリティドラッグ)は年率換算で約${(decayDrag * 100).toFixed(
          1
        )}%相当。実際の減価はレンジ相場か一方向トレンドかで大きく変わる粗い目安だが、値が大きいほど長期保有には不利。`,
        severity: decayDrag > 0.15 ? "warning" : "info",
      });
    }
  }

  // 5. Statistical deviation from the 20-day moving average.
  if (closes.length >= 20) {
    const window = closes.slice(-20);
    const sd = stddev(window);
    if (sd > 0) {
      const z = (closes[closes.length - 1] - mean(window)) / sd;
      if (Math.abs(z) > 2) {
        n++;
        score += z > 0 ? -0.5 : 0.5; // extreme deviation → mean-reversion risk either way
        findings.push({
          type: "deviation",
          description: `20日移動平均から${z.toFixed(1)}σ乖離。平均回帰の可能性`,
          severity: "warning",
        });
      }
    }
  }

  // 6. RSI-trough historical comparison: when RSI last dropped below 30,
  // what did price do over the following ~20 trading days, historically?
  const rsiArr = RSI.calculate({ period: 14, values: closes });
  const offset = closes.length - rsiArr.length;
  if (rsiArr.length > 40) {
    const forwardReturns: number[] = [];
    let inTrough = false;
    for (let i = 0; i < rsiArr.length; i++) {
      if (rsiArr[i] < 30 && !inTrough) {
        inTrough = true;
        const barIdx = i + offset;
        const futureIdx = barIdx + 20;
        if (futureIdx < closes.length) {
          forwardReturns.push((closes[futureIdx] - closes[barIdx]) / closes[barIdx]);
        }
      } else if (rsiArr[i] >= 30) {
        inTrough = false;
      }
    }

    const currentRsi = rsiArr[rsiArr.length - 1];
    if (currentRsi < 35 && forwardReturns.length > 0) {
      const avgReturn = mean(forwardReturns);
      n++;
      score += avgReturn > 0 ? 0.5 : -0.3;
      findings.push({
        type: "rsi_history",
        description: `RSIが${currentRsi.toFixed(
          1
        )}まで低下。過去${forwardReturns.length}回、同水準まで下落した後の20営業日後リターンは平均${(
          avgReturn * 100
        ).toFixed(1)}%`,
        severity: avgReturn > 0 ? "opportunity" : "warning",
      });
    }
  }

  return { score: n > 0 ? score / n : 0, findings };
}
