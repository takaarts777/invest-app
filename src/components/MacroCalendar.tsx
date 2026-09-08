import { getUpcomingMacroEvents, type MacroEventType } from "@/lib/data/macro-events";

const TYPE_BADGE: Record<MacroEventType, string> = {
  FOMC: "bg-violet-500/15 text-violet-300",
  CPI: "bg-sky-500/15 text-sky-300",
  NFP: "bg-amber-500/15 text-amber-300",
};

function daysUntil(dateStr: string): number {
  const today = new Date();
  const todayUtc = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate()
  );
  const target = new Date(`${dateStr}T00:00:00Z`).getTime();
  return Math.round((target - todayUtc) / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  return d.toLocaleDateString("ja-JP", {
    month: "short",
    day: "numeric",
    weekday: "short",
    timeZone: "UTC",
  });
}

function daysUntilLabel(days: number): string {
  if (days === 0) return "本日";
  if (days === 1) return "明日";
  if (days < 0) return `${Math.abs(days)}日前`;
  return `あと${days}日`;
}

/** Market-wide macro event calendar (FOMC / CPI / US jobs report) — not
 *  tied to any one ticker, so it's shown once on the dashboard rather
 *  than per-ticker. */
export function MacroCalendar() {
  const events = getUpcomingMacroEvents(6);
  if (events.length === 0) return null;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <h2 className="mb-2 text-sm font-semibold text-slate-200">
        経済指標カレンダー
      </h2>
      <ul className="space-y-2">
        {events.map((e) => {
          const days = daysUntil(e.date);
          return (
            <li
              key={`${e.type}-${e.date}`}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${TYPE_BADGE[e.type]}`}
                >
                  {e.type}
                </span>
                <span className="truncate text-slate-300">{e.title}</span>
              </div>
              <div className="shrink-0 text-right text-xs text-slate-500">
                <div>{formatDate(e.date)}</div>
                <div>{daysUntilLabel(days)}</div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
