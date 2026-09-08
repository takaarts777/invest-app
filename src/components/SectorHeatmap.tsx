import type { SectorTile } from "@/lib/sector-heatmap";

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpColor(c1: [number, number, number], c2: [number, number, number], t: number): string {
  return `rgb(${Math.round(lerp(c1[0], c2[0], t))}, ${Math.round(lerp(c1[1], c2[1], t))}, ${Math.round(
    lerp(c1[2], c2[2], t)
  )})`;
}

const GRAY: [number, number, number] = [71, 85, 105]; // slate-600 (unchanged/neutral)
const GREEN: [number, number, number] = [22, 163, 74];
const RED: [number, number, number] = [220, 38, 38];

/** Maps a day-change % to a Finviz-style red<->gray<->green tile color,
 *  saturating at +/-3% (a sector ETF rarely moves much further intraday). */
function colorFor(changePercent: number | null): string {
  if (changePercent === null) return "rgb(51, 65, 85)"; // slate-700, no data
  const t = Math.min(Math.abs(changePercent) / 3, 1);
  return lerpColor(GRAY, changePercent >= 0 ? GREEN : RED, t);
}

/** A Finviz-style sector heatmap, built from free data (SPDR sector ETF
 *  day-change %) rather than embedding Finviz's own map — Finviz doesn't
 *  offer a public embeddable image for it, and their terms don't allow
 *  reproducing it elsewhere. */
export function SectorHeatmap({ tiles }: { tiles: SectorTile[] }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <h2 className="text-sm font-semibold text-slate-200">
        セクター別ヒートマップ（米国株）
      </h2>
      <p className="mt-1 text-xs text-slate-500">
        主要セクターETF11本の当日騰落率です。保有銘柄とは連動しない市場全体の参考情報です。
      </p>

      <div className="mt-3 grid grid-cols-3 gap-1.5 sm:grid-cols-4 md:grid-cols-6">
        {tiles.map((t) => (
          <div
            key={t.symbol}
            className="flex flex-col items-center justify-center gap-0.5 rounded-md px-2 py-3 text-center"
            style={{ backgroundColor: colorFor(t.changePercent) }}
          >
            <span className="text-xs font-semibold text-white">{t.symbol}</span>
            <span className="text-[10px] leading-tight text-white/80">{t.name}</span>
            <span className="text-xs font-medium text-white">
              {t.changePercent !== null
                ? `${t.changePercent >= 0 ? "+" : ""}${t.changePercent.toFixed(2)}%`
                : "-"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
