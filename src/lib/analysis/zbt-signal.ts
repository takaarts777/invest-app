// Pure decision for the ZBT buy signal, kept free of I/O so each state
// can be checked directly. See lib/zbt.ts for the data side.
export const DRAWDOWN_TRIGGER_PCT = 18;
export const ZBT_DIP_LEVEL = 0.41;
export const ZBT_POP_LEVEL = 0.6;
export const POP_WINDOW_DAYS = 10;
export const RSI_LEVEL = 30;
export const GATE_MIN_UPSIDE_PCT = 8;

export type ZbtSignalState = "fired" | "suppressed" | "waiting" | "none";

/**
 * Conditions (all required for fired):
 *  1. S&P 500 is down >= DRAWDOWN_TRIGGER_PCT from its current-cycle high
 *  2. The ZBT EMA has been <= ZBT_DIP_LEVEL, and within POP_WINDOW_DAYS
 *     trading days after that dip it rose to >= ZBT_POP_LEVEL
 *  3. S&P 500 RSI(14) <= RSI_LEVEL
 *  4. Upside to the predicted cycle top > GATE_MIN_UPSIDE_PCT
 *
 * fired:      1-4 hold.
 * suppressed: 1-3 hold, but the upside gate (4) is closed.
 * waiting:    the drawdown (1) is in place and a dip (2) has happened
 *             (its pop hasn't come yet), or 1 holds on its own.
 * none:       otherwise.
 */
export function decideZbtSignal(input: {
  drawdownPct: number | null;
  /** ZBT EMA values, oldest first. */
  emaSeries: number[];
  rsi14: number | null;
  upsideToTopPct: number | null;
}): {
  signal: ZbtSignalState;
  drawdownReached: boolean;
  /** Index into emaSeries of the most recent dip, if any. */
  dipIndex: number | null;
  /** Index into emaSeries of the pop that completed the pattern, if any. */
  popIndex: number | null;
  zbtPopped: boolean;
  rsiReached: boolean;
  gateOpen: boolean;
} {
  const drawdownReached = input.drawdownPct !== null && input.drawdownPct >= DRAWDOWN_TRIGGER_PCT;
  const rsiReached = input.rsi14 !== null && input.rsi14 <= RSI_LEVEL;
  const gateOpen = input.upsideToTopPct !== null && input.upsideToTopPct > GATE_MIN_UPSIDE_PCT;

  // Most recent dip to <= 0.41, then the first pop to >= 0.6 within the window.
  const series = input.emaSeries;
  let dipIndex: number | null = null;
  for (let i = series.length - 1; i >= 0; i--) {
    if (series[i] <= ZBT_DIP_LEVEL) {
      dipIndex = i;
      break;
    }
  }
  let popIndex: number | null = null;
  if (dipIndex !== null) {
    const last = Math.min(dipIndex + POP_WINDOW_DAYS, series.length - 1);
    for (let j = dipIndex + 1; j <= last; j++) {
      if (series[j] >= ZBT_POP_LEVEL) {
        popIndex = j;
        break;
      }
    }
  }
  const zbtPopped = popIndex !== null;

  let signal: ZbtSignalState = "none";
  if (drawdownReached && zbtPopped && rsiReached) {
    signal = gateOpen ? "fired" : "suppressed";
  } else if (drawdownReached) {
    signal = "waiting";
  }

  return { signal, drawdownReached, dipIndex, popIndex, zbtPopped, rsiReached, gateOpen };
}
