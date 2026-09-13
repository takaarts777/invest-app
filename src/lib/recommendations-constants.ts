// Split out from recommendations.ts (which is "server-only") so client
// components can import these without pulling the server-only scan
// logic — and its Yahoo Finance/Prisma-adjacent dependency chain — into
// the browser bundle.
export type InvestmentHorizon = "short" | "medium" | "long";

export const HORIZON_LABEL: Record<InvestmentHorizon, string> = {
  short: "短期",
  medium: "中期",
  long: "長期",
};

// Not a strict cutoff — a rough read-through of how long the underlying
// indicator each bucket leans on actually takes to play out (RSI/
// divergence ≈ weeks, MACD/SMA20 ≈ months, SMA50/200 & golden cross ≈
// 6mo+). Shown alongside the label so "短期/中期/長期" isn't left
// ambiguous to the viewer.
export const HORIZON_PERIOD: Record<InvestmentHorizon, string> = {
  short: "数日〜1ヶ月程度",
  medium: "1〜6ヶ月程度",
  long: "6ヶ月〜数年程度",
};
