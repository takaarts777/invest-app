// alternative.me's Crypto Fear & Greed Index: free, no API key. It's a
// market-wide (not per-coin) daily index explicitly designed as a
// contrarian retail-sentiment gauge — used here as the "Dumb Money" read
// for crypto tickers. https://alternative.me/crypto/fear-and-greed-index/

export type FearGreedReading = {
  value: number; // 0 (extreme fear) .. 100 (extreme greed)
  classification: string; // e.g. "Extreme Fear", "Fear", "Neutral", "Greed", "Extreme Greed"
  timestamp: string; // ISO
};

export async function fetchFearGreedIndex(): Promise<FearGreedReading> {
  const res = await fetch("https://api.alternative.me/fng/?limit=1", {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Fear & Greed Index API error (${res.status})`);
  }

  const data = await res.json();
  const item = data?.data?.[0];
  if (!item) {
    throw new Error("Fear & Greed Indexのデータが取得できませんでした。");
  }

  return {
    value: Number(item.value),
    classification: item.value_classification,
    timestamp: new Date(Number(item.timestamp) * 1000).toISOString(),
  };
}
