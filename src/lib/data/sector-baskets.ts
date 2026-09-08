// Hand-curated "representative holdings" baskets, used as a Smart Money
// (insider trading) proxy for sector/leveraged ETFs and for a market-wide
// reference — ETFs themselves have no company insiders to file Form 4
// trades, and free live holdings data for these funds isn't readily
// available, so we approximate with a manually chosen basket of the
// sector's best-known large constituents instead.
//
// These are NOT the fund's actual current holdings/weights — just a
// reasonable stand-in — and should be revisited occasionally as sector
// leadership shifts. Bull/bear pairs on the same underlying index share
// the same basket (the insider activity of the underlying companies
// doesn't depend on which side of the leverage you hold).

export type SectorBasket = { name: string; symbols: string[] };

export const SECTOR_BASKETS: Record<string, SectorBasket> = {
  SOXL: { name: "半導体セクター", symbols: ["NVDA", "AVGO", "TSM", "AMD", "QCOM", "TXN", "INTC", "MU", "AMAT", "LRCX"] },
  SOXS: { name: "半導体セクター", symbols: ["NVDA", "AVGO", "TSM", "AMD", "QCOM", "TXN", "INTC", "MU", "AMAT", "LRCX"] },
  TECL: { name: "テクノロジーセクター", symbols: ["AAPL", "MSFT", "NVDA", "AVGO", "ORCL", "CRM", "ADBE", "CSCO", "AMD", "QCOM"] },
  TECS: { name: "テクノロジーセクター", symbols: ["AAPL", "MSFT", "NVDA", "AVGO", "ORCL", "CRM", "ADBE", "CSCO", "AMD", "QCOM"] },
  LABU: { name: "バイオテクノロジーセクター", symbols: ["LLY", "JNJ", "ABBV", "AMGN", "GILD", "VRTX", "REGN", "MRNA", "BIIB", "ILMN"] },
  LABD: { name: "バイオテクノロジーセクター", symbols: ["LLY", "JNJ", "ABBV", "AMGN", "GILD", "VRTX", "REGN", "MRNA", "BIIB", "ILMN"] },
  FNGU: { name: "大型テック(FANG+)", symbols: ["META", "AMZN", "AAPL", "NFLX", "GOOGL", "MSFT", "NVDA", "TSLA"] },
  FNGD: { name: "大型テック(FANG+)", symbols: ["META", "AMZN", "AAPL", "NFLX", "GOOGL", "MSFT", "NVDA", "TSLA"] },
  UDOW: { name: "米国優良株(NYダウ)", symbols: ["AAPL", "MSFT", "JPM", "V", "UNH", "HD", "GS", "CAT", "MCD", "CRM"] },
  SDOW: { name: "米国優良株(NYダウ)", symbols: ["AAPL", "MSFT", "JPM", "V", "UNH", "HD", "GS", "CAT", "MCD", "CRM"] },
};

/** Broad-market proxy for the dashboard's market-wide reference panel —
 *  not tied to any specific watchlist ticker. */
export const MARKET_WIDE_BASKET: SectorBasket = {
  name: "米国大型株(主要7銘柄)",
  symbols: ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA"],
};
