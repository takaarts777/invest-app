"use client";

import { useEffect, useState } from "react";

type ForecastEvent = {
  date: string;
  close: number;
  riseToPeakPct: number;
  daysToPeak: number;
};

type Forecast = {
  asOf: string;
  latestClose: number;
  drawdownFromHighPct: number;
  cycleHighClose: number;
  rsi14: number | null;
  events: ForecastEvent[];
  excluded: { year: number; declinePct: number; reason: string }[];
  pendingSignal: { date: string; close: number; targetDate: string; targetClose: number | null } | null;
  sampleSize: number;
  medianRisePct: number | null;
  medianDaysToPeak: number | null;
  predictedHighClose: number | null;
  differencePoints: number | null;
  upsidePct: number | null;
  predictedHighDate: string | null;
};

// Mirrors lib/analysis/sp500-forecast.ts for display only.
const DRAWDOWN_TRIGGER_PCT = 19.61;
const RSI_LEVEL = 30;

function fmtPrice(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function fmtYm(date: string): string {
  const [y, m] = date.split("-");
  return `${y}年${Number(m)}月`;
}

function Gauge({
  pct,
  markerPct,
  markerLabel,
  leftLabel,
  rightLabel,
  colorClass,
}: {
  pct: number;
  markerPct?: number;
  markerLabel?: string;
  leftLabel: string;
  rightLabel: string;
  colorClass: string;
}) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div>
      <div className="relative h-2 w-full rounded-full bg-slate-800">
        <div
          className={`absolute left-0 top-0 h-2 rounded-full ${colorClass}`}
          style={{ width: `${clamped}%` }}
        />
        {markerPct !== undefined && (
          <div
            className="absolute -top-1 h-4 w-0.5 bg-slate-300"
            style={{ left: `${Math.min(100, markerPct)}%` }}
          >
            {markerLabel && (
              <span className="absolute -top-4 -translate-x-1/2 whitespace-nowrap text-[10px] text-slate-400">
                {markerLabel}
              </span>
            )}
          </div>
        )}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-slate-500">
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
    </div>
  );
}

export function Sp500CyclePanel() {
  const [data, setData] = useState<Forecast | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/sp500-cycle");
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "取得に失敗しました。");
        if (!cancelled) setData(json);
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

  const hasForecast = data && data.predictedHighClose !== null;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <h2 className="text-sm font-semibold text-slate-200">S&amp;P500 予測（発動から2年間）</h2>
      <p className="mt-1 text-xs text-slate-500">
        過去9回のZBT発動（それぞれ高値から発動前の安値までの下落幅つき）を、S&P500の値動きに当てはめて発動日を推定し、発動後2年以内の最高値までの上昇率の中央値を、現在の価格に当てはめた目安です。
      </p>

      {error && (
        <p className="mt-2 text-sm text-red-400" role="alert">
          {error}
        </p>
      )}
      {loading && <p className="mt-2 text-sm text-slate-500">読み込み中...</p>}

      {data && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-lg bg-slate-950/40 px-3 py-2">
              <p className="text-xs text-slate-500">現在値</p>
              <p className="font-semibold text-slate-100">{fmtPrice(data.latestClose)}</p>
            </div>
            <div className="rounded-lg bg-slate-950/40 px-3 py-2">
              <p className="text-xs text-slate-500">予測の最高値</p>
              <p className="font-semibold text-slate-100">
                {data.predictedHighClose !== null ? fmtPrice(data.predictedHighClose) : "-"}
              </p>
            </div>
            <div className="rounded-lg bg-slate-950/40 px-3 py-2">
              <p className="text-xs text-slate-500">現在値からの差分</p>
              <p className="font-semibold text-emerald-300">
                {data.differencePoints !== null
                  ? `+${fmtPrice(data.differencePoints)}（+${data.upsidePct?.toFixed(1)}%）`
                  : "-"}
              </p>
            </div>
            <div className="rounded-lg bg-slate-950/40 px-3 py-2">
              <p className="text-xs text-slate-500">予測時期（目安）</p>
              <p className="font-semibold text-slate-100">
                {data.predictedHighDate ? `${fmtYm(data.predictedHighDate)}頃` : "-"}
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-5">
            <div>
              <p className="mb-1.5 text-xs text-slate-400">
                現在の高値（{fmtPrice(data.cycleHighClose)}）からの下落：
                <span className="ml-2 text-slate-300">{data.drawdownFromHighPct.toFixed(1)}%</span>
                <span className="ml-2 text-slate-500">（発動条件 {DRAWDOWN_TRIGGER_PCT}%以上）</span>
              </p>
              <Gauge
                pct={(data.drawdownFromHighPct / 30) * 100}
                markerPct={(DRAWDOWN_TRIGGER_PCT / 30) * 100}
                markerLabel={`${DRAWDOWN_TRIGGER_PCT}%`}
                leftLabel="高値 0%"
                rightLabel="-30%"
                colorClass="bg-red-400"
              />
            </div>
            <div>
              <p className="mb-1.5 text-xs text-slate-400">
                S&amp;P500 RSI(14)：
                <span className="ml-2 text-slate-300">{data.rsi14 !== null ? data.rsi14.toFixed(1) : "-"}</span>
                <span className="ml-2 text-slate-500">（発動条件 {RSI_LEVEL}以下）</span>
              </p>
              <Gauge
                pct={data.rsi14 ?? 0}
                markerPct={RSI_LEVEL}
                markerLabel={`${RSI_LEVEL}`}
                leftLabel="0"
                rightLabel="100"
                colorClass="bg-violet-400"
              />
            </div>
          </div>

          {hasForecast && (
            <p className="mt-4 text-xs text-slate-500">
              {data.sampleSize}件（中央値: 2年以内の最高値まで+{data.medianRisePct?.toFixed(1)}%・約{data.medianDaysToPeak !== null ? Math.round(data.medianDaysToPeak / 252 * 10) / 10 : "-"}年）に基づく目安です。発動日は表の年と下落幅からの推定で、サンプルも少ないため、過去の値動きが今回も繰り返される保証はありません。売買判断の材料の一つとしてご利用ください。
            </p>
          )}
          {!hasForecast && (
            <p className="mt-4 text-xs text-slate-500">
              発動日を推定できた件数が無いため、予測を算出できません。
            </p>
          )}

          {data.events.length > 0 && (
            <details className="mt-3 text-xs text-slate-500">
              <summary className="cursor-pointer hover:text-slate-300">発動点の一覧（{data.events.length}件）</summary>
              <ul className="mt-2 space-y-1">
                {data.events.map((e) => (
                  <li key={e.date} className="flex flex-wrap justify-between gap-2">
                    <span>
                      {e.date} 終値 {fmtPrice(e.close)}
                    </span>
                    <span className="text-slate-300">
                      2年以内の最高値まで +{e.riseToPeakPct.toFixed(1)}%（{e.daysToPeak}営業日後）
                    </span>
                  </li>
                ))}
              </ul>
              {data.pendingSignal && (
            <p className="mt-3 text-xs text-slate-400">
              進行中の発動: {data.pendingSignal.date}（終値 {fmtPrice(data.pendingSignal.close)}）→ {data.pendingSignal.targetDate} の予測: {data.pendingSignal.targetClose !== null ? fmtPrice(data.pendingSignal.targetClose) : "-"}（中央値を適用）
            </p>
          )}
          {data.excluded.length > 0 && (
                <p className="mt-2 text-slate-600">
                  除外: {data.excluded.map((x) => `${x.year}年（-${x.declinePct}%・${x.reason}）`).join("、")}
                </p>
              )}
            </details>
          )}
        </>
      )}
    </div>
  );
}
