"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { StockRecommendation } from "@/lib/recommendations";
import { HORIZON_LABEL, type InvestmentHorizon } from "@/lib/recommendations-constants";
import { LABEL_BADGE_COLOR } from "@/lib/signal-badge";

const HORIZON_BADGE: Record<InvestmentHorizon, string> = {
  short: "bg-amber-500/15 text-amber-300",
  medium: "bg-sky-500/15 text-sky-300",
  long: "bg-violet-500/15 text-violet-300",
};

function fmtUsd(n: number): string {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function AddButton({
  symbol,
  displayName,
  alreadyAdded,
}: {
  symbol: string;
  displayName: string;
  alreadyAdded: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (alreadyAdded || done) {
    return <span className="text-xs text-slate-500">✓ 追加済み</span>;
  }

  async function handleAdd() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol,
          assetType: "US_STOCK",
          providerId: symbol,
          displayName,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "追加に失敗しました。");
        return;
      }
      setDone(true);
      router.refresh();
    } catch {
      setError("通信エラーが発生しました。");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleAdd}
        disabled={pending}
        className="shrink-0 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 transition hover:border-sky-500 hover:text-sky-300 disabled:opacity-50"
      >
        {pending ? "追加中..." : "ウォッチリストに追加"}
      </button>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}

export function RecommendationsSection({
  recommendations,
  existingSymbols,
}: {
  recommendations: StockRecommendation[];
  existingSymbols: string[];
}) {
  if (recommendations.length === 0) return null;

  const existing = new Set(existingSymbols);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <h2 className="text-sm font-semibold text-slate-200">
        注目銘柄トップ{recommendations.length}（市場全体から自動抽出）
      </h2>
      <p className="mt-1 text-xs text-slate-500">
        ご自身のウォッチリストに限らず、主要銘柄約110本の中からテクニカル・アノマリー・ダイバージェンスの3軸だけで機械的にスコアリングした上位銘柄です（ファンダメンタルズ・ニュースセンチメントは含みません）。投資助言ではなく、銘柄探しの参考情報としてご利用ください。
      </p>

      <ol className="mt-3 space-y-3">
        {recommendations.map((r, i) => (
          <li key={r.symbol} className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex min-w-0 items-baseline gap-2">
                <span className="text-xs text-slate-600">{i + 1}</span>
                <span className="font-semibold text-slate-100">{r.symbol}</span>
                <span className="truncate text-xs text-slate-500">{r.displayName}</span>
              </div>
              <AddButton
                symbol={r.symbol}
                displayName={r.displayName}
                alreadyAdded={existing.has(r.symbol)}
              />
            </div>

            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-300">{fmtUsd(r.price)}</span>
              {r.changePercent !== null && (
                <span className={r.changePercent >= 0 ? "text-emerald-400" : "text-red-400"}>
                  {r.changePercent >= 0 ? "+" : ""}
                  {r.changePercent.toFixed(2)}%
                </span>
              )}
              <span
                className={`rounded-full px-2 py-0.5 font-medium ${
                  LABEL_BADGE_COLOR[r.compositeLabel] ?? "bg-slate-800 text-slate-300"
                }`}
              >
                {r.compositeLabel}
              </span>
              <span className={`rounded-full px-2 py-0.5 font-medium ${HORIZON_BADGE[r.horizon]}`}>
                おすすめ投資期間: {HORIZON_LABEL[r.horizon]}
              </span>
            </div>

            <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{r.reason}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
