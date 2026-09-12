import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { removeWatchlistItem, setHolding } from "@/lib/market";

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/watchlist/[id]">
) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;

  try {
    await removeWatchlistItem(id, userId);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "削除に失敗しました。" }, { status: 400 });
  }
}

// Sets or clears the item's portfolio holding (quantity + average cost).
export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/watchlist/[id]">
) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const body = await request.json().catch(() => null);

  const rawQuantity = body?.quantity;
  const rawAvgCostUsd = body?.avgCostUsd;

  // Both null clears the holding; otherwise both must be positive numbers.
  const clearing = rawQuantity === null && rawAvgCostUsd === null;
  const quantity = typeof rawQuantity === "number" ? rawQuantity : null;
  const avgCostUsd = typeof rawAvgCostUsd === "number" ? rawAvgCostUsd : null;

  if (!clearing) {
    if (quantity === null || avgCostUsd === null || quantity <= 0 || avgCostUsd <= 0) {
      return NextResponse.json(
        { error: "数量・平均取得単価は正の数で指定してください。" },
        { status: 400 }
      );
    }
  }

  try {
    const item = await setHolding(id, userId, { quantity, avgCostUsd });
    return NextResponse.json({ item });
  } catch {
    return NextResponse.json({ error: "更新に失敗しました。" }, { status: 400 });
  }
}
