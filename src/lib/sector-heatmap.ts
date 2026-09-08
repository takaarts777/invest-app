import "server-only";

import * as yahoo from "@/lib/providers/yahoo";
import { SECTOR_ETFS } from "@/lib/data/sector-etfs";

export type SectorTile = {
  symbol: string;
  name: string;
  changePercent: number | null;
};

// Cached in-process for a while — 11 Yahoo lookups on every dashboard
// load isn't necessary; sector performance doesn't need to-the-second
// freshness for an at-a-glance heatmap.
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
let cache: { tiles: SectorTile[]; expiresAt: number } | null = null;

/** Day-change % for the 11 SPDR sector ETFs, as a Finviz-style sector
 *  heatmap proxy. One failed lookup just drops that tile rather than
 *  failing the whole map. */
export async function getSectorHeatmap(): Promise<SectorTile[]> {
  if (cache && cache.expiresAt > Date.now()) return cache.tiles;

  const results = await Promise.allSettled(
    SECTOR_ETFS.map((s) => yahoo.fetchChart(s.symbol, "3mo"))
  );

  const tiles: SectorTile[] = SECTOR_ETFS.map((s, i) => {
    const r = results[i];
    return {
      symbol: s.symbol,
      name: s.name,
      changePercent: r.status === "fulfilled" ? r.value.changePercent : null,
    };
  });

  cache = { tiles, expiresAt: Date.now() + CACHE_TTL_MS };
  return tiles;
}
