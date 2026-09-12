"use client";

import { useEffect, useRef, useState } from "react";
import {
  createChart,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
} from "lightweight-charts";

type RsiPoint = { date: string; value: number };

const OVERBOUGHT = 75;
const OVERSOLD = 30;

function readState(value: number): { label: string; className: string } {
  if (value >= OVERBOUGHT) {
    return { label: "買われすぎ", className: "bg-red-500/20 text-red-300 ring-1 ring-red-500/40" };
  }
  if (value <= OVERSOLD) {
    return {
      label: "売られすぎ",
      className: "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40",
    };
  }
  return { label: "中立", className: "bg-slate-800 text-slate-400" };
}

export function RsiChart({ watchlistItemId }: { watchlistItemId: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Line"> | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [latest, setLatest] = useState<number | null>(null);

  // Fetch data — reuses /api/prices/[id], which now also returns the
  // RSI(14) series computed server-side (lib/analysis/technical.ts), so
  // the chart stays consistent with the score shown in the analysis panel.
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/prices/${watchlistItemId}`);
        const data = (await res.json()) as { rsi: RsiPoint[]; error?: string };
        if (!res.ok) throw new Error(data.error ?? "取得に失敗しました。");
        if (cancelled) return;

        if (!data.rsi.length) {
          setError("RSIを算出するには価格データが不足しています。");
          return;
        }

        setLatest(data.rsi[data.rsi.length - 1].value);
        seriesRef.current?.setData(data.rsi.map((p) => ({ time: p.date, value: p.value })));
        chartRef.current?.timeScale().fitContent();
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "取得に失敗しました。");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [watchlistItemId]);

  // Set up the chart once.
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: "transparent" },
        textColor: "#94a3b8", // slate-400
      },
      grid: {
        vertLines: { color: "#1e293b" }, // slate-800
        horzLines: { color: "#1e293b" },
      },
      timeScale: { borderColor: "#334155" }, // slate-700
      rightPriceScale: { borderColor: "#334155" },
      autoSize: true,
    });

    const series = chart.addSeries(LineSeries, {
      color: "#a78bfa", // violet-400
      lineWidth: 2,
    });

    series.createPriceLine({
      price: OVERBOUGHT,
      color: "#ef4444",
      lineWidth: 1,
      lineStyle: 2,
      title: `${OVERBOUGHT} 買われすぎ`,
    });
    series.createPriceLine({
      price: OVERSOLD,
      color: "#22c55e",
      lineWidth: 1,
      lineStyle: 2,
      title: `${OVERSOLD} 売られすぎ`,
    });

    chartRef.current = chart;
    seriesRef.current = series;

    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  const state = latest !== null ? readState(latest) : null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-slate-200">RSI（14日）</h2>
        {latest !== null && (
          <span className="text-sm text-slate-400">{latest.toFixed(1)}</span>
        )}
        {state && (
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${state.className}`}>
            {state.label}
          </span>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      )}
      {loading && <p className="text-sm text-slate-500">読み込み中...</p>}

      <div
        ref={containerRef}
        className="h-48 w-full rounded-xl border border-slate-800 bg-slate-900"
      />
    </div>
  );
}
