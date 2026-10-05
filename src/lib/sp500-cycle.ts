import "server-only";

import * as yahoo from "@/lib/providers/yahoo";
import { analyzeSp500Forecast, type Bar, type Sp500Forecast } from "@/lib/analysis/sp500-forecast";

// S&P 500 index, daily closes from 1950 (the earliest reliable daily
// range Yahoo serves for ^GSPC — see providers/yahoo.ts). 1 Jan 1950.
const START_UNIX = -631152000;

const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // end-of-day data, so 12h is plenty
let barsCache: { data: Bar[]; expiresAt: number } | null = null;
let forecastCache: { data: Sp500Forecast; expiresAt: number } | null = null;

export async function getSp500Bars(): Promise<Bar[]> {
  if (barsCache && barsCache.expiresAt > Date.now()) return barsCache.data;
  const bars = await yahoo.fetchDailyBarsSince("^GSPC", START_UNIX);
  const data = bars.map((b) => ({ date: b.date, close: b.close }));
  barsCache = { data, expiresAt: Date.now() + CACHE_TTL_MS };
  return data;
}

export async function getSp500Forecast(): Promise<Sp500Forecast> {
  if (forecastCache && forecastCache.expiresAt > Date.now()) return forecastCache.data;
  const data = analyzeSp500Forecast(await getSp500Bars());
  forecastCache = { data, expiresAt: Date.now() + CACHE_TTL_MS };
  return data;
}
