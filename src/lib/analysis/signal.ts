import Anthropic from "@anthropic-ai/sdk";
import type { WatchlistItem } from "@prisma/client";
import { fetchPriceDataFor } from "@/lib/market";
import { analyzeTechnical, type TechnicalMetrics } from "./technical";
import { analyzeFundamental, type FundamentalMetrics } from "./fundamental";
import { analyzeSentiment, type SentimentResult } from "./sentiment";
import { analyzeAnomaly, type AnomalyMetrics } from "./anomaly";

export type FullAnalysis = {
  technical: TechnicalMetrics | null;
  fundamental: FundamentalMetrics;
  sentiment: SentimentResult | null;
  sentimentError: string | null;
  anomaly: AnomalyMetrics | null;
  /** -1 (strong sell) .. +1 (strong buy) */
  compositeScore: number;
  compositeLabel: string;
  rationale: string;
};

// How much each axis contributes to the composite score. Axes that
// couldn't be computed (missing data / API key) are dropped and the
// remaining weights renormalized, so e.g. a crypto ticker's composite is
// still meaningful without a "fundamental" P/E-style read.
const WEIGHTS = { technical: 0.35, fundamental: 0.25, sentiment: 0.2, anomaly: 0.2 };

function labelFor(score: number): string {
  if (score > 0.4) return "強い買い";
  if (score > 0.15) return "買い";
  if (score < -0.4) return "強い売り";
  if (score < -0.15) return "売り";
  return "中立";
}

export async function runFullAnalysis(item: WatchlistItem): Promise<FullAnalysis> {
  const { history } = await fetchPriceDataFor(item);

  const technical = analyzeTechnical(history);
  const anomaly = analyzeAnomaly(item, history);
  const fundamental = await analyzeFundamental(item);

  let sentiment: SentimentResult | null = null;
  let sentimentError: string | null = null;
  try {
    sentiment = await analyzeSentiment(item);
  } catch (error) {
    sentimentError =
      error instanceof Error ? error.message : "センチメント分析に失敗しました。";
  }

  const parts: { weight: number; score: number }[] = [];
  if (technical) parts.push({ weight: WEIGHTS.technical, score: technical.score });
  if (fundamental.available)
    parts.push({ weight: WEIGHTS.fundamental, score: fundamental.score });
  if (sentiment) parts.push({ weight: WEIGHTS.sentiment, score: sentiment.score });
  if (anomaly) parts.push({ weight: WEIGHTS.anomaly, score: anomaly.score });

  const totalWeight = parts.reduce((s, p) => s + p.weight, 0);
  const compositeScore =
    totalWeight > 0
      ? parts.reduce((s, p) => s + p.weight * p.score, 0) / totalWeight
      : 0;
  const compositeLabel = labelFor(compositeScore);

  const rationale = await generateRationale(item, {
    technical,
    fundamental,
    sentiment,
    anomaly,
    compositeScore,
    compositeLabel,
  });

  return {
    technical,
    fundamental,
    sentiment,
    sentimentError,
    anomaly,
    compositeScore,
    compositeLabel,
    rationale,
  };
}

type RationaleInput = {
  technical: TechnicalMetrics | null;
  fundamental: FundamentalMetrics;
  sentiment: SentimentResult | null;
  anomaly: AnomalyMetrics | null;
  compositeScore: number;
  compositeLabel: string;
};

function buildPrompt(item: WatchlistItem, data: RationaleInput): string {
  const technicalText = data.technical
    ? data.technical.signals.join("、")
    : "データ不足のため分析できませんでした。";

  const fundamentalText = data.fundamental.available
    ? data.fundamental.signals.join("、") || "特筆すべき偏りは見られませんでした。"
    : `取得できませんでした（${data.fundamental.reason}）`;

  const sentimentText = data.sentiment
    ? data.sentiment.summary
    : "分析できませんでした。";

  const anomalyText = data.anomaly
    ? data.anomaly.findings.map((f) => f.description).join("、") ||
      "特筆すべき異常は検出されませんでした。"
    : "データ不足のため分析できませんでした。";

  return `あなたは投資分析アシスタントです。以下は「${item.symbol}」${
    item.displayName ? `（${item.displayName}）` : ""
  }についての4軸のルールベース分析結果です。この数値・事実データ**のみ**に基づいて、日本語で3〜5文の簡潔な根拠説明を書いてください。

厳守事項:
- ここに書かれていない数値やニュースを作り出さないこと
- 断定的な投資助言（「今すぐ買うべき」等）ではなく、分析結果の要約として書くこと
- 各軸で判断が分かれている場合は、その旨も触れること

総合判定: ${data.compositeLabel}（スコア ${data.compositeScore.toFixed(2)}、-1=強い売り 〜 +1=強い買い）

【テクニカル分析】${technicalText}
【ファンダメンタル分析】${fundamentalText}
【ニュースセンチメント】${sentimentText}
【アノマリー分析】${anomalyText}`;
}

async function generateRationale(
  item: WatchlistItem,
  data: RationaleInput
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return "（ANTHROPIC_API_KEYが未設定のため、AIによる根拠説明は生成されていません。各分析パネルの数値を参考にしてください。）";
  }

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 600,
      messages: [{ role: "user", content: buildPrompt(item, data) }],
    });

    return message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
  } catch (error) {
    const message = error instanceof Error ? error.message : "不明なエラー";
    return `（AIによる根拠説明の生成に失敗しました: ${message}）`;
  }
}
