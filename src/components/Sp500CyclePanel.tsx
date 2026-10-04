"use client";

import { useEffect, useState } from "react";

type Cycle = {
  bottomDate: string;
  bottomClose: number;
  peakDate: string;
  peakClose: number;
  magnitude: number;
  years: number;
};

type CycleState = {
  bottomDate: string;
  bottomClose: number;
  cycleHighDate: string;
  cycleHighClose: number;
  drawdownFromHighPct: number;
  predictedTopClose: number;
  predictedTopDate: string;
  progressPct: number;
  upsideToTopPct: number;
  elapsedYears: number;
  medianYears: number;
  bottomConfirmed: boolean;
};

type CycleData = {
  asOf: string;
  latestClose: number;
  sampleSize: number;
  medianMagnitudePct: number | null;
  medianYears: number | null;
  cycles: Cycle[];
  current: CycleState | null;
};

const DRAWDOWN_TRIGGER_PCT = 18.9;

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
  const [data, setData] = useState<CycleData | null>(null);
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

  const cur = data?.current ?? null;
  const overTop = cur !== null && cur.progressPct >= 100;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <h2 className="text-sm font-semibold text-slate-200">S&amp;P500 サイクル予測</h2>
      <p className="mt-1 text-xs text-slate-500">
        1950年以降の弱気相場（20%以上の下落）の底から次の高値までの幅と期間の中央値を、現在のサイクルに当てはめた目安です。
      </p>

      {error && (
        <p className="mt-2 text-sm text-red-400" role="alert">
          {error}
        </p>
      )}
      {loading && <p className="mt-2 text-sm text-slate-500">読み込み中...</p>}

      {data && cur && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-lg bg-slate-950/40 px-3 py-2">
              <p className="text-xs text-slate-500">現在値</p>
              <p className="font-semibold text-slate-100">{fmtPrice(data.latestClose)}</p>
            </div>
            <div className="rounded-lg bg-slate-950/40 px-3 py-2">
              <p className="text-xs text-slate-500">予測の最高値（中央値ベース）</p>
              <p className="font-semibold text-slate-100">{fmtPrice(cur.predictedTopClose)}</p>
            </div>
            <div className="rounded-lg bg-slate-950/40 px-3 py-2">
              <p className="text-xs text-slate-500">予測時期（目安）</p>
              <p className="font-semibold text-slate-100">{fmtYm(cur.predictedTopDate)}頃</p>
            </div>
            <div className="rounded-lg bg-slate-950/40 px-3 py-2">
              <p className="text-xs text-slate-500">最高値までの上昇余地</p>
              <p
                className={
                  cur.upsideToTopPct > 8 ? "font-semibold text-emerald-300" : "font-semibold text-slate-100"
                }
              >
                {cur.upsideToTopPct >= 0 ? "+" : ""}
                {cur.upsideToTopPct.toFixed(1)}%
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-5">
            <div>
              <p className="mb-1.5 text-xs text-slate-400">
                値幅の位置：底（{fmtYm(cur.bottomDate)} {fmtPrice(cur.bottomClose)}）→ 予測の最高値
                <span className="ml-2 text-slate-300">
                  進捗 {Math.round(cur.progressPct)}%
                  {overTop && "（中央値の上昇幅をすでに超過）"}
                </span>
              </p>
              <Gauge
                pct={cur.progressPct}
                markerPct={overTop ? undefined : cur.progressPct}
                leftLabel={`底 ${fmtPrice(cur.bottomClose)}`}
                rightLabel={`予測天井 ${fmtPrice(cur.predictedTopClose)}`}
                colorClass={overTop ? "bg-amber-400" : "bg-sky-400"}
              />
            </div>

            <div>
              <p className="mb-1.5 text-xs text-slate-400">
                時間の位置：経過 {cur.elapsedYears.toFixed(1)}年 / 中央値 {cur.medianYears.toFixed(1)}年
                <span className="ml-2 text-slate-300">{Math.round((cur.elapsedYears / cur.medianYears) * 100)}%</span>
              </p>
              <Gauge
                pct={(cur.elapsedYears / cur.medianYears) * 100}
                leftLabel={fmtYm(cur.bottomDate)}
                rightLabel={fmtYm(cur.predictedTopDate)}
                colorClass="bg-violet-400"
              />
            </div>

            <div>
              <p className="mb-1.5 text-xs text-slate-400">
                今回のサイクルの高値（{fmtPrice(cur.cycleHighClose)}）からの下落：
                <span className="ml-2 text-slate-300">{cur.drawdownFromHighPct.toFixed(1)}%</span>
                <span className="ml-2 text-slate-500">（ZBT買い条件は {DRAWDOWN_TRIGGER_PCT}%以上）</span>
              </p>
              <Gauge
                pct={(cur.drawdownFromHighPct / 30) * 100}
                markerPct={(DRAWDOWN_TRIGGER_PCT / 30) * 100}
                markerLabel={`${DRAWDOWN_TRIGGER_PCT}%`}
                leftLabel="高値 0%"
                rightLabel="-30%"
                colorClass="bg-red-400"
              />
            </div>
          </div>

          <p className="mt-4 text-xs text-slate-500">
            {data.sampleSize}回の完結サイクル（中央値: 底から高値まで{" "}
            {data.medianMagnitudePct?.toFixed(1)}%・約{data.medianYears?.toFixed(1)}年）に基づく目安です。サンプルが少なく、過去の周期が今回も繰り返される保証はありません。売買判断の材料の一つとしてご利用ください。
          </p>

          <details className="mt-3 text-xs text-slate-500">
            <summary className="cursor-pointer hover:text-slate-300">過去のサイクル一覧（{data.cycles.length}件）</summary>
            <ul className="mt-2 space-y-1">
              {data.cycles.map((c) => (
                <li key={c.bottomDate} className="flex flex-wrap justify-between gap-2">
                  <span>
                    {fmtYm(c.bottomDate)} {fmtPrice(c.bottomClose)} → {fmtYm(c.peakDate)} {fmtPrice(c.peakClose)}
                  </span>
                  <span className="text-slate-300">
                    +{(c.magnitude * 100).toFixed(0)}% / {c.years.toFixed(1)}年
                  </span>
                </li>
              ))}
            </ul>
          </details>
        </>
      )}
    </div>
  );
}
