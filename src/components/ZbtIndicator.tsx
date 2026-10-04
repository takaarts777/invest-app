"use client";

import { useEffect, useRef, useState } from "react";
import { createChart, LineSeries, type IChartApi } from "lightweight-charts";

type ZbtPoint = { date: string; ratio: number; ema: number };
type ZbtSignal = "fired" | "suppressed" | "waiting" | "none";

type ZbtData = {
  series: ZbtPoint[];
  latestEma: number | null;
  signal: ZbtSignal;
  dipDate: string | null;
  universeSize: number;
  sampledSize: number;
  sp500: {
    drawdownPct: number | null;
    drawdownReached: boolean;
    rsi14: number | null;
    rsiReached: boolean;
    upsideToTopPct: number | null;
    gateOpen: boolean;
    predictedTopClose: number | null;
    predictedTopDate: string | null;
  } | null;
};

// Mirrors DRAWDOWN_TRIGGER_PCT / ZBT_LEVEL / GATE_MIN_UPSIDE_PCT in
// lib/zbt.ts — kept here as literals for display only.
const DRAWDOWN_TRIGGER_PCT = 18.9;
const ZBT_LEVEL = 0.4;
const RSI_LEVEL = 30;
const GATE_MIN_UPSIDE_PCT = 8;

const SIGNAL_BANNER: Record<ZbtSignal, { text: string; className: string } | null> = {
  fired: {
    text: "🚀 ZBT買いシグナル点灯！ S&P500の高値から18.9%以上の下落 ＋ ZBT 0.40以下 ＋ RSI30以下 ＋ 上昇余地8%超",
    className: "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/50",
  },
  suppressed: {
    text: "⏸ 条件は揃っているが、シグナルは抑制中（サイクル上の上昇余地が8%以下のため）",
    className: "bg-slate-700/50 text-slate-300",
  },
  waiting: {
    text: "S&P500は18.9%以上下落済み。ZBT 0.40以下・RSI30以下の成立を待機中",
    className: "bg-amber-500/15 text-amber-300",
  },
  none: null,
};

export function ZbtIndicator() {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  const [data, setData] = useState<ZbtData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/zbt");
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "取得に失敗しました。");
        if (cancelled) return;

        setData(json);

        if (chartRef.current && json.series.length > 0) {
          const emaSeries = chartRef.current.addSeries(LineSeries, {
            color: "#38bdf8",
            lineWidth: 2,
          });
          emaSeries.setData(
            json.series.map((p: ZbtPoint) => ({ time: p.date, value: p.ema }))
          );
          emaSeries.createPriceLine({
            price: ZBT_LEVEL,
            color: "#ef4444",
            lineWidth: 1,
            lineStyle: 2,
            title: "0.40",
          });
          chartRef.current.timeScale().fitContent();
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "取得に失敗しました。");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: { background: { color: "transparent" }, textColor: "#94a3b8" },
      grid: {
        vertLines: { color: "#1e293b" },
        horzLines: { color: "#1e293b" },
      },
      timeScale: { borderColor: "#334155" },
      rightPriceScale: { borderColor: "#334155" },
      autoSize: true,
    });
    chartRef.current = chart;

    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, []);

  const banner = data ? SIGNAL_BANNER[data.signal] : null;
  const sp = data?.sp500;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <h2 className="text-sm font-semibold text-slate-200">
        ZBT指標（Zweig Breadth Thrust・S&amp;P500近似）
      </h2>
      <p className="mt-1 text-xs text-slate-500">
        買いシグナルは「S&amp;P500が現在のサイクルの高値から{DRAWDOWN_TRIGGER_PCT}%以上下落」し、かつ「値上がり銘柄比率の10日EMAが{ZBT_LEVEL}以下」かつ「S&P500のRSI(14)が{RSI_LEVEL}以下」の時に発動します。さらにS&P500のRSI(14)が30以下であること、かつサイクル上の上昇余地（予測天井までの距離）が{GATE_MIN_UPSIDE_PCT}%を超えている場合に限ります。S&amp;P500の主要{data?.universeSize ?? 110}銘柄のサンプルによる近似値です。
      </p>

      {error && (
        <p className="mt-2 text-sm text-red-400" role="alert">
          {error}
        </p>
      )}
      {loading && <p className="mt-2 text-sm text-slate-500">読み込み中...</p>}

      {data && (
        <>
          {banner && (
            <div
              className={`mt-3 rounded-lg px-3 py-2 text-center text-sm font-semibold ${banner.className}`}
            >
              {banner.text}
            </div>
          )}

          <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-slate-300 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg bg-slate-950/40 px-3 py-2">
              <p className="text-xs text-slate-500">S&amp;P500 高値からの下落（条件 {DRAWDOWN_TRIGGER_PCT}%以上）</p>
              <p className={sp?.drawdownReached ? "font-semibold text-emerald-300" : "font-semibold text-slate-100"}>
                {sp?.drawdownPct != null ? `${sp.drawdownPct.toFixed(1)}%` : "-"}
              </p>
            </div>
            <div className="rounded-lg bg-slate-950/40 px-3 py-2">
              <p className="text-xs text-slate-500">ZBT 10日EMA（条件 {ZBT_LEVEL}以下）</p>
              <p className={data.latestEma !== null && data.latestEma <= ZBT_LEVEL ? "font-semibold text-emerald-300" : "font-semibold text-slate-100"}>
                {data.latestEma !== null ? data.latestEma.toFixed(3) : "-"}
              </p>
            </div>
            <div className="rounded-lg bg-slate-950/40 px-3 py-2">
              <p className="text-xs text-slate-500">S&amp;P500 RSI(14)（条件 {RSI_LEVEL}以下）</p>
              <p className={sp?.rsiReached ? "font-semibold text-emerald-300" : "font-semibold text-slate-100"}>
                {sp?.rsi14 != null ? sp.rsi14.toFixed(1) : "-"}
              </p>
            </div>
            <div className="rounded-lg bg-slate-950/40 px-3 py-2">
              <p className="text-xs text-slate-500">サイクル上の上昇余地（条件 {GATE_MIN_UPSIDE_PCT}%超）</p>
              <p className={sp?.gateOpen ? "font-semibold text-emerald-300" : "font-semibold text-slate-100"}>
                {sp?.upsideToTopPct != null ? `${sp.upsideToTopPct >= 0 ? "+" : ""}${sp.upsideToTopPct.toFixed(1)}%` : "-"}
              </p>
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-slate-600">
            {data.dipDate && <span>直近のZBT 0.40以下: {data.dipDate}</span>}
            <span>サンプル {data.sampledSize}/{data.universeSize} 銘柄</span>
          </div>
        </>
      )}

      <div ref={containerRef} className="mt-3 h-56 w-full" />
    </div>
  );
}
