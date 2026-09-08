// CNN Business's Fear & Greed Index for the overall US stock market
// (S&P 500-wide, derived from 7 quantitative factors: momentum, breadth,
// put/call ratio, junk bond demand, volatility, safe-haven demand, and
// 52-week highs/lows). No official public API — this is the same
// unofficial JSON endpoint the CNN Business page itself calls, and it
// requires the Referer header below or CNN's edge returns 418. Used as
// the US_STOCK/LEVERAGED_ETF equivalent of the crypto Fear & Greed Index
// (see feargreed.ts) — a "Dumb Money" market-wide contrarian read to sit
// alongside the per-ticker headline sentiment.

export type CnnFearGreedReading = {
  value: number; // 0 (extreme fear) .. 100 (extreme greed)
  classification: string; // "Extreme Fear" | "Fear" | "Neutral" | "Greed" | "Extreme Greed"
  timestamp: string; // ISO
};

function titleCase(s: string): string {
  return s
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export async function fetchCnnFearGreedIndex(): Promise<CnnFearGreedReading> {
  const today = new Date().toISOString().slice(0, 10);
  const res = await fetch(
    `https://production.dataviz.cnn.io/index/fearandgreed/graphdata/${today}`,
    {
      cache: "no-store",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        Referer: "https://edition.cnn.com/markets/fear-and-greed",
      },
    }
  );

  if (!res.ok) {
    throw new Error(`CNN Fear & Greed Index API error (${res.status})`);
  }

  const data = await res.json();
  const reading = data?.fear_and_greed;
  if (!reading || typeof reading.score !== "number") {
    throw new Error("CNN Fear & Greed Indexのデータが取得できませんでした。");
  }

  return {
    value: reading.score,
    classification: titleCase(String(reading.rating ?? "")) || "Unknown",
    timestamp: reading.timestamp,
  };
}
