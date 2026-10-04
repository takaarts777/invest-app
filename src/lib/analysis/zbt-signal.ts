// Pure decision for the ZBT buy signal, kept free of I/O so each state
// can be checked directly. See lib/zbt.ts for the full rule and thresholds.
export const DRAWDOWN_TRIGGER_PCT = 18.9;
export const ZBT_LEVEL = 0.4;
export const GATE_MIN_UPSIDE_PCT = 8;

export type ZbtSignalState = "fired" | "suppressed" | "waiting" | "none";

export function decideZbtSignal(input: {
  drawdownPct: number | null;
  latestEma: number | null;
  upsideToTopPct: number | null;
}): { signal: ZbtSignalState; drawdownReached: boolean; zbtReached: boolean; gateOpen: boolean } {
  const drawdownReached = input.drawdownPct !== null && input.drawdownPct >= DRAWDOWN_TRIGGER_PCT;
  const zbtReached = input.latestEma !== null && input.latestEma <= ZBT_LEVEL;
  const gateOpen = input.upsideToTopPct !== null && input.upsideToTopPct > GATE_MIN_UPSIDE_PCT;

  let signal: ZbtSignalState = "none";
  if (drawdownReached && zbtReached) signal = gateOpen ? "fired" : "suppressed";
  else if (drawdownReached) signal = "waiting";

  return { signal, drawdownReached, zbtReached, gateOpen };
}
