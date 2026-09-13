// Pure, deterministic — no I/O, no "server-only" — so this can run
// client-side in AnalysisPanels.tsx directly from the already-fetched
// rawDetails (technical/anomaly/divergence/fundamental), without a
// round trip or a new persisted field. Concrete "sell when this
// happens" triggers per holding period, grounded in the ticker's own
// current indicator values rather than generic advice — meant to sit
// alongside (not replace) the single composite buy/sell/neutral label,
// which blends across all horizons at once and so can't say by itself
// when a specific holding period's thesis has broken down.
import type { TechnicalMetrics } from "./technical";
import type { AnomalyMetrics } from "./anomaly";
import type { DivergenceMetrics } from "./divergence";
import type { FundamentalMetrics } from "./fundamental";
import {
  HORIZON_LABEL,
  HORIZON_PERIOD,
  type InvestmentHorizon,
} from "@/lib/recommendations-constants";

export type ExitCriterion = {
  horizon: InvestmentHorizon;
  label: string;
  period: string;
  triggers: string[];
};

function fmt(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "-";
  return n.toFixed(digits);
}

export function buildExitCriteria(
  technical: TechnicalMetrics | null,
  anomaly: AnomalyMetrics | null,
  divergence: DivergenceMetrics | null,
  fundamental: FundamentalMetrics
): ExitCriterion[] {
  const short: string[] = [];
  if (technical?.rsi14 !== null && technical?.rsi14 !== undefined) {
    short.push(
      `RSI(14)が70を超えたら過熱サイン → 利益確定を検討（現在${fmt(technical.rsi14, 1)}）`
    );
    short.push(
      `RSI(14)が30を下回る状態が続くなら下落継続の警戒 → 早めの損切りを検討（現在${fmt(technical.rsi14, 1)}）`
    );
  }
  if (divergence && divergence.signal === "bearish") {
    short.push(
      "すでに弱気のダイバージェンスが検出されています。短期保有ならこの時点で利益確定・損切りの目安として重視"
    );
  } else {
    short.push("弱気のダイバージェンスが新たに検出されたら、反落の前兆として売りを検討");
  }
  if (short.length === 0) short.push("データ不足のため具体的な目安を算出できませんでした。");

  const medium: string[] = [];
  if (technical?.macd) {
    medium.push(
      `MACDヒストグラムがマイナスに転換したら上昇モメンタムの終了サイン（現在${fmt(technical.macd.histogram, 2)}）`
    );
  }
  if (technical?.sma20 !== null && technical?.sma20 !== undefined) {
    medium.push(
      `価格が20日移動平均線（現在${fmt(technical.sma20, 2)}）を明確に下回ったら短期トレンドの終わりのサイン`
    );
  }
  if (technical?.sma50 !== null && technical?.sma50 !== undefined) {
    medium.push(
      `価格が50日移動平均線（現在${fmt(technical.sma50, 2)}）を明確に下回ったら中期トレンド転換のサイン`
    );
  }
  if (medium.length === 0) medium.push("データ不足のため具体的な目安を算出できませんでした。");

  const long: string[] = [];
  if (technical?.sma200 !== null && technical?.sma200 !== undefined) {
    long.push(
      `価格が200日移動平均線（現在${fmt(technical.sma200, 2)}）を明確に下回ったら長期トレンド転換のサイン`
    );
  }
  if (
    technical?.sma50 !== null &&
    technical?.sma50 !== undefined &&
    technical?.sma200 !== null &&
    technical?.sma200 !== undefined
  ) {
    long.push(
      `50日線（${fmt(technical.sma50, 2)}）が200日線（${fmt(
        technical.sma200,
        2
      )}）を下回る「デッドクロス」が発生したら、長期保有の前提を見直す`
    );
  }
  if (fundamental.available && fundamental.kind === "stock") {
    long.push(
      "購入時の投資判断の根拠になった業績指標（ROE・売上成長率等）が悪化に転じたら、長期保有の理由自体が崩れていないか再確認"
    );
  }
  if (long.length === 0) long.push("データ不足のため具体的な目安を算出できませんでした。");

  return [
    { horizon: "short", label: HORIZON_LABEL.short, period: HORIZON_PERIOD.short, triggers: short },
    {
      horizon: "medium",
      label: HORIZON_LABEL.medium,
      period: HORIZON_PERIOD.medium,
      triggers: medium,
    },
    { horizon: "long", label: HORIZON_LABEL.long, period: HORIZON_PERIOD.long, triggers: long },
  ];
}
