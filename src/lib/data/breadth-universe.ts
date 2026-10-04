// A ~110-name, sector-diversified sample of large-cap S&P 500
// constituents, used as a breadth-calculation universe for the ZBT
// (Zweig Breadth Thrust) indicator and as the candidate pool for the
// market-wide stock recommendations.
//
// The real ZBT uses exchange-licensed NYSE (or full S&P 500)
// advance/decline counts across all ~503 constituents — that data isn't
// freely available, and fetching all 503 tickers individually from Yahoo
// Finance on every computation isn't practical. This representative
// sample (~10 well-known large caps per GICS sector) approximates the
// same breadth concept at a fraction of the API calls. It will track the
// real thing directionally but won't reproduce it exactly — treat the
// signal as a rough proxy, not the official indicator.
//
// Grouped by sector (Japanese label) so each symbol can be shown with
// its sector; BREADTH_UNIVERSE below is the flat list, same order.
export const BREADTH_SECTORS: Record<string, string[]> = {
  情報技術: ["AAPL", "MSFT", "NVDA", "AVGO", "ORCL", "CRM", "ADBE", "CSCO", "AMD", "QCOM"],
  通信サービス: ["GOOGL", "META", "NFLX", "DIS", "CMCSA", "T", "VZ", "TMUS", "CHTR", "EA"],
  一般消費財: ["AMZN", "TSLA", "HD", "MCD", "NKE", "LOW", "SBUX", "BKNG", "TJX", "MAR"],
  生活必需品: ["PG", "KO", "PEP", "WMT", "COST", "PM", "MO", "CL", "MDLZ", "TGT"],
  金融: ["JPM", "BAC", "WFC", "GS", "MS", "C", "AXP", "BLK", "SCHW", "SPGI"],
  ヘルスケア: ["LLY", "UNH", "JNJ", "ABBV", "MRK", "PFE", "TMO", "ABT", "DHR", "GILD"],
  資本財: ["CAT", "HON", "UPS", "BA", "GE", "RTX", "LMT", "DE", "UNP", "MMM"],
  エネルギー: ["XOM", "CVX", "COP", "SLB", "EOG", "MPC", "PSX", "OXY", "WMB", "VLO"],
  公益事業: ["NEE", "DUK", "SO", "D", "AEP", "EXC", "SRE", "XEL", "ED", "PEG"],
  不動産: ["PLD", "AMT", "EQIX", "PSA", "O", "SPG", "WELL", "DLR", "CCI", "AVB"],
  素材: ["LIN", "SHW", "APD", "ECL", "FCX", "NEM", "DOW", "NUE", "VMC", "MLM"],
};

export const BREADTH_UNIVERSE: string[] = Object.values(BREADTH_SECTORS).flat();

const SECTOR_BY_SYMBOL = new Map<string, string>(
  Object.entries(BREADTH_SECTORS).flatMap(([sector, symbols]) =>
    symbols.map((s) => [s, sector] as const)
  )
);

export function sectorOf(symbol: string): string | null {
  return SECTOR_BY_SYMBOL.get(symbol) ?? null;
}
