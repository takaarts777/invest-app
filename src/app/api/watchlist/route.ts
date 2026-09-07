import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/session";
import { addWatchlistItem, listWatchlist } from "@/lib/market";
import type { AssetType } from "@prisma/client";

const VALID_ASSET_TYPES: AssetType[] = ["US_STOCK", "LEVERAGED_ETF", "CRYPTO"];

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const items = await listWatchlist();
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const symbol = typeof body?.symbol === "string" ? body.symbol : null;
  const assetType = body?.assetType as AssetType | undefined;

  if (!symbol || !assetType || !VALID_ASSET_TYPES.includes(assetType)) {
    return NextResponse.json(
      { error: "symbol と assetType を指定してください。" },
      { status: 400 }
    );
  }

  try {
    const item = await addWatchlistItem(symbol, assetType);
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
