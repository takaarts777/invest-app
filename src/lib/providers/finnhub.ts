// Finnhub: used for US stock / leveraged ETF quotes, company profile,
// fundamentals (later phase), and news (later phase).
// Free tier docs: https://finnhub.io/docs/api

const BASE_URL = "https://finnhub.io/api/v1";

export class FinnhubConfigError extends Error {
  constructor() {
    super(
      "FINNHUB_API_KEY が設定されていません。.env に無料登録したAPIキーを設定してください（https://finnhub.io/register）。"
    );
    this.name = "FinnhubConfigError";
  }
}

function getApiKey(): string {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) throw new FinnhubConfigError();
  return key;
}

async function finnhubFetch<T>(path: string, params: Record<string, string>) {
  const key = getApiKey();
  const url = new URL(BASE_URL + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("token", key);

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Finnhub API error (${res.status}): ${path}`);
  }
  return (await res.json()) as T;
}

export type FinnhubQuote = {
  c: number; // current price
  d: number | null; // change
  dp: number | null; // percent change
  h: number; // high of the day
  l: number; // low of the day
  o: number; // open of the day
  pc: number; // previous close
  t: number; // timestamp
};

export async function fetchQuote(symbol: string): Promise<FinnhubQuote> {
  return finnhubFetch<FinnhubQuote>("/quote", { symbol });
}

export type FinnhubProfile = {
  name?: string;
  ticker?: string;
  exchange?: string;
  finnhubIndustry?: string;
  logo?: string;
  weburl?: string;
};

export async function fetchProfile(symbol: string): Promise<FinnhubProfile> {
  return finnhubFetch<FinnhubProfile>("/stock/profile2", { symbol });
}

// "Basic financials" (metric=all) is available on Finnhub's free tier and
// returns a large bag of ratios; we only pick out what we use.
export type FinnhubBasicFinancials = {
  metric: {
    peBasicExclExtraTTM?: number;
    peInclExtraTTM?: number;
    pbAnnual?: number;
    pbQuarterly?: number;
    roeTTM?: number;
    roeRfy?: number;
    netProfitMarginTTM?: number;
    revenueGrowthTTM?: number;
    epsGrowthTTM?: number;
    dividendYieldIndicatedAnnual?: number;
    "52WeekHigh"?: number;
    "52WeekLow"?: number;
    beta?: number;
  };
};

export async function fetchBasicFinancials(
  symbol: string
): Promise<FinnhubBasicFinancials> {
  return finnhubFetch<FinnhubBasicFinancials>("/stock/metric", {
    symbol,
    metric: "all",
  });
}

export type FinnhubNewsItem = {
  headline: string;
  source: string;
  url: string;
  datetime: number; // unix seconds
};

export async function fetchCompanyNews(
  symbol: string,
  from: string,
  to: string
): Promise<FinnhubNewsItem[]> {
  return finnhubFetch<FinnhubNewsItem[]>("/company-news", { symbol, from, to });
}
