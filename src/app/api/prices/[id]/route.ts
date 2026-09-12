import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { getWatchlistItem, fetchPriceDataFor } from "@/lib/market";

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/prices/[id]">
) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const item = await getWatchlistItem(id, userId);
  if (!item) {
    return NextResponse.json({ error: "銘柄が見つかりません。" }, { status: 404 });
  }

  try {
    const { history, quote } = await fetchPriceDataFor(item);
    return NextResponse.json({ history, quote });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "価格データの取得に失敗しました。";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
