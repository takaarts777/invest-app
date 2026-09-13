import Anthropic from "@anthropic-ai/sdk";
import type { WatchlistItem } from "@prisma/client";
import { fetchPriceDataFor } from "@/lib/market";
import { analyzeTechnical, type TechnicalMetrics } from "./technical";
import { analyzeFundamental, type FundamentalMetrics } from "./fundamental";
import { analyzeSentiment, type SentimentResult } from "./sentiment";
import { analyzeAnomaly, type AnomalyMetrics } from "./anomaly";
import { analyzeSmartMoney, type SmartMoneyMetrics } from "./smartmoney";
import { analyzeDivergence, type DivergenceMetrics } from "./divergence";

export type FullAnalysis = {
  technical: TechnicalMetrics | null;
  fundamental: FundamentalMetrics;
  /** Raw crowd-sentiment reading ("Dumb Money"). Note: its contribution to
   *  compositeScore is contrarian (sign-flipped) — see runFullAnalysis. */
  sentiment: SentimentResult;
  /** Insider buy/sell reading ("Smart Money"). Contributes directly
   *  (non-contrarian) to compositeScore. */
  smartMoney: SmartMoneyMetrics;
  anomaly: AnomalyMetrics | null;
  /** RSI/price divergence — its own axis, separate from the general
   *  anomaly scan (used to be folded into it). */
  divergence: DivergenceMetrics | null;
  /** -1 (strong sell) .. +1 (strong buy) */
  compositeScore: number;
  compositeLabel: string;
  rationale: string;
};

// How much each axis contributes to the composite score. Axes that
// couldn't be computed (missing data / API key) are dropped and the
// remaining weights renormalized, so e.g. a crypto ticker's composite is
// still meaningful without a "smart money" read (insiders don't exist for
// crypto/ETFs). Divergence is included even when it found nothing (score
// 0, i.e. neutral) — like technical/anomaly, it's "available" whenever
// there's enough price history, it just usually has nothing to report.
const WEIGHTS = {
  technical: 0.25,
  fundamental: 0.15,
  sentiment: 0.15,
  anomaly: 0.1,
  smartMoney: 0.15,
  divergence: 0.2,
};

export function labelFor(score: number): string {
  if (score > 0.4) return "強い買い";
  if (score > 0.15) return "買い";
  if (score < -0.4) return "強い売り";
  if (score < -0.15) return "売り";
  return "中立";
}

export async function runFullAnalysis(
  item: WatchlistItem,
  /** The requesting user's own Anthropic API key, or null if they haven't
   *  set one on the /settings page. There is no app-wide shared key —
   *  each user's Claude usage (sentiment summary + this rationale) is
   *  billed to their own Anthropic account. */
  anthropicApiKey: string | null
): Promise<FullAnalysis> {
  const { history } = await fetchPriceDataFor(item);

  const technical = analyzeTechnical(history);
  const anomaly = analyzeAnomaly(item, history);
  const divergence = analyzeDivergence(history);
  const fundamental = await analyzeFundamental(item);
  const sentiment = await analyzeSentiment(item, anthropicApiKey);
  const smartMoney = await analyzeSmartMoney(item);

  const parts: { weight: number; score: number }[] = [];
  if (technical) parts.push({ weight: WEIGHTS.technical, score: technical.score });
  if (fundamental.available)
    parts.push({ weight: WEIGHTS.fundamental, score: fundamental.score });
  // Contrarian: crowd euphoria (high score) is treated as a caution signal
  // and crowd fear (low score) as an opportunity signal, so its
  // contribution to the composite is sign-flipped here. The raw score is
  // still shown as-is in the sentiment panel.
  if (sentiment.available)
    parts.push({ weight: WEIGHTS.sentiment, score: -sentiment.score });
  if (anomaly) parts.push({ weight: WEIGHTS.anomaly, score: anomaly.score });
  if (smartMoney.available)
    parts.push({ weight: WEIGHTS.smartMoney, score: smartMoney.score });
  if (divergence) parts.push({ weight: WEIGHTS.divergence, score: divergence.score });

  const totalWeight = parts.reduce((s, p) => s + p.weight, 0);
  const compositeScore =
    totalWeight > 0
      ? parts.reduce((s, p) => s + p.weight * p.score, 0) / totalWeight
      : 0;
  const compositeLabel = labelFor(compositeScore);

  const rationale = await generateRationale(
    item,
    {
      technical,
      fundamental,
      sentiment,
      smartMoney,
      anomaly,
      divergence,
      compositeScore,
      compositeLabel,
    },
    anthropicApiKey
  );

  return {
    technical,
    fundamental,
    sentiment,
    smartMoney,
    anomaly,
    divergence,
    compositeScore,
    compositeLabel,
    rationale,
  };
}

/** Shapes a FullAnalysis result into the fields AnalysisSnapshot.create
 *  expects (minus watchlistItemId), shared by the on-demand analyze route
 *  and the cron refresh route so they can't drift apart. */
export function snapshotDataFrom(analysis: FullAnalysis) {
  const divergenceSignal =
    analysis.divergence && analysis.divergence.signal !== "none"
      ? analysis.divergence.signal
      : null;

  return {
    technicalScore: analysis.technical?.score ?? null,
    fundamentalScore: analysis.fundamental.available ? analysis.fundamental.score : null,
    sentimentScore: analysis.sentiment.available ? analysis.sentiment.score : null,
    anomalyScore: analysis.anomaly?.score ?? null,
    smartMoneyScore: analysis.smartMoney.available ? analysis.smartMoney.score : null,
    divergenceScore: analysis.divergence?.score ?? null,
    compositeScore: analysis.compositeScore,
    compositeLabel: analysis.compositeLabel,
    divergenceSignal,
    rationale: analysis.rationale,
    rawDetails: JSON.stringify({
      technical: analysis.technical,
      fundamental: analysis.fundamental,
      sentiment: analysis.sentiment,
      smartMoney: analysis.smartMoney,
      anomaly: analysis.anomaly,
      divergence: analysis.divergence,
    }),
  };
}

type RationaleInput = {
  technical: TechnicalMetrics | null;
  fundamental: FundamentalMetrics;
  sentiment: SentimentResult;
  smartMoney: SmartMoneyMetrics;
  anomaly: AnomalyMetrics | null;
  divergence: DivergenceMetrics | null;
  compositeScore: number;
  compositeLabel: string;
};

function axisTexts(data: RationaleInput) {
  const technicalText = data.technical
    ? data.technical.signals.join("、") || "特筆すべき偏りは見られませんでした。"
    : "データ不足のため分析できませんでした。";

  const fundamentalText = data.fundamental.available
    ? data.fundamental.signals.join("、") || "特筆すべき偏りは見られませんでした。"
    : `取得できませんでした（${data.fundamental.reason}）`;

  const sentimentText = data.sentiment.available
    ? `${data.sentiment.summary}（このスコアは逆張り指標として使う方針のため、強気に傾いているほど総合判定では警戒材料、弱気に傾いているほど好機材料として扱う）`
    : `分析できませんでした（${data.sentiment.reason}）`;

  const smartMoneyText = data.smartMoney.available
    ? data.smartMoney.signals.join("、") || "特筆すべき偏りは見られませんでした。"
    : `データなし（${data.smartMoney.reason}）`;

  const anomalyText = data.anomaly
    ? data.anomaly.findings.map((f) => f.description).join("、") ||
      "特筆すべき異常は検出されませんでした。"
    : "データ不足のため分析できませんでした。";

  const divergenceText = data.divergence
    ? (data.divergence.events[0]?.description ?? "直近60営業日以内にRSI/価格のダイバージェンスは検出されませんでした。")
    : "データ不足のため分析できませんでした。";

  return { technicalText, fundamentalText, sentimentText, smartMoneyText, anomalyText, divergenceText };
}

function buildPrompt(item: WatchlistItem, data: RationaleInput): string {
  const { technicalText, fundamentalText, sentimentText, smartMoneyText, anomalyText, divergenceText } =
    axisTexts(data);

  return `あなたは投資分析アシスタントです。以下は「${item.symbol}」${
    item.displayName ? `（${item.displayName}）` : ""
  }についての6軸のルールベース分析結果です。この数値・事実データ**のみ**に基づいて、日本語で3〜5文の簡潔な根拠説明を書いてください。

厳守事項:
- ここに書かれていない数値やニュースを作り出さないこと
- 断定的な投資助言（「今すぐ買うべき」等）ではなく、分析結果の要約として書くこと
- 各軸で判断が分かれている場合は、その旨も触れること
- ニュースセンチメント（Dumb Money）は逆張り指標として扱われている点に注意して説明すること

総合判定: ${data.compositeLabel}（スコア ${data.compositeScore.toFixed(2)}、-1=強い売り 〜 +1=強い買い）

【テクニカル分析】${technicalText}
【ファンダメンタル分析】${fundamentalText}
【ニュースセンチメント／Dumb Money（逆張り指標）】${sentimentText}
【Smart Money（インサイダー取引）】${smartMoneyText}
【アノマリー分析】${anomalyText}
【RSI/価格ダイバージェンス】${divergenceText}`;
}

/** When a composite-score-opposing axis is strong enough to be worth
 *  calling out explicitly, even in the free rule-based summary. */
function disagreementNote(data: RationaleInput): string | null {
  const compositeSign = Math.sign(data.compositeScore);
  if (compositeSign === 0) return null;

  const conflicts: string[] = [];
  const checkConflict = (score: number, name: string) => {
    if (Math.sign(score) !== 0 && Math.sign(score) !== compositeSign && Math.abs(score) > 0.3) {
      conflicts.push(name);
    }
  };

  if (data.technical) checkConflict(data.technical.score, "テクニカル分析");
  if (data.fundamental.available) checkConflict(data.fundamental.score, "ファンダメンタル分析");
  // Contrarian-flipped, matching how it's folded into the composite.
  if (data.sentiment.available) checkConflict(-data.sentiment.score, "ニュースセンチメント（逆張り換算後）");
  if (data.smartMoney.available) checkConflict(data.smartMoney.score, "Smart Money");

  if (conflicts.length === 0) return null;
  return `一方で、${conflicts.join("・")}は総合判定と逆方向のシグナルを示しており、判断が分かれている点に注意してください。`;
}

/** Free, no-API-key fallback: the same per-axis facts Claude would be
 *  given, compiled into a readable summary by simple rules instead of
 *  an LLM call. Grounded and accurate by construction (it's literally
 *  reciting the already-computed numbers), but — unlike Claude's
 *  version — it can't weigh conflicting signals contextually, notice
 *  nuance a template can't anticipate, or vary its phrasing; it's a
 *  compilation of facts already visible in the panels below, not a new
 *  synthesis of them. */
function buildRuleBasedRationale(data: RationaleInput): string {
  const {
    technicalText,
    fundamentalText,
    sentimentText,
    smartMoneyText,
    anomalyText,
    divergenceText,
  } = axisTexts(data);
  const note = disagreementNote(data);

  const lines = [
    `総合判定は「${data.compositeLabel}」（スコア${data.compositeScore.toFixed(
      2
    )}、-1=強い売り〜+1=強い買い）です。`,
    `テクニカル分析: ${technicalText}`,
    `ファンダメンタル分析: ${fundamentalText}`,
    `ニュースセンチメント（逆張り指標）: ${sentimentText}`,
    `Smart Money（インサイダー取引）: ${smartMoneyText}`,
    `アノマリー分析: ${anomalyText}`,
    `RSI/価格ダイバージェンス: ${divergenceText}`,
  ];
  if (note) lines.push(note);
  lines.push(
    "（この根拠説明はAnthropic APIキー未設定のため、AIではなくルールベースで自動生成した要約です。各分析パネルの数値をそのまま整理したもので、軸をまたいだニュアンスの解釈は行っていません。設定ページでご自身のAPIキーを登録すると、より自然な文章の根拠説明に切り替わります。）"
  );
  return lines.join("\n");
}

async function generateRationale(
  item: WatchlistItem,
  data: RationaleInput,
  apiKey: string | null
): Promise<string> {
  if (!apiKey) {
    return buildRuleBasedRationale(data);
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
