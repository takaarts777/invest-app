import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getZbtIndicator } from "@/lib/zbt";
import { getSp500Bars, getSp500Forecast } from "@/lib/sp500-cycle";
import { realizedAfterSignal } from "@/lib/analysis/sp500-forecast";

// Runs daily (see vercel.json). Two jobs:
//  1. If the ZBT buy signal is "fired" today, record it once, keyed by the
//     day its pattern completed, with the forecast made at that time.
//  2. Fill in the realized two-year outcome for active records whose window
//     has now closed.
// Same CRON_SECRET check as /api/cron/refresh.
export const maxDuration = 60;

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const zbt = await getZbtIndicator();
  const bars = await getSp500Bars();

  let recorded: string | null = null;
  if (zbt.signal === "fired" && zbt.popDate && zbt.sp500 && zbt.latestEma !== null) {
    const exists = await prisma.zbtSignalEvent.findUnique({ where: { signalDate: zbt.popDate } });
    if (!exists) {
      const forecast = await getSp500Forecast();
      const closeAtSignal = bars.find((b) => b.date === zbt.popDate)?.close ?? forecast.latestClose;
      await prisma.zbtSignalEvent.create({
        data: {
          signalDate: zbt.popDate,
          sp500Close: closeAtSignal,
          drawdownPct: zbt.sp500.drawdownPct ?? 0,
          rsi14: zbt.sp500.rsi14 ?? 0,
          zbtEma: zbt.latestEma,
          upsidePct: zbt.sp500.upsideToTopPct ?? 0,
          medianRisePct: forecast.medianRisePct ?? 0,
          sampleSize: forecast.sampleSize,
          predictedHighClose: forecast.medianRisePct === null ? 0 : closeAtSignal * (1 + forecast.medianRisePct / 100),
          predictedHighDate: new Date(Date.parse(zbt.popDate) + 2 * 365.25 * 86400000).toISOString().slice(0, 10),
        },
      });
      recorded = zbt.popDate;
    }
  }

  const active = await prisma.zbtSignalEvent.findMany({ where: { status: "active" } });
  const completed: string[] = [];
  for (const ev of active) {
    const r = realizedAfterSignal(bars, ev.signalDate);
    if (r && r.completed && r.maxClose !== null && r.riseToPeakPct !== null) {
      await prisma.zbtSignalEvent.update({
        where: { id: ev.id },
        data: {
          status: "completed",
          realizedMaxClose: r.maxClose,
          realizedRisePct: r.riseToPeakPct,
          completedAt: new Date(),
        },
      });
      completed.push(ev.signalDate);
    }
  }

  return NextResponse.json({ signal: zbt.signal, recorded, completed });
}
