import "server-only";

import * as yahoo from "@/lib/providers/yahoo";
import { analyzeSp500Forecast, type Sp500Forecast } from "@/lib/analysis/sp500-forecast";

// S&P 500 index, daily closes from 1950 (the earliest reliable daily
// range Yahoo serves for ^GSPC — see providers/yahoo.ts). 1 Jan 1950.
const START_UNIX = -631152000;

const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // end-of-day data, so 12h is plenty
let cache: { data: Sp500Forecast; expiresAt: number } | null = null;

export async function getSp500Forecast(): Promise<Sp500Forecast> {
  if (cache && cache.expiresAt > Date.now()) return cache.data;

  const bars = await yahoo.fetchDailyBarsSince("^GSPC", START_UNIX);
  const data = analyzeSp500Forecast(bars.map((b) => ({ date: b.date, close: b.close })));

  cache = { data, expiresAt: Date.now() + CACHE_TTL_MS };
  return data;
}
