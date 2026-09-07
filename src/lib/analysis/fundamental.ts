import type { WatchlistItem } from "@prisma/client";
import * as finnhub from "@/lib/providers/finnhub";
import * as coingecko from "@/lib/providers/coingecko";

export type StockFundamentals = {
  kind: "stock";
  available: true;
  peRatio: number | null;
  pbRatio: number | null;
  roe: number | null;
  profitMargin: number | null;
  revenueGrowth: number | null;
  dividendYield: number | null;
  score: number;
  signals: string[];
};

export type CryptoFundamentals = {
  kind: "crypto";
  available: true;
  marketCapRank: number | null;
  marketCapUsd: number | null;
  circulatingSupply: number | null;
  maxSupply: number | null;
  athChangePercent: number | null;
  priceChangePercent30d: number | null;
  score: number;
  signals: string[];
};

export type UnavailableFundamentals = {
  kind: "unavailable";
  available: false;
  reason: string;
};

export type FundamentalMetrics =
  | StockFundamentals
  | CryptoFundamentals
  | UnavailableFundamentals;

async function analyzeCrypto(item: WatchlistItem): Promise<FundamentalMetrics> {
  try {
    const detail = await coingecko.fetchCoinDetail(item.providerId);
    let score = 0;
    let n = 0;
    const signals: string[] = [];

    if (detail.athChangePercent !== null) {
      n++;
      if (detail.athChangePercent < -50) {
        score += 1;
        signals.push(
          `史上最高値から${detail.athChangePercent.toFixed(0)}%下落（過去の高値対比では割安な水準）`
        );
      } else if (detail.athChangePercent > -10) {
        score -= 1;
        signals.push(
          `史上最高値からわずか${Math.abs(detail.athChangePercent).toFixed(0)}%の水準`
        );
      } else {
        signals.push(`史上最高値から${detail.athChangePercent.toFixed(0)}%の位置`);
      }
    }

    if (detail.priceChangePercent30d !== null) {
      n++;
      const p = detail.priceChangePercent30d;
      if (p > 0) {
        score += 0.3;
        signals.push(`直近30日で${p.toFixed(1)}%上昇`);
      } else {
        score -= 0.3;
        signals.push(`直近30日で${p.toFixed(1)}%下落`);
      }
    }

    if (detail.maxSupply && detail.circulatingSupply) {
      const ratio = (detail.circulatingSupply / detail.maxSupply) * 100;
      signals.push(`流通供給量は上限の${ratio.toFixed(0)}%（希薄化余地: 残り${(100 - ratio).toFixed(0)}%）`);
    } else if (detail.circulatingSupply) {
      signals.push("発行上限なし（インフレ型トークン）");
    }

    if (detail.marketCapRank !== null) {
      signals.push(`時価総額ランキング ${detail.marketCapRank}位`);
    }

    return {
      kind: "crypto",
      available: true,
      marketCapRank: detail.marketCapRank,
      marketCapUsd: detail.marketCapUsd,
      circulatingSupply: detail.circulatingSupply,
      maxSupply: detail.maxSupply,
      athChangePercent: detail.athChangePercent,
      priceChangePercent30d: detail.priceChangePercent30d,
      score: n > 0 ? score / n : 0,
      signals,
    };
  } catch (error) {
    return {
      kind: "unavailable",
      available: false,
      reason: error instanceof Error ? error.message : "取得に失敗しました。",
    };
  }
}

async function analyzeStockOrEtf(item: WatchlistItem): Promise<FundamentalMetrics> {
  try {
    const data = await finnhub.fetchBasicFinancials(item.symbol);
    const m = data.metric ?? {};

    let score = 0;
    let n = 0;
    const signals: string[] = [];

    const pe = m.peBasicExclExtraTTM ?? m.peInclExtraTTM ?? null;
    if (pe !== null && pe > 0) {
      n++;
      if (pe < 15) {
        score += 1;
        signals.push(`PER ${pe.toFixed(1)}倍は割安水準`);
      } else if (pe > 30) {
        score -= 1;
        signals.push(`PER ${pe.toFixed(1)}倍は割高水準`);
      } else {
        signals.push(`PERは${pe.toFixed(1)}倍`);
      }
    }

    const roe = m.roeTTM ?? m.roeRfy ?? null;
    if (roe !== null) {
      n++;
      if (roe > 15) {
        score += 1;
        signals.push(`ROE ${roe.toFixed(1)}%は高水準`);
      } else if (roe < 5) {
        score -= 1;
        signals.push(`ROE ${roe.toFixed(1)}%は低水準`);
      } else {
        signals.push(`ROEは${roe.toFixed(1)}%`);
      }
    }

    const growth = m.revenueGrowthTTM ?? null;
    if (growth !== null) {
      n++;
      if (growth > 10) {
        score += 1;
        signals.push(`売上成長率 前年比${growth.toFixed(1)}%`);
      } else if (growth < 0) {
        score -= 1;
        signals.push(`売上が前年比${growth.toFixed(1)}%減少`);
      } else {
        signals.push(`売上成長率は前年比${growth.toFixed(1)}%`);
      }
    }

    if (item.assetType === "LEVERAGED_ETF" && n === 0) {
      signals.push(
        "レバレッジETFのため、通常の株式指標（PER/ROE等）は該当データなし。値動きの特性は「アノマリー」タブの減価リスク欄を参照。"
      );
    }

    return {
      kind: "stock",
      available: true,
      peRatio: pe,
      pbRatio: m.pbAnnual ?? m.pbQuarterly ?? null,
      roe,
      profitMargin: m.netProfitMarginTTM ?? null,
      revenueGrowth: growth,
      dividendYield: m.dividendYieldIndicatedAnnual ?? null,
      score: n > 0 ? score / n : 0,
      signals,
    };
  } catch (error) {
    return {
      kind: "unavailable",
      available: false,
      reason: error instanceof Error ? error.message : "取得に失敗しました。",
    };
  }
}

export async function analyzeFundamental(
  item: WatchlistItem
): Promise<FundamentalMetrics> {
  return item.assetType === "CRYPTO"
    ? analyzeCrypto(item)
    : analyzeStockOrEtf(item);
}
