// A ~110-name, sector-diversified sample of large-cap S&P 500
// constituents, used as a breadth-calculation universe for the ZBT
// (Zweig Breadth Thrust) indicator.
//
// The real ZBT uses exchange-licensed NYSE (or full S&P 500)
// advance/decline counts across all ~503 constituents — that data isn't
// freely available, and fetching all 503 tickers individually from Yahoo
// Finance on every computation isn't practical. This representative
// sample (~10 well-known large caps per GICS sector) approximates the
// same breadth concept at a fraction of the API calls. It will track the
// real thing directionally but won't reproduce it exactly — treat the
// signal as a rough proxy, not the official indicator.
export const BREADTH_UNIVERSE: string[] = [
  // Technology
  "AAPL", "MSFT", "NVDA", "AVGO", "ORCL", "CRM", "ADBE", "CSCO", "AMD", "QCOM",
  // Communication Services
  "GOOGL", "META", "NFLX", "DIS", "CMCSA", "T", "VZ", "TMUS", "CHTR", "EA",
  // Consumer Discretionary
  "AMZN", "TSLA", "HD", "MCD", "NKE", "LOW", "SBUX", "BKNG", "TJX", "MAR",
  // Consumer Staples
  "PG", "KO", "PEP", "WMT", "COST", "PM", "MO", "CL", "MDLZ", "TGT",
  // Financials
  "JPM", "BAC", "WFC", "GS", "MS", "C", "AXP", "BLK", "SCHW", "SPGI",
  // Health Care
  "LLY", "UNH", "JNJ", "ABBV", "MRK", "PFE", "TMO", "ABT", "DHR", "GILD",
  // Industrials
  "CAT", "HON", "UPS", "BA", "GE", "RTX", "LMT", "DE", "UNP", "MMM",
  // Energy
  "XOM", "CVX", "COP", "SLB", "EOG", "MPC", "PSX", "OXY", "WMB", "VLO",
  // Utilities
  "NEE", "DUK", "SO", "D", "AEP", "EXC", "SRE", "XEL", "ED", "PEG",
  // Real Estate
  "PLD", "AMT", "EQIX", "PSA", "O", "SPG", "WELL", "DLR", "CCI", "AVB",
  // Materials
  "LIN", "SHW", "APD", "ECL", "FCX", "NEM", "DOW", "NUE", "VMC", "MLM",
];
