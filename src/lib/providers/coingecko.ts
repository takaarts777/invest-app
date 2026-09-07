// CoinGecko: free, no API key required for the public endpoints we use here.
// Docs: https://docs.coingecko.com/reference/introduction

import type { DailyBar } from "./types";

const BASE_URL = "https://api.coingecko.com/api/v3";

async function coingeckoFetch<T>(path: string) {
  const res = await fetch(BASE_URL + path, { cache: "no-store" });
  if (!res.ok) {
    if (res.status === 429) {
      throw new Error(
        "CoinGecko APIのレート制限に達しました。しばらく待ってから再度お試しください。"
      );
    }
    throw new Error(`CoinGecko API error (${res.status}): ${path}`);
  }
  return (await res.json()) as T;
}

export type CoinSearchResult = {
  id: string;
  symbol: string;
  name: string;
};

/** Resolves a user-entered ticker (e.g. "BTC") to a CoinGecko coin id. */
export async function searchCoin(
  query: string
): Promise<CoinSearchResult | null> {
  const data = await coingeckoFetch<{ coins: CoinSearchResult[] }>(
    `/search?query=${encodeURIComponent(query)}`
  );
  if (!data.coins?.length) return null;

  const lower = query.trim().toLowerCase();
  // Prefer an exact symbol match (search results are already ranked by
  // market cap, so this picks the best-known coin for ambiguous tickers).
  const exact = data.coins.find((c) => c.symbol.toLowerCase() === lower);
  return exact ?? data.coins[0];
}

export async function fetchCoinPrice(id: string) {
  const data = await coingeckoFetch<
    Record<string, { usd: number; usd_24h_change: number }>
  >(`/simple/price?ids=${encodeURIComponent(id)}&vs_currencies=usd&include_24hr_change=true`);
  return data[id] ?? null;
}

export async function fetchDailyHistory(
  id: string,
  days = 365
): Promise<DailyBar[]> {
  const raw = await coingeckoFetch<[number, number, number, number, number][]>(
    `/coins/${encodeURIComponent(id)}/ohlc?vs_currency=usd&days=${days}`
  );
  return raw.map(([ts, open, high, low, close]) => ({
    date: new Date(ts).toISOString().slice(0, 10),
    open,
    high,
    low,
    close,
    volume: 0, // not provided by the OHLC endpoint
  }));
}
