// Pure decision for the ZBT buy signal, kept free of I/O so each state
// can be checked directly. See lib/zbt.ts for the full rule and thresholds.
export const DRAWDOWN_TRIGGER_PCT = 18.9;
export const ZBT_LEVEL = 0.4;
export const RSI_LEVEL = 30;
export const GATE_MIN_UPSIDE_PCT = 8;

export type ZbtSignalState = "fired" | "suppressed" | "waiting" | "none";

/**
 * fired:      S&P down >= 18.9% from its cycle high, ZBT EMA <= 0.40,
 *             S&P RSI(14) <= 30, and upside to the predicted top > 8%.
 * suppressed: the first three hold but upside <= 8%.
 * waiting:    the S&P drawdown is in place, but ZBT or RSI hasn't reached
 *             its level yet.
 * none:       the drawdown condition isn't met.
 */
export function decideZbtSignal(input: {
  drawdownPct: number | null;
  latestEma: number | null;
  rsi14: number | null;
  upsideToTopPct: number | null;
}): {
  signal: ZbtSignalState;
  drawdownReached: boolean;
  zbtReached: boolean;
  rsiReached: boolean;
  gateOpen: boolean;
} {
  const drawdownReached = input.drawdownPct !== null && input.drawdownPct >= DRAWDOWN_TRIGGER_PCT;
  const zbtReached = input.latestEma !== null && input.latestEma <= ZBT_LEVEL;
  const rsiReached = input.rsi14 !== null && input.rsi14 <= RSI_LEVEL;
  const gateOpen = input.upsideToTopPct !== null && input.upsideToTopPct > GATE_MIN_UPSIDE_PCT;

  let signal: ZbtSignalState = "none";
  if (drawdownReached && zbtReached && rsiReached) {
    signal = gateOpen ? "fired" : "suppressed";
  } else if (drawdownReached) {
    signal = "waiting";
  }

  return { signal, drawdownReached, zbtReached, rsiReached, gateOpen };
}
