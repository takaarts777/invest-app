import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/session";
import { removeWatchlistItem } from "@/lib/market";

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/watchlist/[id]">
) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;

  try {
    await removeWatchlistItem(id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "削除に失敗しました。" }, { status: 400 });
  }
}
