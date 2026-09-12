// Macro economic event calendar: FOMC policy decisions, US CPI releases,
// and the US jobs report (NFP). These are market-wide (not per-ticker)
// scheduled events that move the whole market, used as context alongside
// the per-ticker analysis.
//
// FOMC and CPI dates are pre-published on a fixed annual schedule but are
// NOT computable from a rule — they must be updated by hand each year.
// NFP, by contrast, is always the first Friday of the month, so it's
// computed programmatically below and needs no maintenance.
//
// Sources (fetched 2026-09-08):
// - FOMC: https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm
// - CPI:  https://www.usinflationcalculator.com/inflation/consumer-price-index-release-schedule/
//         (citing the BLS release schedule)
//
// TODO next year: add the following year's FOMC_SCHEDULE / CPI_SCHEDULE
// entries once the Fed/BLS publish them (usually a few months ahead).

export type MacroEventType = "FOMC" | "CPI" | "NFP";

// Query used to look up related Japanese-language news for each event
// type (lib/macro-news.ts) — one generic query per type rather than per
// date, since Google News ranks by recency/relevance anyway and the most
// recent coverage for e.g. "FOMC 政策金利" is naturally about whichever
// meeting is next.
export const MACRO_EVENT_NEWS_QUERY: Record<MacroEventType, string> = {
  FOMC: "FOMC 政策金利",
  CPI: "米 CPI 消費者物価指数",
  NFP: "米 雇用統計",
};

export type MacroEvent = {
  date: string; // YYYY-MM-DD
  type: MacroEventType;
  title: string;
  description: string;
};

// [meetingStart, decisionDay] — the event date used is the decision day.
const FOMC_SCHEDULE: Record<number, [string, string][]> = {
  2026: [
    ["2026-01-27", "2026-01-28"],
    ["2026-03-17", "2026-03-18"],
    ["2026-04-28", "2026-04-29"],
    ["2026-06-16", "2026-06-17"],
    ["2026-07-28", "2026-07-29"],
    ["2026-09-15", "2026-09-16"],
    ["2026-10-27", "2026-10-28"],
    ["2026-12-08", "2026-12-09"],
  ],
};

const CPI_SCHEDULE: Record<number, string[]> = {
  2026: [
    "2026-01-13", "2026-02-13", "2026-03-11", "2026-04-10",
    "2026-05-12", "2026-06-10", "2026-07-14", "2026-08-12",
    "2026-09-11", "2026-10-14", "2026-11-10", "2026-12-10",
  ],
};

function firstFridayOfMonth(year: number, monthIndex0: number): string {
  const d = new Date(Date.UTC(year, monthIndex0, 1));
  const offsetToFriday = (5 - d.getUTCDay() + 7) % 7; // 5 = Friday
  d.setUTCDate(1 + offsetToFriday);
  return d.toISOString().slice(0, 10);
}

/** All known macro events for a given calendar year. FOMC/CPI are empty
 *  for years not yet added to the schedules above; NFP always works. */
export function getMacroEventsForYear(year: number): MacroEvent[] {
  const events: MacroEvent[] = [];

  for (const [start, end] of FOMC_SCHEDULE[year] ?? []) {
    events.push({
      date: end,
      type: "FOMC",
      title: "FOMC政策金利発表",
      description: `FOMC会合（${start}〜${end}）の政策金利発表・声明公表。`,
    });
  }

  for (const date of CPI_SCHEDULE[year] ?? []) {
    events.push({
      date,
      type: "CPI",
      title: "米消費者物価指数(CPI)発表",
      description: "前月分の米消費者物価指数(CPI)が発表される。",
    });
  }

  for (let month = 0; month < 12; month++) {
    events.push({
      date: firstFridayOfMonth(year, month),
      type: "NFP",
      title: "米雇用統計発表",
      description:
        "非農業部門雇用者数(NFP)・失業率など。毎月第1金曜発表が基本だが、稀に1日前後する場合がある。",
    });
  }

  return events.sort((a, b) => a.date.localeCompare(b.date));
}

/** Upcoming events from `from` onward (inclusive of today), across the
 *  current and next calendar year so late-December lookups still work. */
export function getUpcomingMacroEvents(
  limit = 8,
  from: Date = new Date()
): MacroEvent[] {
  const todayStr = from.toISOString().slice(0, 10);
  const year = from.getUTCFullYear();
  const all = [...getMacroEventsForYear(year), ...getMacroEventsForYear(year + 1)];
  return all.filter((e) => e.date >= todayStr).slice(0, limit);
}
