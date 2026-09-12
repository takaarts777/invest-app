import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { addWatchlistItem, listWatchlist } from "@/lib/market";
import type { AssetType } from "@prisma/client";

const VALID_ASSET_TYPES: AssetType[] = ["US_STOCK", "LEVERAGED_ETF", "CRYPTO"];

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const items = await listWatchlist(userId);
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const symbol = typeof body?.symbol === "string" ? body.symbol : null;
  const assetType = body?.assetType as AssetType | undefined;
  // Set when the user picked a specific result from the ticker-search
  // autocomplete rather than typing a bare symbol.
  const providerId = typeof body?.providerId === "string" ? body.providerId : null;
  const displayName = typeof body?.displayName === "string" ? body.displayName : null;

  if (!symbol || !assetType || !VALID_ASSET_TYPES.includes(assetType)) {
    return NextResponse.json(
      { error: "symbol と assetType を指定してください。" },
      { status: 400 }
    );
  }

  try {
    const hint = providerId && displayName ? { providerId, displayName } : undefined;
    const item = await addWatchlistItem(userId, symbol, assetType, hint);
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    if (
      error instanceof Error &&
      // Prisma unique constraint violation
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "この銘柄は既にウォッチリストに追加されています。" },
        { status: 409 }
      );
    }
    const message = error instanceof Error ? error.message : "追加に失敗しました。";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
