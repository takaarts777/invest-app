import "server-only";

import { prisma } from "@/lib/db";

export function getLatestSnapshot(watchlistItemId: string) {
  return prisma.analysisSnapshot.findFirst({
    where: { watchlistItemId },
    orderBy: { computedAt: "desc" },
  });
}

/** Latest snapshot per watchlist item, keyed by watchlistItemId. Used for
 *  the dashboard's at-a-glance signal badges. */
export async function getLatestSnapshotsFor(
  watchlistItemIds: string[]
): Promise<Map<string, { compositeLabel: string | null; compositeScore: number | null }>> {
  if (watchlistItemIds.length === 0) return new Map();

  const snapshots = await prisma.analysisSnapshot.findMany({
    where: { watchlistItemId: { in: watchlistItemIds } },
    orderBy: { computedAt: "desc" },
    select: { watchlistItemId: true, compositeLabel: true, compositeScore: true },
  });

  const map = new Map<string, { compositeLabel: string | null; compositeScore: number | null }>();
  for (const s of snapshots) {
    if (!map.has(s.watchlistItemId)) {
      map.set(s.watchlistItemId, {
        compositeLabel: s.compositeLabel,
        compositeScore: s.compositeScore,
      });
    }
  }
  return map;
}
