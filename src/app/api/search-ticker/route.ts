import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/session";
import * as yahoo from "@/lib/providers/yahoo";
import * as coingecko from "@/lib/providers/coingecko";
import type { AssetType } from "@prisma/client";

export type TickerSearchResult = {
  symbol: string;
  name: string;
  providerId: string;
  detail: string; // exchange (stocks/ETF) or "CoinGecko" id hint (crypto)
};

export async function GET(request: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const assetType = searchParams.get("assetType") as AssetType | null;

  if (q.length < 1 || !assetType) {
    return NextResponse.json({ results: [] });
  }

  try {
    let results: TickerSearchResult[];

    if (assetType === "CRYPTO") {
      const coins = await coingecko.searchCoins(q, 8);
      results = coins.map((c) => ({
        symbol: c.symbol.toUpperCase(),
        name: c.name,
        providerId: c.id,
        detail: c.id,
      }));
    } else {
      const quotes = await yahoo.searchQuotes(q, 8);
      results = quotes.map((qt) => ({
        symbol: qt.symbol,
        name: qt.name,
        providerId: qt.symbol,
        detail: qt.exchange,
      }));
    }

    return NextResponse.json({ results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "検索に失敗しました。";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
