"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SimulatorSummary } from "@/lib/simulator";
import { STARTING_CASH_JPY } from "@/lib/simulator-constants";
import { SimulatorTradeForm } from "@/components/SimulatorTradeForm";

const ASSET_TYPE_LABEL: Record<string, string> = {
  US_STOCK: "米国株",
  LEVERAGED_ETF: "レバレッジETF",
  CRYPTO: "暗号資産",
};

function fmtJpy(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}¥${Math.round(Math.abs(n)).toLocaleString()}`;
}

function fmtUsd(n: number): string {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function PnlText({ jpy, percent }: { jpy: number; percent?: number | null }) {
  const positive = jpy >= 0;
  const color = positive ? "text-emerald-400" : "text-red-400";
  const sign = positive ? "+" : "";
  return (
    <span className={color}>
      {sign}
      {fmtJpy(jpy)}
      {percent !== null && percent !== undefined && (
        <>
          {" "}
          ({sign}
          {percent.toFixed(2)}%)
        </>
      )}
    </span>
  );
}

export function SimulatorDashboard({
  initialSummary,
}: {
  initialSummary: SimulatorSummary;
}) {
  const router = useRouter();
  const [summary, setSummary] = useState(initialSummary);
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  async function handleReset() {
    if (
      !confirm(
        `シミュレーター口座をリセットしますか？保有ポジション・取引履歴が全て消え、残高が ¥${STARTING_CASH_JPY.toLocaleString()} に戻ります。`
      )
    ) {
      return;
    }

    setResetting(true);
    setResetError(null);
    try {
      const res = await fetch("/api/simulator/reset", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setResetError(data.error ?? "リセットに失敗しました。");
        return;
      }
      setSummary(data.summary);
      router.refresh();
    } catch {
      setResetError("通信エラーが発生しました。");
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold text-slate-100">投資シミュレーター</h1>
          <p className="mt-1 text-sm text-slate-400">
            元手 ¥{STARTING_CASH_JPY.toLocaleString()}
            相当のポイントで、実際の値動きを使った疑似売買を行えます。実際の資産は動きません。
          </p>
        </div>
        <button
          type="button"
          onClick={handleReset}
          disabled={resetting}
          className="shrink-0 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400 transition hover:border-red-700 hover:text-red-400 disabled:opacity-50"
        >
          {resetting ? "リセット中..." : "口座をリセット"}
        </button>
      </div>

      {resetError && (
        <p className="text-sm text-red-400" role="alert">
          {resetError}
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs text-slate-500">総資産評価額</p>
          <p className="mt-1 text-2xl font-semibold text-slate-100">
            {fmtJpy(summary.totalValueJpy)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs text-slate-500">現金残高（ポイント）</p>
          <p className="mt-1 text-2xl font-semibold text-slate-100">{fmtJpy(summary.cashJpy)}</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs text-slate-500">損益合計（元手比）</p>
          <p className="mt-1 text-2xl font-semibold">
            <PnlText jpy={summary.totalPnlJpy} percent={summary.totalPnlPercent} />
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs text-slate-500">確定損益（売却済み）</p>
          <p className="mt-1 text-lg font-semibold">
            <PnlText jpy={summary.realizedPnlJpy} />
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs text-slate-500">含み損益（保有中）</p>
          <p className="mt-1 text-lg font-semibold">
            <PnlText jpy={summary.unrealizedPnlJpy} />
          </p>
        </div>
      </div>

      <SimulatorTradeForm onTraded={setSummary} />

      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-200">保有ポジション</h2>
        {summary.positions.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-800 p-6 text-center text-sm text-slate-500">
            保有ポジションはありません。上のフォームから購入してみましょう。
          </p>
        ) : (
          <div className="space-y-2">
            {summary.positions.map((p) => (
              <div
                key={p.id}
                className="rounded-xl border border-slate-800 bg-slate-900 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-100">{p.symbol}</span>
                    <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
                      {ASSET_TYPE_LABEL[p.assetType]}
                    </span>
                    {p.displayName && (
                      <span className="text-xs text-slate-500">{p.displayName}</span>
                    )}
                  </div>
                  <span className="text-sm font-medium text-slate-100">
                    {p.currentValueJpy !== null ? fmtJpy(p.currentValueJpy) : "価格取得不可"}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-400 sm:grid-cols-4">
                  <span>数量: {p.quantity}</span>
                  <span>平均取得単価: {fmtJpy(p.avgCostJpy)}</span>
                  <span>
                    現在値:{" "}
                    {p.currentPriceUsd !== null ? fmtUsd(p.currentPriceUsd) : "-"}
                  </span>
                  <span>
                    含み損益:{" "}
                    {p.unrealizedPnlJpy !== null ? (
                      <PnlText jpy={p.unrealizedPnlJpy} percent={p.unrealizedPnlPercent} />
                    ) : (
                      "-"
                    )}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-200">取引履歴</h2>
        {summary.trades.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-800 p-6 text-center text-sm text-slate-500">
            取引履歴はまだありません。
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900">
            <table className="w-full text-left text-xs">
              <thead className="text-slate-500">
                <tr className="border-b border-slate-800">
                  <th className="px-3 py-2 font-normal">日時</th>
                  <th className="px-3 py-2 font-normal">銘柄</th>
                  <th className="px-3 py-2 font-normal">売買</th>
                  <th className="px-3 py-2 font-normal">数量</th>
                  <th className="px-3 py-2 font-normal">単価(USD)</th>
                  <th className="px-3 py-2 font-normal">金額</th>
                  <th className="px-3 py-2 font-normal">実現損益</th>
                </tr>
              </thead>
              <tbody>
                {summary.trades.map((t) => (
                  <tr key={t.id} className="border-b border-slate-800/60 last:border-0">
                    <td className="px-3 py-2 text-slate-400">
                      {new Date(t.executedAt).toLocaleString("ja-JP", {
                        month: "numeric",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-3 py-2 font-medium text-slate-100">{t.symbol}</td>
                    <td className="px-3 py-2">
                      <span
                        className={
                          t.side === "BUY" ? "text-emerald-400" : "text-red-400"
                        }
                      >
                        {t.side === "BUY" ? "買い" : "売り"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-300">{t.quantity}</td>
                    <td className="px-3 py-2 text-slate-300">{fmtUsd(t.priceUsd)}</td>
                    <td className="px-3 py-2 text-slate-300">{fmtJpy(t.amountJpy)}</td>
                    <td className="px-3 py-2">
                      {t.realizedPnlJpy !== null && t.realizedPnlJpy !== undefined ? (
                        <PnlText jpy={t.realizedPnlJpy} />
                      ) : (
                        <span className="text-slate-600">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-slate-600">
        現在値は<Link href="/" className="underline hover:text-slate-400">ウォッチリスト</Link>
        と同じデータ源（米国株/ETFはYahoo Finance、暗号資産はCoinGecko）を使用し、円換算は都度取得する米ドル円レートを使用しています。実際の取引手数料・スプレッド・税金は考慮していません。
      </p>
    </div>
  );
}
