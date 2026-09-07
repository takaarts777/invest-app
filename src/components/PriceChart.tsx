"use client";

import { useEffect, useRef, useState } from "react";
import {
  createChart,
  CandlestickSeries,
  type IChartApi,
  type ISeriesApi,
} from "lightweight-charts";

type DailyBar = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

type Quote = { price: number; changePercent: number | null };

export function PriceChart({ watchlistItemId }: { watchlistItemId: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);

  // Fetch data.
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/prices/${watchlistItemId}`);
        const data = (await res.json()) as {
          history: DailyBar[];
          quote: Quote | null;
          error?: string;
        };
        if (!res.ok) throw new Error(data.error ?? "取得に失敗しました。");
        if (cancelled) return;

        setQuote(data.quote);

        if (!data.history.length) {
          setError("価格データが見つかりませんでした。");
          return;
        }

        seriesRef.current?.setData(
          data.history.map((bar) => ({
            time: bar.date,
            open: bar.open,
            high: bar.high,
            low: bar.low,
            close: bar.close,
          }))
        );
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

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderVisible: false,
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    });

    chartRef.current = chart;
    seriesRef.current = series;

    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  return (
    <div className="space-y-3">
      {quote && (
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-semibold text-slate-100">
            {quote.price.toLocaleString(undefined, {
              maximumFractionDigits: 2,
            })}
          </span>
          {quote.changePercent !== null && (
            <span
              className={
                quote.changePercent >= 0 ? "text-emerald-400" : "text-red-400"
              }
            >
              {quote.changePercent >= 0 ? "+" : ""}
              {quote.changePercent.toFixed(2)}%
            </span>
          )}
        </div>
      )}

      {error && (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      )}
      {loading && <p className="text-sm text-slate-500">読み込み中...</p>}

      <div
        ref={containerRef}
        className="h-80 w-full rounded-xl border border-slate-800 bg-slate-900"
      />
    </div>
  );
}
