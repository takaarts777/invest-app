import type { WatchlistItem } from "@prisma/client";
import * as finnhub from "@/lib/providers/finnhub";
import { SECTOR_BASKETS, type SectorBasket } from "@/lib/data/sector-baskets";

const LOOKBACK_DAYS = 180;

export type SmartMoneyMetrics =
  | {
      available: true;
      /** "company" = a single stock's own insiders; "sector" = a basket
       *  of representative constituents used as a proxy (ETFs have no
       *  insiders of their own). */
      scope: "company" | "sector";
      sectorName?: string;
      constituents?: string[];
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

type Aggregate = { buyValueUsd: number; sellValueUsd: number; buyCount: number; sellCount: number };

function emptyAggregate(): Aggregate {
  return { buyValueUsd: 0, sellValueUsd: 0, buyCount: 0, sellCount: 0 };
}

// Only open-market purchases (P) and sales (S) are genuinely discretionary
// signals — option exercises, grants, and gifts (M/A/G/…) are routine and
// much less informative, so we exclude them.
function aggregateTransactions(
  transactions: finnhub.FinnhubInsiderTransaction[],
  cutoff: number
): Aggregate {
  const agg = emptyAggregate();
  for (const t of transactions) {
    const date = new Date(t.transactionDate ?? "").getTime();
    if (Number.isNaN(date) || date < cutoff) continue;
    if (t.transactionCode !== "P" && t.transactionCode !== "S") continue;

    const shares = Math.abs(t.change ?? t.share ?? 0);
    const value = shares * (t.transactionPrice ?? 0);
    if (t.transactionCode === "P") {
      agg.buyValueUsd += value;
      agg.buyCount++;
    } else {
      agg.sellValueUsd += value;
      agg.sellCount++;
    }
  }
  return agg;
}

function addInto(target: Aggregate, source: Aggregate) {
  target.buyValueUsd += source.buyValueUsd;
  target.sellValueUsd += source.sellValueUsd;
  target.buyCount += source.buyCount;
  target.sellCount += source.sellCount;
}

function scoreFrom(agg: Aggregate): number {
  const total = agg.buyValueUsd + agg.sellValueUsd;
  return total > 0 ? (agg.buyValueUsd - agg.sellValueUsd) / total : 0;
}

async function analyzeCompanySmartMoney(symbol: string): Promise<SmartMoneyMetrics> {
  try {
    const transactions = await finnhub.fetchInsiderTransactions(symbol);
    const cutoff = Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000;
    const agg = aggregateTransactions(transactions, cutoff);

    if (agg.buyCount + agg.sellCount === 0) {
      return {
        available: false,
        reason: `直近${LOOKBACK_DAYS}日間に開示された自社株売買（Form 4）が見つかりませんでした。`,
      };
    }

    const score = scoreFrom(agg);
    const signals = [
      `直近${LOOKBACK_DAYS}日間: 買い${agg.buyCount}件(${fmtM(agg.buyValueUsd)})・売り${agg.sellCount}件(${fmtM(
        agg.sellValueUsd
      )})`,
      score > 0.3
        ? "インサイダーの買いが売りを上回っている（強気材料）"
        : score < -0.3
          ? "インサイダーの売りが買いを上回っている（弱気材料。ただし節税・分散目的の計画的売却も多く含まれる点に注意）"
          : "インサイダーの売買はおおむね拮抗している",
    ];

    return { available: true, scope: "company", score, signals, ...agg };
  } catch (error) {
    return {
      available: false,
      reason: error instanceof Error ? error.message : "取得に失敗しました。",
    };
  }
}

/** Aggregates insider buy/sell across a basket of representative
 *  constituents — used both as a sector-ETF proxy (see SECTOR_BASKETS)
 *  and for the dashboard's market-wide reference (MARKET_WIDE_BASKET). */
export async function analyzeSectorBasket(basket: SectorBasket): Promise<SmartMoneyMetrics> {
  const cutoff = Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000;
  const results = await Promise.allSettled(
    basket.symbols.map((s) => finnhub.fetchInsiderTransactions(s))
  );

  const total = emptyAggregate();
  let anySuccess = false;
  for (const r of results) {
    if (r.status !== "fulfilled") continue;
    anySuccess = true;
    addInto(total, aggregateTransactions(r.value, cutoff));
  }

  if (!anySuccess) {
    return {
      available: false,
      reason:
        "構成銘柄のインサイダー取引データを取得できませんでした（FINNHUB_API_KEYをご確認ください）。",
    };
  }

  const score = scoreFrom(total);
  const signals = [
    `${basket.name}の主要${basket.symbols.length}銘柄合算・直近${LOOKBACK_DAYS}日間: 買い${total.buyCount}件(${fmtM(
      total.buyValueUsd
    )})・売り${total.sellCount}件(${fmtM(total.sellValueUsd)})`,
    score > 0.3
      ? "セクター全体でインサイダーの買いが優勢（強気材料）"
      : score < -0.3
        ? "セクター全体でインサイダーの売りが優勢（弱気材料。ただし大型株は報酬株(RSU)の定期的な売却が売り件数・金額を恒常的に押し上げやすく、単独の弱気シグナルとして過信しないよう注意）"
        : "セクター全体では売買が拮抗",
    `対象銘柄（手動選定の代表構成銘柄。ETFの公式保有銘柄・構成比率とは異なります）: ${basket.symbols.join(
      "、"
    )}`,
  ];

  return {
    available: true,
    scope: "sector",
    sectorName: basket.name,
    constituents: basket.symbols,
    score,
    signals,
    ...total,
  };
}

/**
 * "Smart Money" proxy: net insider (officer/director/large-shareholder)
 * open-market buying vs. selling over the trailing 180 days, from public
 * Form 4 filings via Finnhub.
 * - US stocks: the company's own insiders.
 * - Leveraged/sector ETFs with a registered basket (SECTOR_BASKETS): the
 *   sector's representative constituents, since the ETF itself has none.
 * - Everything else (crypto, unregistered ETFs): not available.
 */
export async function analyzeSmartMoney(item: WatchlistItem): Promise<SmartMoneyMetrics> {
  if (item.assetType === "US_STOCK") {
    return analyzeCompanySmartMoney(item.symbol);
  }

  if (item.assetType === "LEVERAGED_ETF") {
    const basket = SECTOR_BASKETS[item.symbol];
    if (basket) return analyzeSectorBasket(basket);
    return {
      available: false,
      reason: "このETFの構成セクターが未登録のため、インサイダー取引を集計できません。",
    };
  }

  return {
    available: false,
    reason: "インサイダー取引データは米国株・一部のセクターETFのみ対応です。",
  };
}
