"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AnalysisSnapshot } from "@prisma/client";
import type { TechnicalMetrics } from "@/lib/analysis/technical";
import type { FundamentalMetrics } from "@/lib/analysis/fundamental";
import type { SentimentResult } from "@/lib/analysis/sentiment";
import type { SmartMoneyMetrics } from "@/lib/analysis/smartmoney";
import type { AnomalyMetrics } from "@/lib/analysis/anomaly";

type RawDetails = {
  technical: TechnicalMetrics | null;
  fundamental: FundamentalMetrics;
  sentiment: SentimentResult;
  smartMoney: SmartMoneyMetrics;
  anomaly: AnomalyMetrics | null;
};

function parseRawDetails(raw: string | null | undefined): RawDetails | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as RawDetails;
  } catch {
    return null;
  }
}

const LABEL_COLOR: Record<string, string> = {
  強い買い: "text-emerald-400",
  買い: "text-emerald-300",
  中立: "text-slate-300",
  売り: "text-red-300",
  強い売り: "text-red-400",
};

export function AnalysisPanels({
  watchlistItemId,
  initialSnapshot,
}: {
  watchlistItemId: string;
  initialSnapshot: AnalysisSnapshot | null;
}) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const details = parseRawDetails(snapshot?.rawDetails);

  async function handleAnalyze() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/analyze/${watchlistItemId}`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "分析に失敗しました。");
        return;
      }
      setSnapshot(data.snapshot);
      router.refresh();
    } catch {
      setError("通信エラーが発生しました。");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-slate-500">総合判定</p>
            {snapshot ? (
              <p
                className={`text-2xl font-semibold ${
                  LABEL_COLOR[snapshot.compositeLabel ?? ""] ?? "text-slate-200"
                }`}
              >
                {snapshot.compositeLabel}
                <span className="ml-2 text-sm font-normal text-slate-500">
                  (スコア {snapshot.compositeScore?.toFixed(2)})
                </span>
              </p>
            ) : (
              <p className="text-sm text-slate-500">まだ分析されていません</p>
            )}
          </div>
          <button
            onClick={handleAnalyze}
            disabled={pending}
            className="shrink-0 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-500 disabled:opacity-50"
          >
            {pending ? "分析中..." : snapshot ? "再分析する" : "分析する"}
          </button>
        </div>

        {snapshot && <ScoreBar score={snapshot.compositeScore ?? 0} />}

        {error && (
          <p className="mt-2 text-sm text-red-400" role="alert">
            {error}
          </p>
        )}

        {snapshot?.rationale && (
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-300">
            {snapshot.rationale}
          </p>
        )}

        {snapshot && (
          <p className="mt-2 text-xs text-slate-600">
            {new Date(snapshot.computedAt).toLocaleString("ja-JP")} 時点の分析
          </p>
        )}
      </div>

      {details && (
        <div className="grid gap-3 sm:grid-cols-2">
          <TechnicalCard data={details.technical} />
          <FundamentalCard data={details.fundamental} />
          <SentimentCard data={details.sentiment} />
          <AnomalyCard data={details.anomaly} />
          <div className="sm:col-span-2">
            <SmartMoneyCard data={details.smartMoney} />
          </div>
        </div>
      )}
    </div>
  );
}

function ScoreBar({ score }: { score: number }) {
  return <Gauge score={score} leftLabel="強い売り" rightLabel="強い買い" />;
}

/** Fear-&-Greed-style horizontal gauge: a marker on a red→green track,
 *  with labeled endpoints. Reused for the composite score, the sentiment
 *  ("Dumb Money") reading, and the smart-money reading. */
function Gauge({
  score,
  leftLabel,
  rightLabel,
  midLabel = "中立",
}: {
  score: number;
  leftLabel: string;
  rightLabel: string;
  midLabel?: string;
}) {
  const pct = ((Math.min(1, Math.max(-1, score)) + 1) / 2) * 100;
  return (
    <div className="mt-3">
      <div className="relative h-2 w-full rounded-full bg-gradient-to-r from-red-500 via-slate-600 to-emerald-500">
        <div
          className="absolute top-1/2 h-4 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow"
          style={{ left: `${pct}%` }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-slate-500">
        <span>{leftLabel}</span>
        <span>{midLabel}</span>
        <span>{rightLabel}</span>
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <h3 className="mb-2 text-sm font-semibold text-slate-200">{title}</h3>
      {children}
    </div>
  );
}

function Unavailable({ reason }: { reason: string }) {
  return <p className="text-sm text-slate-500">{reason}</p>;
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-slate-800/60 py-1 text-sm last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-200">{value}</span>
    </div>
  );
}

function SignalList({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <ul className="mt-2 space-y-1 text-xs text-slate-400">
      {items.map((s, i) => (
        <li key={i}>・{s}</li>
      ))}
    </ul>
  );
}

function fmt(n: number | null | undefined, suffix = ""): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "-";
  return `${n.toFixed(2)}${suffix}`;
}

function fmtUsd(n: number | null | undefined): string {
  if (n === null || n === undefined) return "-";
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toLocaleString()}`;
}

function TechnicalCard({ data }: { data: TechnicalMetrics | null }) {
  return (
    <Panel title="テクニカル分析">
      {!data ? (
        <Unavailable reason="データ不足のため分析できませんでした（日足20本以上が必要です）。" />
      ) : (
        <>
          <MetricRow label="RSI(14)" value={fmt(data.rsi14)} />
          <MetricRow label="SMA20" value={fmt(data.sma20)} />
          <MetricRow label="SMA50" value={fmt(data.sma50)} />
          <MetricRow label="SMA200" value={fmt(data.sma200)} />
          {data.macd && (
            <MetricRow label="MACDヒストグラム" value={fmt(data.macd.histogram)} />
          )}
          {data.bollinger && (
            <MetricRow label="ボリンジャー%B" value={fmt(data.bollinger.percentB)} />
          )}
          <SignalList items={data.signals} />
        </>
      )}
    </Panel>
  );
}

function FundamentalCard({ data }: { data: FundamentalMetrics }) {
  return (
    <Panel title="ファンダメンタル分析">
      {!data.available ? (
        <Unavailable reason={data.reason} />
      ) : data.kind === "stock" ? (
        <>
          <MetricRow label="PER" value={fmt(data.peRatio, "倍")} />
          <MetricRow label="PBR" value={fmt(data.pbRatio, "倍")} />
          <MetricRow label="ROE" value={fmt(data.roe, "%")} />
          <MetricRow label="売上成長率" value={fmt(data.revenueGrowth, "%")} />
          <MetricRow label="配当利回り" value={fmt(data.dividendYield, "%")} />
          <SignalList items={data.signals} />
        </>
      ) : (
        <>
          <MetricRow
            label="時価総額ランク"
            value={data.marketCapRank ? `${data.marketCapRank}位` : "-"}
          />
          <MetricRow label="時価総額" value={fmtUsd(data.marketCapUsd)} />
          <MetricRow label="ATHからの変化率" value={fmt(data.athChangePercent, "%")} />
          <MetricRow
            label="直近30日騰落率"
            value={fmt(data.priceChangePercent30d, "%")}
          />
          <SignalList items={data.signals} />
        </>
      )}
    </Panel>
  );
}

function contrarianReading(score: number): string {
  if (score > 0.5) return "過熱（強欲）気味 → 逆張り的には売り・様子見の検討材料";
  if (score > 0.15) return "やや強気 → 逆張り的にはやや警戒";
  if (score < -0.5) return "悲観（恐怖）気味 → 逆張り的には買いの好機の可能性";
  if (score < -0.15) return "やや弱気 → 逆張り的にはやや好機";
  return "中立圏 → 明確な逆張りシグナルなし";
}

function SentimentCard({ data }: { data: SentimentResult }) {
  return (
    <Panel title="ニュースセンチメント（Dumb Money・逆張り指標）">
      {!data.available ? (
        <Unavailable reason={data.reason} />
      ) : (
        <>
          <Gauge score={data.score} leftLabel="極度の恐怖" rightLabel="極度の強欲" />
          <p className="mt-1 text-xs text-slate-500">{contrarianReading(data.score)}</p>

          {data.fearGreed && (
            <MetricRow
              label="Fear & Greed指数"
              value={`${data.fearGreed.value}（${data.fearGreed.classification}）`}
            />
          )}

          <p className="mt-2 text-sm text-slate-300">{data.summary}</p>

          {data.headlines.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-slate-500">
              {data.headlines.slice(0, 5).map((h, i) => (
                <li key={i}>
                  <a
                    href={h.link}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-slate-300 hover:underline"
                  >
                    {h.title}
                  </a>
                  <span className="ml-1 text-slate-600">（{h.publisher}）</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Panel>
  );
}

function SmartMoneyCard({ data }: { data: SmartMoneyMetrics }) {
  return (
    <Panel title="Smart Money（インサイダー取引）">
      {!data.available ? (
        <Unavailable reason={data.reason} />
      ) : (
        <>
          <Gauge score={data.score} leftLabel="売り優勢" rightLabel="買い優勢" />
          <div className="mt-3">
            <MetricRow
              label="買い"
              value={`${data.buyCount}件 / ${fmtUsd(data.buyValueUsd)}`}
            />
            <MetricRow
              label="売り"
              value={`${data.sellCount}件 / ${fmtUsd(data.sellValueUsd)}`}
            />
          </div>
          <SignalList items={data.signals} />
        </>
      )}
    </Panel>
  );
}

const SEVERITY_BORDER: Record<string, string> = {
  info: "border-slate-600 text-slate-300",
  warning: "border-amber-500 text-amber-200",
  alert: "border-red-500 text-red-300",
};

function AnomalyCard({ data }: { data: AnomalyMetrics | null }) {
  return (
    <Panel title="アノマリー分析">
      {!data ? (
        <Unavailable reason="データ不足のため分析できませんでした。" />
      ) : data.findings.length === 0 ? (
        <p className="text-sm text-slate-500">特筆すべき異常は検出されませんでした。</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {data.findings.map((f, i) => (
            <li
              key={i}
              className={`border-l-2 pl-2 ${SEVERITY_BORDER[f.severity]}`}
            >
              {f.description}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
