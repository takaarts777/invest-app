import Link from "next/link";
import { getPortfolioSummary } from "@/lib/portfolio";
import { AllocationChart } from "@/components/AllocationChart";
import { LABEL_BADGE_COLOR } from "@/lib/signal-badge";

// Holdings, prices, and the forex rate all change over time, and the
// fetch calls behind an empty portfolio are skipped entirely (see
// getPortfolioSummary's early return) — which would otherwise let Next
// infer this page as static from a zero-holdings build. Force per-request
// rendering explicitly instead of relying on that inference.
export const dynamic = "force-dynamic";

const ASSET_TYPE_LABEL: Record<string, string> = {
  US_STOCK: "米国株",
  LEVERAGED_ETF: "レバレッジETF",
  CRYPTO: "暗号資産",
};

function fmtUsd(n: number): string {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function fmtJpy(n: number): string {
  return `¥${Math.round(n).toLocaleString()}`;
}

function GainText({
  gainUsd,
  gainPercent,
  usdJpyRate,
}: {
  gainUsd: number;
  gainPercent: number | null;
  usdJpyRate: number | null;
}) {
  const positive = gainUsd >= 0;
  const color = positive ? "text-emerald-400" : "text-red-400";
  const sign = positive ? "+" : "";
  return (
    <span className={color}>
      {sign}
      {fmtUsd(gainUsd)}
      {usdJpyRate && <> ({sign}{fmtJpy(gainUsd * usdJpyRate)})</>}
      {gainPercent !== null && (
        <>
          {" "}
          ({sign}
          {gainPercent.toFixed(2)}%)
        </>
      )}
    </span>
  );
}

export default async function PortfolioPage() {
  const portfolio = await getPortfolioSummary();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-100">ポートフォリオ</h1>
        <p className="mt-1 text-sm text-slate-400">
          ウォッチリストの銘柄に保有数量・平均取得単価を登録すると、ここに反映されます。
        </p>
      </div>

      {portfolio.rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-800 p-6 text-center text-sm text-slate-500">
          保有銘柄が登録されていません。ウォッチリストから銘柄詳細ページを開き、「保有情報」欄で数量・平均取得単価を登録してください。
        </p>
      ) : (
        <>
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <p className="text-xs text-slate-500">総資産評価額</p>
            <p className="text-2xl font-semibold text-slate-100">
              {fmtUsd(portfolio.totalValueUsd)}
              {portfolio.usdJpyRate && (
                <span className="ml-2 text-base font-normal text-slate-400">
                  ({fmtJpy(portfolio.totalValueUsd * portfolio.usdJpyRate)})
                </span>
              )}
            </p>
            <p className="mt-1 text-sm">
              含み損益:{" "}
              <GainText
                gainUsd={portfolio.totalGainUsd}
                gainPercent={portfolio.totalGainPercent}
                usdJpyRate={portfolio.usdJpyRate}
              />
            </p>
            {!portfolio.usdJpyRate && (
              <p className="mt-1 text-xs text-slate-600">
                為替レートを取得できなかったため、USDのみ表示しています。
              </p>
            )}
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-200">
              アセットアロケーション
            </h2>
            <AllocationChart allocation={portfolio.allocation} />
          </div>

          <div className="space-y-2">
            {portfolio.rows.map((row) => (
              <Link
                key={row.item.id}
                href={`/ticker/${row.item.id}`}
                className="block rounded-xl border border-slate-800 bg-slate-900 p-4 transition hover:border-slate-700"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-100">{row.item.symbol}</span>
                    <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
                      {ASSET_TYPE_LABEL[row.item.assetType]}
                    </span>
                    {row.snapshot?.compositeLabel && (
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          LABEL_BADGE_COLOR[row.snapshot.compositeLabel] ??
                          "bg-slate-800 text-slate-300"
                        }`}
                      >
                        {row.snapshot.compositeLabel}
                      </span>
                    )}
                  </div>
                  <span className="text-sm font-medium text-slate-100">
                    {row.currentValueUsd !== null ? fmtUsd(row.currentValueUsd) : "価格取得不可"}
                    {row.currentValueUsd !== null && portfolio.usdJpyRate && (
                      <span className="ml-1 text-xs font-normal text-slate-500">
                        ({fmtJpy(row.currentValueUsd * portfolio.usdJpyRate)})
                      </span>
                    )}
                  </span>
                </div>

                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-400 sm:grid-cols-4">
                  <span>数量: {row.item.quantity}</span>
                  <span>平均取得単価: {fmtUsd(row.item.avgCostUsd ?? 0)}</span>
                  <span>
                    現在値: {row.currentPriceUsd !== null ? fmtUsd(row.currentPriceUsd) : "-"}
                  </span>
                  <span>
                    含み損益:{" "}
                    {row.gainUsd !== null ? (
                      <GainText
                        gainUsd={row.gainUsd}
                        gainPercent={row.gainPercent}
                        usdJpyRate={null}
                      />
                    ) : (
                      "-"
                    )}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
