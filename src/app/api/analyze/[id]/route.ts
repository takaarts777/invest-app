import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/session";
import { getWatchlistItem } from "@/lib/market";
import { runFullAnalysis, snapshotDataFrom } from "@/lib/analysis/signal";
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
      data: { watchlistItemId: item.id, ...snapshotDataFrom(result) },
    });

    return NextResponse.json({ snapshot });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "分析に失敗しました。";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
