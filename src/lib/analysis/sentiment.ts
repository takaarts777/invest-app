import Anthropic from "@anthropic-ai/sdk";
import type { WatchlistItem } from "@prisma/client";
import * as yahoo from "@/lib/providers/yahoo";
import * as feargreed from "@/lib/providers/feargreed";

export type SentimentResult =
  | {
      available: true;
      /** -1 (very negative/fearful crowd mood) .. +1 (very positive/greedy).
       *  This is the raw semantic reading — signal.ts applies the
       *  contrarian flip when folding it into the composite score. */
      score: number;
      summary: string;
      headlines: { title: string; publisher: string; link: string }[];
      /** Crypto only — alternative.me's market-wide Fear & Greed Index,
       *  blended into `score` and shown as the "Dumb Money" read. */
      fearGreed: { value: number; classification: string } | null;
      /** false when ANTHROPIC_API_KEY isn't set — headlines/fear-greed are
       *  still shown, just without an AI-scored headline read or summary. */
      aiSummaryAvailable: boolean;
    }
  | { available: false; reason: string };

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/** Pulls the first top-level JSON object out of a text blob, tolerating a
 *  ```json ... ``` fence around it even though the prompt asks for none. */
function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("JSON not found in response");
  return JSON.parse(candidate.slice(start, end + 1));
}

async function scoreHeadlinesWithClaude(
  displayName: string,
  headlines: { title: string; publisher: string }[]
): Promise<{ score: number; summary: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const client = new Anthropic({ apiKey });
  const headlinesText = headlines
    .map((h, i) => `${i + 1}. ${h.title}（出典: ${h.publisher}）`)
    .join("\n");

  const prompt = `以下は「${displayName}」に関する直近のニュース見出し一覧です。この見出しだけから読み取れる範囲で、投資家目線のニュースセンチメントを分析してください。見出しに書かれていない情報を推測で補わないでください。

${headlinesText}

次のJSON形式で**のみ**回答してください（前後に説明文やコードフェンスは不要です）:
{"score": -1から1の数値（-1=非常にネガティブ、0=中立、1=非常にポジティブ）, "summary": "見出しから読み取れる傾向を2〜3文の日本語で要約したもの"}`;

  const message = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 500,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  try {
    const parsed = extractJson(text) as { score?: unknown; summary?: unknown };
    const score = typeof parsed.score === "number" ? clamp(parsed.score, -1, 1) : 0;
    const summary =
      typeof parsed.summary === "string" && parsed.summary.trim()
        ? parsed.summary.trim()
        : "要約の生成に失敗しました。";
    return { score, summary };
  } catch {
    return { score: 0, summary: text.trim() || "分析結果を解析できませんでした。" };
  }
}

export async function analyzeSentiment(
  item: WatchlistItem
): Promise<SentimentResult> {
  // Crypto news search works much better by coin name ("Bitcoin") than by
  // ticker ("BTC-USD" returns mostly unrelated results).
  const query = item.assetType === "CRYPTO" ? item.displayName ?? item.symbol : item.symbol;

  const [newsResult, fearGreedResult] = await Promise.allSettled([
    yahoo.searchNews(query, 8),
    item.assetType === "CRYPTO" ? feargreed.fetchFearGreedIndex() : Promise.resolve(null),
  ]);

  const news = newsResult.status === "fulfilled" ? newsResult.value : [];
  const fearGreed = fearGreedResult.status === "fulfilled" ? fearGreedResult.value : null;

  const headlines = news
    .filter((n) => n.title)
    .map((n) => ({ title: n.title, publisher: n.publisher, link: n.link }));

  if (headlines.length === 0 && !fearGreed) {
    return {
      available: false,
      reason: "関連ニュース・指数データが見つかりませんでした。",
    };
  }

  let headlineScore: number | null = null;
  let aiSummary = "";
  let aiSummaryAvailable = true;

  if (headlines.length > 0) {
    try {
      const result = await scoreHeadlinesWithClaude(
        item.displayName ?? item.symbol,
        headlines
      );
      headlineScore = result.score;
      aiSummary = result.summary;
    } catch {
      // No ANTHROPIC_API_KEY (or the call failed) — still show the raw
      // headlines and any Fear & Greed reading rather than failing the
      // whole axis.
      aiSummaryAvailable = false;
    }
  }

  const fearGreedScore = fearGreed ? (fearGreed.value - 50) / 50 : null;

  const scores = [headlineScore, fearGreedScore].filter(
    (s): s is number => s !== null
  );
  const score = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

  const summaryParts: string[] = [];
  if (aiSummary) summaryParts.push(aiSummary);
  if (fearGreed) {
    summaryParts.push(
      `Fear & Greed指数: ${fearGreed.value}（${fearGreed.classification}）`
    );
  }
  if (!aiSummaryAvailable && headlines.length > 0) {
    summaryParts.push(
      "（ANTHROPIC_API_KEY未設定のため見出しの自動要約はありません。下の見出し一覧を参照してください。）"
    );
  }

  return {
    available: true,
    score,
    summary: summaryParts.join(" ") || "分析材料が不足しています。",
    headlines,
    fearGreed: fearGreed ? { value: fearGreed.value, classification: fearGreed.classification } : null,
    aiSummaryAvailable,
  };
}
