import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { listWatchlist } from "@/lib/market";
import { runFullAnalysis } from "@/lib/analysis/signal";

// Triggered by Vercel Cron (see vercel.json) to keep every watchlist
// item's analysis snapshot fresh without the user needing to open each
// ticker page. Vercel automatically sends `Authorization: Bearer
// $CRON_SECRET` for scheduled invocations when CRON_SECRET is set as an
// env var — https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const items = await listWatchlist();
  const results: { id: string; symbol: string; ok: boolean; error?: string }[] = [];

  for (const item of items) {
    try {
      const analysis = await runFullAnalysis(item);
      await prisma.analysisSnapshot.create({
        data: {
          watchlistItemId: item.id,
          technicalScore: analysis.technical?.score ?? null,
          fundamentalScore: analysis.fundamental.available
            ? analysis.fundamental.score
            : null,
          sentimentScore: analysis.sentiment?.score ?? null,
          anomalyScore: analysis.anomaly?.score ?? null,
          compositeScore: analysis.compositeScore,
          compositeLabel: analysis.compositeLabel,
          rationale: analysis.rationale,
          rawDetails: JSON.stringify({
            technical: analysis.technical,
            fundamental: analysis.fundamental,
            sentiment: analysis.sentiment,
            sentimentError: analysis.sentimentError,
            anomaly: analysis.anomaly,
          }),
        },
      });
      results.push({ id: item.id, symbol: item.symbol, ok: true });
    } catch (error) {
      // Don't let one bad ticker (rate limit, delisted symbol, ...) abort
      // the refresh for the rest of the watchlist.
      results.push({
        id: item.id,
        symbol: item.symbol,
        ok: false,
        error: error instanceof Error ? error.message : "unknown error",
      });
    }
  }

  return NextResponse.json({ refreshed: results.length, results });
}
