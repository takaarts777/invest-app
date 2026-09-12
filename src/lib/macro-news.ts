import "server-only";

import {
  getUpcomingMacroEvents,
  MACRO_EVENT_NEWS_QUERY,
  type MacroEvent,
  type MacroEventType,
} from "@/lib/data/macro-events";
import { searchJapaneseNews, type JapaneseNewsItem } from "@/lib/providers/googlenews";

export type MacroEventWithNews = MacroEvent & { news: JapaneseNewsItem[] };

const NEWS_PER_EVENT = 2;

// One query per event TYPE (not per date — see MACRO_EVENT_NEWS_QUERY),
// so 6+ upcoming events cost at most 3 Google News requests, cached
// in-process for a while since the news list doesn't need to be
// second-by-second fresh.
const CACHE_TTL_MS = 30 * 60 * 1000;
let cache: { data: Record<MacroEventType, JapaneseNewsItem[]>; expiresAt: number } | null = null;

async function getNewsByType(): Promise<Record<MacroEventType, JapaneseNewsItem[]>> {
  if (cache && cache.expiresAt > Date.now()) return cache.data;

  const types = Object.keys(MACRO_EVENT_NEWS_QUERY) as MacroEventType[];
  const results = await Promise.allSettled(
    types.map((type) => searchJapaneseNews(MACRO_EVENT_NEWS_QUERY[type], NEWS_PER_EVENT))
  );

  const data = Object.fromEntries(
    types.map((type, i) => {
      const r = results[i];
      return [type, r.status === "fulfilled" ? r.value : []];
    })
  ) as Record<MacroEventType, JapaneseNewsItem[]>;

  cache = { data, expiresAt: Date.now() + CACHE_TTL_MS };
  return data;
}

/** Upcoming macro events, each with up to NEWS_PER_EVENT related
 *  Japanese-language news links attached (empty array if the news fetch
 *  failed — the calendar itself still renders either way). */
export async function getUpcomingMacroEventsWithNews(
  limit = 6
): Promise<MacroEventWithNews[]> {
  const events = getUpcomingMacroEvents(limit);
  const newsByType = await getNewsByType();
  return events.map((e) => ({ ...e, news: newsByType[e.type] ?? [] }));
}
