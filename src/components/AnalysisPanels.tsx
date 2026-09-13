"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AnalysisSnapshot } from "@prisma/client";
import type { TechnicalMetrics } from "@/lib/analysis/technical";
import type { FundamentalMetrics } from "@/lib/analysis/fundamental";
import type { SentimentResult } from "@/lib/analysis/sentiment";
import type { SmartMoneyMetrics } from "@/lib/analysis/smartmoney";
import type { AnomalyMetrics } from "@/lib/analysis/anomaly";
import type { DivergenceMetrics } from "@/lib/analysis/divergence";
import { buildExitCriteria } from "@/lib/analysis/exit-criteria";
import { INDICATOR_COLOR } from "@/lib/analysis/indicator-colors";
import { SpeedometerGauge } from "@/components/SpeedometerGauge";

type RawDetails = {
  technical: TechnicalMetrics | null;
  fundamental: FundamentalMetrics;
  sentiment: SentimentResult;
  smartMoney: SmartMoneyMetrics;
  anomaly: AnomalyMetrics | null;
  divergence: DivergenceMetrics | null;
};

const STALE_REASON =
  "古い形式の分析結果です。「再分析する」を押して更新してください。";

/** rawDetails is a JSON blob whose shape has changed as the analysis
 *  modules evolved (e.g. sentiment used to be nullable, smartMoney didn't
 *  exist yet). Snapshots saved under an older shape must not crash the
 *  page — normalize any missing/mismatched `{available: ...}` field into
 *  an explicit "unavailable" reading instead. */
function normalizeAvailable<T extends { available: boolean }>(
  value: unknown,
  extraFallbackFields: Record<string, unknown> = {}
): T {
  if (value && typeof value === "object" && "available" in value) {
    return value as T;
  }
  return {
    available: false,
    reason: STALE_REASON,
    ...extraFallbackFields,
  } as unknown as T;
}

function parseRawDetails(raw: string | null | undefined): RawDetails | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<RawDetails> | null;
    if (!parsed) return null;
    return {
      technical: parsed.technical ?? null,
      // FundamentalMetrics's unavailable variant also carries a `kind`
      // discriminant that sentiment/smartMoney don't have.
      fundamental: normalizeAvailable<FundamentalMetrics>(parsed.fundamental, {
        kind: "unavailable",
      }),
      sentiment: normalizeAvailable<SentimentResult>(parsed.sentiment),
      smartMoney: normalizeAvailable<SmartMoneyMetrics>(parsed.smartMoney),
      anomaly: parsed.anomaly ?? null,
      divergence: parsed.divergence ?? null,
    };
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

/** Horizontal bar gauge used for the composite score (kept separate from
 *  the newer speedometer-style gauge used for sentiment/smart-money). */
function ScoreBar({ score }: { score: number }) {
  const pct = ((Math.min(1, Math.max(-1, score)) + 1) / 2) * 100;
  return (
    <div className="relative mt-3 h-2 w-full rounded-full bg-gradient-to-r from-red-500 via-slate-600 to-emerald-500">
      <div
        className="absolute top-1/2 h-4 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow"
        style={{ left: `${pct}%` }}
      />
    </div>
  );
}

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
              <>
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
                <p className="mt-0.5 text-xs text-slate-600">
                  テクニカル・ファンダメンタル・センチメント等、複数の時間軸の指標を組み合わせた総合的な目安で、単一の投資期間を前提にしていません。期間ごとの売り時の目安は下の「保有期間別の売り時の目安」を参照してください。
                </p>
              </>
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
        <ExitCriteriaCard
          technical={details.technical}
          anomaly={details.anomaly}
          divergence={details.divergence}
          fundamental={details.fundamental}
        />
      )}

      {details && <DivergenceCard data={details.divergence} />}

      {details && <SentimentCard data={details.sentiment} />}

      {details && (
        <SmartDumbCompare
          smartMoney={details.smartMoney}
          sentiment={details.sentiment}
        />
      )}

      {details && (
        <div className="grid gap-3 sm:grid-cols-2">
          <TechnicalCard data={details.technical} />
          <FundamentalCard data={details.fundamental} />
          <div className="sm:col-span-2">
            <AnomalyCard data={details.anomaly} />
          </div>
          <div className="sm:col-span-2">
            <SmartMoneyCard data={details.smartMoney} />
          </div>
        </div>
      )}
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

/** A labeled dot placed above or below the shared track at the position
 *  corresponding to `score`, so two readings on the same -1..1 scale can
 *  be compared at a glance. */
function CompareMarker({
  score,
  colorClass,
  label,
  position,
}: {
  score: number;
  colorClass: string;
  label: string;
  position: "above" | "below";
}) {
  const pct = ((Math.min(1, Math.max(-1, score)) + 1) / 2) * 100;
  return (
    <div
      className="absolute flex flex-col items-center"
      style={{
        left: `${pct}%`,
        top: position === "above" ? "-28px" : "12px",
        transform: "translateX(-50%)",
      }}
    >
      {position === "above" && (
        <span
          className={`mb-1 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-semibold text-slate-900 ${colorClass}`}
        >
          {label}
        </span>
      )}
      <span className={`h-3 w-3 rounded-full ${colorClass} shadow`} />
      {position === "below" && (
        <span
          className={`mt-1 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-semibold text-slate-900 ${colorClass}`}
        >
          {label}
        </span>
      )}
    </div>
  );
}

/** Reads how Smart Money (insider buy/sell) and Dumb Money (contrarian-
 *  adjusted crowd sentiment) sit relative to each other — agreement
 *  reinforces the read, divergence suggests caution. */
function agreementReading(
  smart: number,
  dumb: number
): { text: string; className: string } {
  if (Math.abs(smart) <= 0.15 || Math.abs(dumb) <= 0.15) {
    return {
      text: "どちらかが中立圏のため、明確な一致・乖離は見られません。",
      className: "text-slate-400",
    };
  }
  if (Math.sign(smart) === Math.sign(dumb)) {
    return {
      text:
        smart > 0
          ? "Smart Money・Dumb Money(逆張り換算)がともに買い方向で一致 → シグナルの信頼度は比較的高い"
          : "Smart Money・Dumb Money(逆張り換算)がともに売り方向で一致 → シグナルの信頼度は比較的高い",
      className: smart > 0 ? "text-emerald-300" : "text-red-300",
    };
  }
  return {
    text: "Smart MoneyとDumb Money(逆張り換算)の方向が乖離しています → 判断が割れているため様子見も選択肢",
    className: "text-amber-300",
  };
}

/** A dedicated Smart Money vs. Dumb Money comparison, separate from the
 *  news sentiment panel — meant to be followed on its own for timing,
 *  with Smart Money (insider trading) as the primary cue. */
function SmartDumbCompare({
  smartMoney,
  sentiment,
}: {
  smartMoney: SmartMoneyMetrics;
  sentiment: SentimentResult;
}) {
  const smartScore = smartMoney.available ? smartMoney.score : null;
  // Contrarian-adjusted so positive consistently means "bullish signal"
  // on this track, matching how it's folded into the composite score.
  const dumbScore = sentiment.available ? -sentiment.score : null;

  if (smartScore === null && dumbScore === null) return null;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <h3 className="text-sm font-semibold text-slate-200">
        Smart Money vs Dumb Money
      </h3>
      <p className="mt-1 text-xs text-slate-500">
        2つのシグナルの位置関係を比較します。投資判断はSmart Money(インサイダー)を軸に、Dumb
        Money(逆張り換算後のニュースセンチメント)は補助材料としてご活用ください。
      </p>

      <div className="relative mx-2 mt-10 mb-8 h-2 rounded-full bg-gradient-to-r from-red-500 via-slate-600 to-emerald-500">
        {smartScore !== null && (
          <CompareMarker
            score={smartScore}
            colorClass="bg-sky-400"
            label="Smart"
            position="above"
          />
        )}
        {dumbScore !== null && (
          <CompareMarker
            score={dumbScore}
            colorClass="bg-amber-400"
            label="Dumb"
            position="below"
          />
        )}
      </div>

      <div className="flex justify-between text-[10px] text-slate-500">
        <span>売りシグナル</span>
        <span>中立</span>
        <span>買いシグナル</span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-sky-400" />
          Smart Money{smartScore !== null ? `（${smartScore.toFixed(2)}）` : "（データなし）"}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-amber-400" />
          Dumb Money・逆張り換算
          {dumbScore !== null ? `（${dumbScore.toFixed(2)}）` : "（データなし）"}
        </span>
      </div>

      {smartScore !== null && dumbScore !== null && (
        <p className={`mt-3 text-sm ${agreementReading(smartScore, dumbScore).className}`}>
          {agreementReading(smartScore, dumbScore).text}
        </p>
      )}
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

function sentimentGaugeLabel(
  data: Extract<SentimentResult, { available: true }>
): string {
  if (data.fearGreed) return data.fearGreed.classification;
  if (data.score > 0.5) return "強欲";
  if (data.score > 0.15) return "やや強欲";
  if (data.score < -0.5) return "恐怖";
  if (data.score < -0.15) return "やや恐怖";
  return "中立";
}

/** The headline takeaway of the sentiment panel: what the contrarian
 *  read concludes, independent of the raw fear/greed reading above it. */
function contrarianConclusion(score: number): { label: string; className: string } {
  if (score > 0.5) return { label: "逆張り結論: 売り警戒", className: "bg-red-500/15 text-red-300" };
  if (score > 0.15) return { label: "逆張り結論: やや売り警戒", className: "bg-red-500/10 text-red-300" };
  if (score < -0.5) return { label: "逆張り結論: 買い好機", className: "bg-emerald-500/15 text-emerald-400" };
  if (score < -0.15) return { label: "逆張り結論: やや買い好機", className: "bg-emerald-500/10 text-emerald-300" };
  return { label: "逆張り結論: 中立", className: "bg-slate-700/50 text-slate-300" };
}

function SentimentCard({ data }: { data: SentimentResult }) {
  return (
    <Panel title="ニュースセンチメント（Dumb Money・逆張り指標）">
      {!data.available ? (
        <Unavailable reason={data.reason} />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs text-slate-500">現在の読み</p>
              <p className="text-xl font-semibold text-slate-100">
                {sentimentGaugeLabel(data)}
                <span className="ml-2 text-sm font-normal text-slate-500">
                  (スコア {data.score.toFixed(2)})
                </span>
              </p>
            </div>

            {(() => {
              const conclusion = contrarianConclusion(data.score);
              return (
                <span
                  className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${conclusion.className}`}
                >
                  {conclusion.label}
                </span>
              );
            })()}
          </div>

          {/* Same horizontal bar style as the composite-judgment card,
           *  per feedback, in place of the speedometer dial. */}
          <ScoreBar score={data.score} />

          <p className="mt-1 text-xs text-slate-500">{contrarianReading(data.score)}</p>

          {data.fearGreed && (
            <MetricRow
              label={`Fear & Greed指数（${data.fearGreed.source}）`}
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

function smartMoneyGaugeLabel(score: number): string {
  if (score > 0.3) return "買い優勢";
  if (score < -0.3) return "売り優勢";
  return "拮抗";
}

function SmartMoneyCard({ data }: { data: SmartMoneyMetrics }) {
  return (
    <Panel title="Smart Money（インサイダー取引）">
      {!data.available ? (
        <Unavailable reason={data.reason} />
      ) : (
        <>
          {data.scope === "sector" && (
            <p className="mb-2 text-xs text-slate-500">
              ETF自体にはインサイダーが存在しないため、{data.sectorName}
              の代表的な構成銘柄で代用集計しています。
            </p>
          )}
          <SpeedometerGauge
            score={data.score}
            label={smartMoneyGaugeLabel(data.score)}
            sublabel={`スコア ${data.score.toFixed(2)}`}
            leftCaption="売り優勢"
            rightCaption="買い優勢"
          />
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
  opportunity: "border-emerald-500 text-emerald-300",
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
            <li key={i} className={`border-l-2 pl-2 ${SEVERITY_BORDER[f.severity]}`}>
              {f.description}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

const HORIZON_BORDER: Record<string, string> = {
  short: "border-amber-500",
  medium: "border-sky-500",
  long: "border-violet-500",
};

/** Concrete "sell when this happens" guidance per holding period —
 *  the composite label above says whether now looks like a buy/sell,
 *  but blends every time horizon at once, so it can't say when a
 *  specific holding period's thesis has broken down. This fills that
 *  gap with rule-based triggers grounded in the ticker's own current
 *  indicator values (computed client-side from the same rawDetails,
 *  no extra fetch). */
function ExitCriteriaCard({
  technical,
  anomaly,
  divergence,
  fundamental,
}: {
  technical: TechnicalMetrics | null;
  anomaly: AnomalyMetrics | null;
  divergence: DivergenceMetrics | null;
  fundamental: FundamentalMetrics;
}) {
  const criteria = buildExitCriteria(technical, anomaly, divergence, fundamental);

  return (
    <Panel title="保有期間別の売り時の目安">
      <p className="mb-3 text-xs text-slate-500">
        「買い進めたものの、その後の材料次第ですぐ下落して損をする」を避けるための目安です。どの期間で保有するかを決めたら、対応する条件を売り時の判断材料にしてください（投資助言ではなく、機械的なルールベースの目安です）。色付きの点は、上の価格チャート・下のRSIチャートに描画されている同じ色の線に対応しています。
      </p>
      <div className="space-y-3">
        {criteria.map((c) => (
          <div key={c.horizon} className={`border-l-2 pl-3 ${HORIZON_BORDER[c.horizon]}`}>
            <p className="text-sm font-semibold text-slate-200">
              {c.label}
              <span className="ml-1.5 text-xs font-normal text-slate-500">（{c.period}）</span>
            </p>
            <ul className="mt-1 space-y-1.5 text-xs text-slate-400">
              {c.triggers.map((t, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  {t.indicator ? (
                    <span
                      className={`mt-1 h-2 w-2 shrink-0 rounded-full ${INDICATOR_COLOR[t.indicator].dotClassName}`}
                      aria-hidden
                    />
                  ) : (
                    <span className="mt-1 h-2 w-2 shrink-0" aria-hidden />
                  )}
                  <span>{t.text}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Panel>
  );
}

const DIVERGENCE_SIGNAL_BADGE: Record<string, { label: string; className: string }> = {
  bullish: { label: "強気のダイバージェンス発生中", className: "bg-emerald-500/15 text-emerald-400" },
  bearish: { label: "弱気のダイバージェンス発生中", className: "bg-red-500/15 text-red-300" },
  none: { label: "ダイバージェンスなし", className: "bg-slate-700/50 text-slate-300" },
};

const DIVERGENCE_EVENT_BORDER: Record<string, string> = {
  bullish: "border-emerald-500 text-emerald-300",
  bearish: "border-red-500 text-red-300",
};

/** RSI/価格ダイバージェンスの専用セクション。総合判定の直下、センチメントと
 *  並ぶ独立軸として表示する（以前はアノマリー分析欄に埋もれていた1行だけの
 *  表示だったものを、現在の判定＋直近の履歴が見える形に拡張したもの）。 */
function DivergenceCard({ data }: { data: DivergenceMetrics | null }) {
  return (
    <Panel title="ダイバージェンス分析（RSI vs 価格）">
      {!data ? (
        <Unavailable reason="データ不足のため分析できませんでした（日足30本以上が必要です）。" />
      ) : (
        <>
          <p className="text-xs text-slate-500">
            価格の高値・安値更新とRSIの動きが逆行していないかを、直近60営業日の値動きから判定します。総合判定にもこの結果を反映しています。
          </p>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-slate-400">現在の判定</p>
            <span
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${DIVERGENCE_SIGNAL_BADGE[data.signal].className}`}
            >
              {DIVERGENCE_SIGNAL_BADGE[data.signal].label}
            </span>
          </div>

          <ScoreBar score={data.score} />

          {data.events.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">
              直近60営業日以内に、価格とRSIの逆行は見られませんでした。
            </p>
          ) : (
            <>
              <p className="mt-3 text-xs text-slate-500">検出履歴（新しい順、最大5件）</p>
              <ul className="mt-1 space-y-2 text-sm">
                {data.events.map((e, i) => (
                  <li
                    key={i}
                    className={`border-l-2 pl-2 ${DIVERGENCE_EVENT_BORDER[e.signal]} ${
                      i > 0 ? "text-slate-500" : ""
                    }`}
                  >
                    {e.description}
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </Panel>
  );
}
