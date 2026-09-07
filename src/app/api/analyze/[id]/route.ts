import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/session";
import { getWatchlistItem } from "@/lib/market";
import { runFullAnalysis } from "@/lib/analysis/signal";
import { prisma } from "@/lib/db";

export async function POST(
  _request: Request,
  ctx: RouteContext<"/api/analyze/[id]">
) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const item = await getWatchlistItem(id);
  if (!item) {
    return NextResponse.json({ error: "銘柄が見つかりません。" }, { status: 404 });
  }

  try {
    const result = await runFullAnalysis(item);

    const snapshot = await prisma.analysisSnapshot.create({
      data: {
        watchlistItemId: item.id,
        technicalScore: result.technical?.score ?? null,
        fundamentalScore: result.fundamental.available ? result.fundamental.score : null,
        sentimentScore: result.sentiment?.score ?? null,
        anomalyScore: result.anomaly?.score ?? null,
        compositeScore: result.compositeScore,
        compositeLabel: result.compositeLabel,
        rationale: result.rationale,
        rawDetails: JSON.stringify({
          technical: result.technical,
          fundamental: result.fundamental,
          sentiment: result.sentiment,
          sentimentError: result.sentimentError,
          anomaly: result.anomaly,
        }),
      },
    });

    return NextResponse.json({ snapshot });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "分析に失敗しました。";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
