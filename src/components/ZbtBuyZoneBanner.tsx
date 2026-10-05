import type { ZbtResult } from "@/lib/zbt";

// Shown at the top of the dashboard only while the ZBT buy signal is fired.
// Server-rendered from getZbtIndicator(), so it doesn't need a client fetch.
export function ZbtBuyZoneBanner({ zbt }: { zbt: ZbtResult }) {
  const sp = zbt.sp500;
  const fmt = (n: number | null | undefined, d = 1) => (n === null || n === undefined ? "-" : n.toFixed(d));

  return (
    <section
      role="status"
      aria-live="polite"
      className="relative overflow-hidden rounded-2xl border-2 border-emerald-400 bg-gradient-to-r from-emerald-600/30 via-emerald-500/20 to-emerald-600/30 p-5 shadow-[0_0_40px_-8px_rgba(52,211,153,0.6)]"
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className="relative flex h-4 w-4">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-4 w-4 rounded-full bg-emerald-400" />
        </span>
        <p className="text-2xl font-extrabold tracking-wide text-emerald-200 sm:text-3xl">
          🟢 買い場：ZBT買いシグナル発動中
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <div className="rounded-lg bg-slate-950/50 px-3 py-2">
          <p className="text-xs text-slate-400">高値からの下落</p>
          <p className="font-semibold text-slate-100">{fmt(sp?.drawdownPct)}%</p>
        </div>
        <div className="rounded-lg bg-slate-950/50 px-3 py-2">
          <p className="text-xs text-slate-400">S&amp;P500 RSI(14)</p>
          <p className="font-semibold text-slate-100">{fmt(sp?.rsi14)}</p>
        </div>
        <div className="rounded-lg bg-slate-950/50 px-3 py-2">
          <p className="text-xs text-slate-400">ZBT 10日EMA</p>
          <p className="font-semibold text-slate-100">{fmt(zbt.latestEma, 3)}</p>
        </div>
        <div className="rounded-lg bg-slate-950/50 px-3 py-2">
          <p className="text-xs text-slate-400">2年後の予測最高値</p>
          <p className="font-semibold text-emerald-300">
            {sp?.predictedTopClose ? Math.round(sp.predictedTopClose).toLocaleString() : "-"}
            {sp?.predictedTopDate && <span className="ml-1 text-xs font-normal text-slate-400">（{sp.predictedTopDate}頃）</span>}
          </p>
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-400">
        条件：高値から下落・ZBTが0.41以下から10営業日以内に0.6超え・RSI30以下・上昇余地8%超。投資助言ではなく、機械的な条件の一致を知らせる表示です。
      </p>
    </section>
  );
}
