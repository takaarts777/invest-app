"use client";

import { useEffect, useRef, useState } from "react";
import { createChart, LineSeries, type IChartApi } from "lightweight-charts";

type ZbtPoint = { date: string; ratio: number; ema: number };
type ZbtSignal = "fired" | "waiting" | "none";

type ZbtData = {
  series: ZbtPoint[];
  latestEma: number | null;
  signal: ZbtSignal;
  dipDate: string | null;
  popDate: string | null;
  universeSize: number;
  sampledSize: number;
};

const SIGNAL_BANNER: Record<ZbtSignal, { text: string; className: string } | null> = {
  fired: {
    text: "🚀 ZBT買いシグナル点灯！ ①0.40割れ → ②10日以内に0.615超え が成立",
    className: "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/50",
  },
  waiting: {
    text: "条件①(0.40割れ)成立・条件②(0.615超え)を10日以内に待機中",
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
            price: 0.615,
            color: "#22c55e",
            lineWidth: 1,
            lineStyle: 2,
            title: "0.615",
          });
          emaSeries.createPriceLine({
            price: 0.4,
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

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <h2 className="text-sm font-semibold text-slate-200">
        ZBT指標（Zweig Breadth Thrust・S&amp;P500近似）
      </h2>
      <p className="mt-1 text-xs text-slate-500">
        値上がり銘柄比率の10日EMAが①0.40を下回った後、②10営業日以内に0.615を上回ると強気の「ブレッドス・スラスト」シグナルとされます。S&amp;P500の主要{data?.universeSize ?? 110}銘柄のサンプルによる近似値で、取引所ライセンスの正式な騰落銘柄数データとは異なります。
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

          <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-slate-300">
            <span>
              現在値(10日EMA):{" "}
              <span className="font-semibold text-slate-100">
                {data.latestEma !== null ? data.latestEma.toFixed(3) : "-"}
              </span>
            </span>
            {data.dipDate && <span className="text-xs text-slate-500">①0.40割れ: {data.dipDate}</span>}
            {data.popDate && <span className="text-xs text-emerald-400">②0.615超え: {data.popDate}</span>}
            <span className="text-xs text-slate-600">
              サンプル {data.sampledSize}/{data.universeSize} 銘柄
            </span>
          </div>
        </>
      )}

      <div ref={containerRef} className="mt-3 h-56 w-full" />
    </div>
  );
}
