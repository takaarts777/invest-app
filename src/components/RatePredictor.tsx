"use client";

import { useEffect, useRef, useState } from "react";
import { createChart, LineSeries, type IChartApi } from "lightweight-charts";

type RatePoint = { date: string; value: number };

type RatePredictorData = {
  history2y: RatePoint[];
  historyShortRate: RatePoint[];
  current2y: number | null;
  currentShortRate: number | null;
  spread: number | null;
  signal: "cuts" | "hikes" | "neutral" | null;
};

const SIGNAL_TEXT: Record<string, { label: string; className: string }> = {
  cuts: {
    label: "利下げ観測優勢（2年債利回り < 短期金利）",
    className: "bg-emerald-500/15 text-emerald-300",
  },
  hikes: {
    label: "利上げ観測優勢（2年債利回り > 短期金利）",
    className: "bg-red-500/15 text-red-300",
  },
  neutral: {
    label: "織り込みはニュートラル",
    className: "bg-slate-700/50 text-slate-300",
  },
};

export function RatePredictor() {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  const [data, setData] = useState<RatePredictorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/rate-predictor");
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "取得に失敗しました。");
        if (cancelled) return;

        setData(json);

        if (chartRef.current) {
          const series2y = chartRef.current.addSeries(LineSeries, {
            color: "#38bdf8",
            lineWidth: 2,
          });
          series2y.setData(
            json.history2y.map((p: RatePoint) => ({ time: p.date, value: p.value }))
          );

          const seriesShort = chartRef.current.addSeries(LineSeries, {
            color: "#fbbf24",
            lineWidth: 2,
          });
          seriesShort.setData(
            json.historyShortRate.map((p: RatePoint) => ({ time: p.date, value: p.value }))
          );

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

  const signal = data?.signal ? SIGNAL_TEXT[data.signal] : null;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <h2 className="text-sm font-semibold text-slate-200">
        米2年債利回り vs 短期金利（FRB政策金利の先行指標）
      </h2>
      <p className="mt-1 text-xs text-slate-500">
        2年債利回りは今後2年間の平均FF金利予想を織り込むため、実際のFRB政策変更に先行して動く傾向があります。両者に乖離が生じている場合、その方向が将来の利上げ/利下げの市場予想を示唆します。短期金利は13週国債利回り(^IRX)で代用（実効FF金利に近い水準で動く代表的な無料データ）。
      </p>

      {error && (
        <p className="mt-2 text-sm text-red-400" role="alert">
          {error}
        </p>
      )}
      {loading && <p className="mt-2 text-sm text-slate-500">読み込み中...</p>}

      {data && (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-sm text-slate-300">
              <span className="h-2.5 w-2.5 rounded-full bg-sky-400" />
              2年債利回り: {data.current2y !== null ? `${data.current2y.toFixed(2)}%` : "-"}
            </div>
            <div className="flex items-center gap-1.5 text-sm text-slate-300">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
              短期金利(^IRX): {data.currentShortRate !== null ? `${data.currentShortRate.toFixed(2)}%` : "-"}
            </div>
            <div className="text-sm text-slate-400">
              スプレッド: {data.spread !== null ? `${data.spread >= 0 ? "+" : ""}${data.spread.toFixed(2)}pp` : "-"}
            </div>
          </div>

          {signal && (
            <div
              className={`mt-3 rounded-lg px-3 py-2 text-center text-sm font-semibold ${signal.className}`}
            >
              {signal.label}
            </div>
          )}
        </>
      )}

      <div ref={containerRef} className="mt-3 h-64 w-full" />
    </div>
  );
}
