import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { buy, sell, getSimulatorSummary } from "@/lib/simulator";
import type { AssetType } from "@prisma/client";

const VALID_ASSET_TYPES: AssetType[] = ["US_STOCK", "LEVERAGED_ETF", "CRYPTO"];

export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const symbol = typeof body?.symbol === "string" ? body.symbol : null;
  const assetType = body?.assetType as AssetType | undefined;
  const side = body?.side === "SELL" ? "SELL" : body?.side === "BUY" ? "BUY" : null;
  const quantity = typeof body?.quantity === "number" ? body.quantity : NaN;
  const providerId = typeof body?.providerId === "string" ? body.providerId : null;
  const displayName = typeof body?.displayName === "string" ? body.displayName : null;

  if (!symbol || !assetType || !VALID_ASSET_TYPES.includes(assetType) || !side || !(quantity > 0)) {
    return NextResponse.json(
      { error: "symbol・assetType・side・quantity(正の数)を指定してください。" },
      { status: 400 }
    );
  }

  try {
    if (side === "BUY") {
      const hint = providerId && displayName ? { providerId, displayName } : undefined;
      await buy(userId, symbol, assetType, quantity, hint);
    } else {
      await sell(userId, symbol, assetType, quantity);
    }
    const summary = await getSimulatorSummary(userId);
    return NextResponse.json({ summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : "取引に失敗しました。";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
