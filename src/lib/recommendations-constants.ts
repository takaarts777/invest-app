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
