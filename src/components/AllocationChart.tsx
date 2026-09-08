import type { AllocationSlice } from "@/lib/portfolio";

const COLORS = ["#38bdf8", "#a78bfa", "#fb923c", "#34d399", "#f472b6", "#facc15"];

/** A CSS conic-gradient donut chart — no charting library needed for a
 *  handful of asset-type slices. */
export function AllocationChart({ allocation }: { allocation: AllocationSlice[] }) {
  let cumulative = 0;
  const stops = allocation
    .map((a, i) => {
      const start = cumulative;
      cumulative += a.percent;
      return `${COLORS[i % COLORS.length]} ${start}% ${cumulative}%`;
    })
    .join(", ");

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row">
      <div
        className="h-36 w-36 shrink-0 rounded-full"
        style={{
          background: allocation.length > 0 ? `conic-gradient(${stops})` : "#1e293b",
        }}
      >
        <div className="relative left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-900" />
      </div>

      <ul className="w-full space-y-1.5 text-sm">
        {allocation.map((a, i) => (
          <li key={a.assetType} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-slate-300">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: COLORS[i % COLORS.length] }}
              />
              {a.label}
            </span>
            <span className="text-slate-500">{a.percent.toFixed(1)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
