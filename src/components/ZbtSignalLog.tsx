type LogEvent = {
  id: string;
  signalDate: string;
  sp500Close: number;
  medianRisePct: number;
  predictedHighClose: number;
  predictedHighDate: string;
  status: string;
  realizedMaxClose: number | null;
  realizedRisePct: number | null;
};

function fmtPrice(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export function ZbtSignalLog({ events }: { events: LogEvent[] }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <h2 className="text-sm font-semibold text-slate-200">ZBT買いシグナルの発動履歴</h2>
      <p className="mt-1 text-xs text-slate-500">
        発動を毎日自動で記録し、発動から2年後に予測した最高値と実際の最高値を比べます。
      </p>

      {events.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">まだ発動はありません。</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-slate-500">
              <tr className="border-b border-slate-800">
                <th className="px-2 py-1.5 font-normal">発動日</th>
                <th className="px-2 py-1.5 font-normal">終値</th>
                <th className="px-2 py-1.5 font-normal">予測の最高値（時期）</th>
                <th className="px-2 py-1.5 font-normal">実際の最高値</th>
                <th className="px-2 py-1.5 font-normal">状況</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="border-b border-slate-800/60 last:border-0">
                  <td className="px-2 py-1.5 text-slate-300">{e.signalDate}</td>
                  <td className="px-2 py-1.5 text-slate-300">{fmtPrice(e.sp500Close)}</td>
                  <td className="px-2 py-1.5 text-slate-300">
                    {fmtPrice(e.predictedHighClose)}（{e.predictedHighDate}・中央値+{e.medianRisePct.toFixed(1)}%）
                  </td>
                  <td className="px-2 py-1.5 text-slate-300">
                    {e.realizedMaxClose !== null && e.realizedRisePct !== null
                      ? `${fmtPrice(e.realizedMaxClose)}（+${e.realizedRisePct.toFixed(1)}%）`
                      : "-"}
                  </td>
                  <td className="px-2 py-1.5">
                    {e.status === "completed" ? (
                      <span className="text-emerald-300">完了</span>
                    ) : (
                      <span className="text-amber-300">進行中</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
