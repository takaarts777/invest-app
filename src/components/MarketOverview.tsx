import { SpeedometerGauge } from "@/components/SpeedometerGauge";
import type { MarketOverview as MarketOverviewData } from "@/lib/market-overview";

function fmtUsd(n: number): string {
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toLocaleString()}`;
}

function FearGreedGauge({
  title,
  data,
}: {
  title: string;
  data: { value: number; classification: string } | null;
}) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-slate-800/60 p-3">
      <p className="mb-1 text-xs text-slate-400">{title}</p>
      {data ? (
        <SpeedometerGauge
          score={(data.value - 50) / 50}
          label={data.classification}
          sublabel={`${data.value.toFixed(0)} / 100`}
          leftCaption="恐怖"
          rightCaption="強欲"
        />
      ) : (
        <p className="py-8 text-xs text-slate-600">取得できませんでした</p>
      )}
    </div>
  );
}

export function MarketOverview({ data }: { data: MarketOverviewData }) {
  const smart = data.smartMoney;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <h2 className="text-sm font-semibold text-slate-200">市場全体の参考指標</h2>
      <p className="mt-1 text-xs text-slate-500">
        特定の保有銘柄とは連動しない、市場全体のセンチメント参考情報です（Dumb
        Moneyは実在の指数、Smart Moneyは主要大型株バスケットによる簡易近似値です）。
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <FearGreedGauge title="米国株市場（CNN）" data={data.stockFearGreed} />
        <FearGreedGauge title="暗号資産市場（Alternative.me）" data={data.cryptoFearGreed} />

        <div className="flex flex-col items-center rounded-lg border border-slate-800/60 p-3">
          <p className="mb-1 text-xs text-slate-400">
            Smart Money（{smart.available ? smart.sectorName : "近似"}）
          </p>
          {smart.available ? (
            <>
              <SpeedometerGauge
                score={smart.score}
                label={smart.score > 0.3 ? "買い優勢" : smart.score < -0.3 ? "売り優勢" : "拮抗"}
                sublabel={`スコア ${smart.score.toFixed(2)}`}
                leftCaption="売り優勢"
                rightCaption="買い優勢"
              />
              <p className="mt-1 text-center text-[10px] text-slate-600">
                買い{smart.buyCount}件({fmtUsd(smart.buyValueUsd)}) / 売り{smart.sellCount}件(
                {fmtUsd(smart.sellValueUsd)})
              </p>
            </>
          ) : (
            <p className="py-8 text-center text-xs text-slate-600">{smart.reason}</p>
          )}
        </div>
      </div>
    </div>
  );
}
