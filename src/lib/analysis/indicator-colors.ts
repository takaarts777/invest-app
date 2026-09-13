// Shared between the charts (PriceChart/RsiChart, which need a hex
// string for lightweight-charts) and the exit-criteria card (which
// needs a Tailwind class for a small colored dot) so a trigger like
// "価格が50日移動平均線を下回ったら" and the actual SMA50 line on the
// price chart above it are visibly the same color — the whole point
// being to connect the text to a specific line on the chart already on
// screen, rather than adding more chart panels.
export type IndicatorKind =
  | "sma20"
  | "sma50"
  | "sma200"
  | "rsi"
  | "macd"
  | "divergenceBullish"
  | "divergenceBearish"
  | "fundamental";

export const INDICATOR_COLOR: Record<IndicatorKind, { hex: string; dotClassName: string }> = {
  sma20: { hex: "#38bdf8", dotClassName: "bg-sky-400" }, // sky-400
  sma50: { hex: "#fbbf24", dotClassName: "bg-amber-400" }, // amber-400
  sma200: { hex: "#c084fc", dotClassName: "bg-purple-400" }, // purple-400
  rsi: { hex: "#a78bfa", dotClassName: "bg-violet-400" }, // violet-400, matches RsiChart's line
  macd: { hex: "#34d399", dotClassName: "bg-emerald-400" }, // emerald-400
  divergenceBullish: { hex: "#22c55e", dotClassName: "bg-emerald-500" },
  divergenceBearish: { hex: "#ef4444", dotClassName: "bg-red-500" },
  fundamental: { hex: "#94a3b8", dotClassName: "bg-slate-400" },
};
