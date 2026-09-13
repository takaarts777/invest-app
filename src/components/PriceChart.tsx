"use client";

import { useEffect, useRef, useState } from "react";
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type Time,
} from "lightweight-charts";
import { INDICATOR_COLOR } from "@/lib/analysis/indicator-colors";

type DailyBar = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

type SmaPoint = { date: string; value: number };
type Quote = { price: number; changePercent: number | null };

// Just the shape this component actually reads out of a DivergenceMetrics
// (see lib/analysis/divergence.ts) — kept local so this client component
// doesn't need to import that (server-safe but still extra surface) module.
type DivergenceForChart = {
  signal: "bullish" | "bearish" | "none";
  events: { fromDate: string; toDate: string; fromPrice: number; toPrice: number }[];
} | null;

const SMA_SERIES = [
  { key: "sma20" as const, indicator: "sma20" as const, label: "SMA20" },
  { key: "sma50" as const, indicator: "sma50" as const, label: "SMA50" },
  { key: "sma200" as const, indicator: "sma200" as const, label: "SMA200" },
];

export function PriceChart({
  watchlistItemId,
  divergence = null,
}: {
  watchlistItemId: string;
  /** The latest analysis snapshot's divergence read, if any — draws a
   *  dashed connector between the two pivot points that formed the most
   *  recent divergence, so the "保有期間別の売り時の目安" card's
   *  divergence trigger points at something visible right here instead
   *  of being a bare text claim. */
  divergence?: DivergenceForChart;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const smaSeriesRef = useRef<Record<string, ISeriesApi<"Line">>>({});
  const divergenceLineRef = useRef<ISeriesApi<"Line"> | null>(null);
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [availableSma, setAvailableSma] = useState<string[]>([]);

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
          sma20?: SmaPoint[];
          sma50?: SmaPoint[];
          sma200?: SmaPoint[];
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

        const present: string[] = [];
        for (const { key } of SMA_SERIES) {
          const points = data[key] ?? [];
          const series = smaSeriesRef.current[key];
          if (series && points.length > 0) {
            series.setData(points.map((p) => ({ time: p.date, value: p.value })));
            present.push(key);
          }
        }
        setAvailableSma(present);

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

    const smaSeries: Record<string, ISeriesApi<"Line">> = {};
    for (const { key, indicator } of SMA_SERIES) {
      smaSeries[key] = chart.addSeries(LineSeries, {
        color: INDICATOR_COLOR[indicator].hex,
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
    }

    chartRef.current = chart;
    seriesRef.current = series;
    smaSeriesRef.current = smaSeries;
    markersRef.current = createSeriesMarkers(series, []);

    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      smaSeriesRef.current = {};
      divergenceLineRef.current = null;
      markersRef.current = null;
    };
  }, []);

  // Draw the divergence connector + markers whenever the snapshot's
  // divergence read changes (independent of the price-history fetch —
  // this comes from the analysis snapshot, refreshed by "再分析する").
  useEffect(() => {
    if (!chartRef.current || !seriesRef.current) return;

    divergenceLineRef.current?.applyOptions({ visible: false });
    markersRef.current?.setMarkers([]);

    const event = divergence?.signal !== "none" ? divergence?.events[0] : undefined;
    if (!event) return;

    const color =
      divergence?.signal === "bullish"
        ? INDICATOR_COLOR.divergenceBullish.hex
        : INDICATOR_COLOR.divergenceBearish.hex;

    if (!divergenceLineRef.current) {
      divergenceLineRef.current = chartRef.current.addSeries(LineSeries, {
        lineWidth: 2,
        lineStyle: 2, // dashed
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
    }
    divergenceLineRef.current.applyOptions({ color, visible: true });
    divergenceLineRef.current.setData([
      { time: event.fromDate as Time, value: event.fromPrice },
      { time: event.toDate as Time, value: event.toPrice },
    ]);

    markersRef.current?.setMarkers([
      {
        time: event.fromDate as Time,
        position: "atPriceMiddle",
        price: event.fromPrice,
        shape: "circle",
        color,
        id: "divergence-from",
      },
      {
        time: event.toDate as Time,
        position: "atPriceMiddle",
        price: event.toPrice,
        shape: "circle",
        color,
        id: "divergence-to",
      },
    ]);
  }, [divergence]);

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

      {availableSma.length > 0 && (
        <div className="flex flex-wrap gap-3 text-xs text-slate-500">
          {SMA_SERIES.filter((s) => availableSma.includes(s.key)).map((s) => (
            <span key={s.key} className="flex items-center gap-1">
              <span
                className="inline-block h-0.5 w-3"
                style={{ backgroundColor: INDICATOR_COLOR[s.indicator].hex }}
              />
              {s.label}
            </span>
          ))}
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
