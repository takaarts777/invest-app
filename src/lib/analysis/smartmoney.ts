import type { WatchlistItem } from "@prisma/client";
import * as finnhub from "@/lib/providers/finnhub";

const LOOKBACK_DAYS = 180;

export type SmartMoneyMetrics =
  | {
      available: true;
      buyCount: number;
      sellCount: number;
      buyValueUsd: number;
      sellValueUsd: number;
      /** -1 (net selling) .. +1 (net buying), weighted by dollar value. */
      score: number;
      signals: string[];
    }
  | { available: false; reason: string };

function fmtM(usd: number): string {
  return `$${(usd / 1e6).toFixed(2)}M`;
}

/**
 * "Smart Money" proxy: net insider (officer/director/large-shareholder)
 * open-market buying vs. selling over the trailing 180 days, from public
 * Form 4 filings via Finnhub. Stocks only — ETFs have no company insiders
 * and crypto has no equivalent public filing regime.
 */
export async function analyzeSmartMoney(
  item: WatchlistItem
): Promise<SmartMoneyMetrics> {
  if (item.assetType !== "US_STOCK") {
    return {
      available: false,
      reason: "インサイダー取引データは米国株のみ対応です。",
    };
  }

  try {
    const transactions = await finnhub.fetchInsiderTransactions(item.symbol);
    const cutoff = Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000;

    // Only open-market purchases (P) and sales (S) are genuinely
    // discretionary signals — option exercises, grants, and gifts (M/A/G/…)
    // are routine and much less informative, so we exclude them.
    const relevant = transactions.filter((t) => {
      const date = new Date(t.transactionDate ?? "").getTime();
      return (
        !Number.isNaN(date) &&
        date >= cutoff &&
        (t.transactionCode === "P" || t.transactionCode === "S")
      );
    });

    if (relevant.length === 0) {
      return {
        available: false,
        reason: `直近${LOOKBACK_DAYS}日間に開示された自社株売買（Form 4）が見つかりませんでした。`,
      };
    }

    let buyValueUsd = 0;
    let sellValueUsd = 0;
    let buyCount = 0;
    let sellCount = 0;

    for (const t of relevant) {
      const shares = Math.abs(t.change ?? t.share ?? 0);
      const price = t.transactionPrice ?? 0;
      const value = shares * price;
      if (t.transactionCode === "P") {
        buyValueUsd += value;
        buyCount++;
      } else {
        sellValueUsd += value;
        sellCount++;
      }
    }

    const totalValue = buyValueUsd + sellValueUsd;
    const score = totalValue > 0 ? (buyValueUsd - sellValueUsd) / totalValue : 0;

    const signals = [
      `直近${LOOKBACK_DAYS}日間: 買い${buyCount}件(${fmtM(buyValueUsd)})・売り${sellCount}件(${fmtM(
        sellValueUsd
      )})`,
    ];
    if (score > 0.3) {
      signals.push("インサイダーの買いが売りを上回っている（強気材料）");
    } else if (score < -0.3) {
      signals.push(
        "インサイダーの売りが買いを上回っている（弱気材料。ただし節税・分散目的の計画的売却も多く含まれる点に注意）"
      );
    } else {
      signals.push("インサイダーの売買はおおむね拮抗している");
    }

    return { available: true, buyCount, sellCount, buyValueUsd, sellValueUsd, score, signals };
  } catch (error) {
    return {
      available: false,
      reason: error instanceof Error ? error.message : "取得に失敗しました。",
    };
  }
}
