// Yahoo Finance's unofficial chart endpoint: free, no API key, used for
// US stock / leveraged ETF quotes + daily OHLCV history + company name.
//
// NOTE: This is an undocumented public endpoint (the same one the popular
// `yfinance` Python library scrapes) — it can change or start blocking
// requests without notice. We tried Stooq's CSV endpoint first, but it now
// serves a JS bot-check challenge to non-browser requests, so this is the
// working free option today. If it ever breaks, switching to a paid
// provider (e.g. Finnhub's /stock/candle) is the fallback.

import type { DailyBar } from "./types";

const BASE_URL = "https://query1.finance.yahoo.com/v8/finance/chart";

export class SymbolLookupError extends Error {}

export type YahooChartResult = {
  price: number;
  changePercent: number | null;
  displayName: string;
  bars: DailyBar[];
};

export async function fetchChart(
  symbol: string,
  range: "3mo" | "1y" | "2y" | "5y" = "1y"
): Promise<YahooChartResult> {
  const url = `${BASE_URL}/${encodeURIComponent(symbol)}?range=${range}&interval=1d`;
  const res = await fetch(url, {
    cache: "no-store",
    headers: {
      // A plain server-side fetch with no UA gets blocked more often than
      // one that looks like a browser.
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
    },
  });

  if (res.status === 404) {
    throw new SymbolLookupError(`銘柄「${symbol}」が見つかりませんでした。`);
  }
  if (!res.ok) {
    throw new Error(`Yahoo Finance API error (${res.status}) for ${symbol}`);
  }

  const data = await res.json();
  const result = data?.chart?.result?.[0];
  if (!result) {
    throw new SymbolLookupError(`銘柄「${symbol}」が見つかりませんでした。`);
  }

  const meta = result.meta ?? {};
  const timestamps: number[] = result.timestamp ?? [];
  const quote = result.indicators?.quote?.[0] ?? {};

  const bars: DailyBar[] = timestamps
    .map((ts, i) => ({
      date: new Date(ts * 1000).toISOString().slice(0, 10),
      open: quote.open?.[i],
      high: quote.high?.[i],
      low: quote.low?.[i],
      close: quote.close?.[i],
      volume: quote.volume?.[i] ?? 0,
    }))
    // Yahoo returns null for the current (still-open) session's bar and
    // for the occasional halted trading day.
    .filter((bar) => [bar.open, bar.high, bar.low, bar.close].every(
      (v) => typeof v === "number" && !Number.isNaN(v)
    ));

  return {
    price: meta.regularMarketPrice,
    changePercent: meta.regularMarketChangePercent ?? null,
    displayName: meta.longName ?? meta.shortName ?? symbol.toUpperCase(),
    bars,
  };
}
