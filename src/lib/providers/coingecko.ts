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

async function rawCoinSearch(query: string): Promise<CoinSearchResult[]> {
  const data = await coingeckoFetch<{ coins: CoinSearchResult[] }>(
    `/search?query=${encodeURIComponent(query)}`
  );
  return data.coins ?? [];
}

/** Resolves a user-entered ticker (e.g. "BTC") to a CoinGecko coin id. */
export async function searchCoin(query: string): Promise<CoinSearchResult | null> {
  const coins = await rawCoinSearch(query);
  if (!coins.length) return null;

  const lower = query.trim().toLowerCase();
  // Prefer an exact symbol match (search results are already ranked by
  // market cap, so this picks the best-known coin for ambiguous tickers).
  const exact = coins.find((c) => c.symbol.toLowerCase() === lower);
  return exact ?? coins[0];
}

/** Multiple candidates for the add-ticker autocomplete — unlike
 *  searchCoin(), this doesn't guess a single best match, since many
 *  tickers (e.g. "SOL") are shared by several unrelated tokens and the
 *  user should pick the right one themselves. */
export async function searchCoins(
  query: string,
  count = 8
): Promise<CoinSearchResult[]> {
  const coins = await rawCoinSearch(query);
  return coins.slice(0, count);
}

export async function fetchCoinPrice(id: string) {
  const data = await coingeckoFetch<
    Record<string, { usd: number; usd_24h_change: number }>
  >(`/simple/price?ids=${encodeURIComponent(id)}&vs_currencies=usd&include_24hr_change=true`);
  return data[id] ?? null;
}

export type CoinDetail = {
  marketCapRank: number | null;
  marketCapUsd: number | null;
  fullyDilutedValuationUsd: number | null;
  totalVolumeUsd: number | null;
  circulatingSupply: number | null;
  maxSupply: number | null;
  athUsd: number | null;
  athChangePercent: number | null;
  priceChangePercent30d: number | null;
  priceChangePercent1y: number | null;
};

export async function fetchCoinDetail(id: string): Promise<CoinDetail> {
  const data = await coingeckoFetch<{
    market_cap_rank?: number;
    market_data?: {
      market_cap?: Record<string, number>;
      fully_diluted_valuation?: Record<string, number>;
      total_volume?: Record<string, number>;
      circulating_supply?: number;
      max_supply?: number | null;
      ath?: Record<string, number>;
      ath_change_percentage?: Record<string, number>;
      price_change_percentage_30d?: number;
      price_change_percentage_1y?: number;
    };
  }>(
    `/coins/${encodeURIComponent(
      id
    )}?localization=false&tickers=false&community_data=false&developer_data=false`
  );

  const md = data.market_data ?? {};
  return {
    marketCapRank: data.market_cap_rank ?? null,
    marketCapUsd: md.market_cap?.usd ?? null,
    fullyDilutedValuationUsd: md.fully_diluted_valuation?.usd ?? null,
    totalVolumeUsd: md.total_volume?.usd ?? null,
    circulatingSupply: md.circulating_supply ?? null,
    maxSupply: md.max_supply ?? null,
    athUsd: md.ath?.usd ?? null,
    athChangePercent: md.ath_change_percentage?.usd ?? null,
    priceChangePercent30d: md.price_change_percentage_30d ?? null,
    priceChangePercent1y: md.price_change_percentage_1y ?? null,
  };
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
