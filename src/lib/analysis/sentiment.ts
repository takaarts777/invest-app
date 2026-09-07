import Anthropic from "@anthropic-ai/sdk";
import type { WatchlistItem } from "@prisma/client";
import * as yahoo from "@/lib/providers/yahoo";

export class AnthropicConfigError extends Error {
  constructor() {
    super(
      "ANTHROPIC_API_KEY が設定されていません。.env にAnthropicのAPIキーを設定してください（https://console.anthropic.com/）。"
    );
    this.name = "AnthropicConfigError";
  }
}

export type SentimentResult = {
  /** -1 (very negative) .. +1 (very positive) */
  score: number;
  /** Japanese summary, grounded in the headlines below. */
  summary: string;
  headlines: { title: string; publisher: string; link: string }[];
};

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

export async function analyzeSentiment(
  item: WatchlistItem
): Promise<SentimentResult> {
  // Crypto news search works much better by coin name ("Bitcoin") than by
  // ticker ("BTC-USD" returns mostly unrelated results).
  const query = item.assetType === "CRYPTO" ? item.displayName ?? item.symbol : item.symbol;
  const news = await yahoo.searchNews(query, 8);

  const headlines = news
    .filter((n) => n.title)
    .map((n) => ({ title: n.title, publisher: n.publisher, link: n.link }));

  if (headlines.length === 0) {
    return { score: 0, summary: "関連ニュースが見つかりませんでした。", headlines: [] };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new AnthropicConfigError();

  const client = new Anthropic({ apiKey });
  const headlinesText = headlines
    .map((h, i) => `${i + 1}. ${h.title}（出典: ${h.publisher}）`)
    .join("\n");

  const prompt = `以下は「${item.displayName ?? item.symbol}」に関する直近のニュース見出し一覧です。この見出しだけから読み取れる範囲で、投資家目線のニュースセンチメントを分析してください。見出しに書かれていない情報を推測で補わないでください。

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
    return { score, summary, headlines };
  } catch {
    // Model didn't follow the JSON format — surface the raw text rather
    // than silently discarding it.
    return { score: 0, summary: text.trim() || "分析結果を解析できませんでした。", headlines };
  }
}
