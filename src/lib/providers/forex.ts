// Frankfurter: free, no API key, ECB-sourced exchange rates.
// https://frankfurter.dev

// Cached in-process for a while — the rate barely moves intraday and
// there's no need to hit this on every page load.
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
let cache: { rate: number; expiresAt: number } | null = null;

/** USD -> JPY spot rate. Throws on failure; callers should degrade to
 *  USD-only display rather than blocking the page. */
export async function fetchUsdJpyRate(): Promise<number> {
  if (cache && cache.expiresAt > Date.now()) return cache.rate;

  const res = await fetch("https://api.frankfurter.dev/v1/latest?from=USD&to=JPY", {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`為替レートの取得に失敗しました (${res.status})`);
  }

  const data = await res.json();
  const rate = data?.rates?.JPY;
  if (typeof rate !== "number") {
    throw new Error("為替レートのデータ形式が想定外でした。");
  }

  cache = { rate, expiresAt: Date.now() + CACHE_TTL_MS };
  return rate;
}
