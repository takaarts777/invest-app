import { listWatchlist } from "@/lib/market";
import { getLatestSnapshotsFor } from "@/lib/snapshots";
import { AddTickerForm } from "@/components/AddTickerForm";
import { WatchlistCard } from "@/components/WatchlistCard";

export default async function DashboardPage() {
  const items = await listWatchlist();
  const snapshots = await getLatestSnapshotsFor(items.map((i) => i.id));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-100">
          ウォッチリスト
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          気になる銘柄を追加すると、多面的な分析結果と買い時・売り時の目安を確認できます。
        </p>
      </div>

      <AddTickerForm />

      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-800 p-6 text-center text-sm text-slate-500">
          まだ銘柄が追加されていません。上のフォームから追加してください。
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <WatchlistCard
              key={item.id}
              item={item}
              snapshot={snapshots.get(item.id) ?? null}
            />
          ))}
        </div>
      )}
    </div>
  );
}
