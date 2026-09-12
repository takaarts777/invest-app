// Google News RSS: free, no API key, and — unlike Yahoo Finance's search
// endpoint, which returns almost entirely English-language results —
// supports requesting Japanese-language results via hl/gl/ceid, which is
// what the macro-event calendar needs. This is an unofficial feed
// (Google's own copyright notice on it says it's meant for personal,
// non-commercial feed-reader use), so treat it the same way as the
// other unofficial endpoints this app relies on (Yahoo Finance, CNN
// Fear & Greed): fine for this personal tool, but liable to change or
// start blocking without notice.

export type JapaneseNewsItem = {
  title: string;
  link: string;
  source: string;
  publishedAt: string; // ISO
};

const RSS_URL = "https://news.google.com/rss/search";

const ENTITY_MAP: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeXmlEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity: string) => {
    if (entity[0] === "#") {
      const code =
        entity[1] === "x" || entity[1] === "X"
          ? parseInt(entity.slice(2), 16)
          : parseInt(entity.slice(1), 10);
      return Number.isNaN(code) ? match : String.fromCodePoint(code);
    }
    return ENTITY_MAP[entity] ?? match;
  });
}

function extractTag(block: string, tag: string): string | null {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  if (!match) return null;
  const raw = match[1].replace(/^<!\[CDATA\[([\s\S]*?)\]\]>$/, "$1");
  return decodeXmlEntities(raw).trim();
}

function extractSource(block: string): string {
  const match = block.match(/<source[^>]*>([\s\S]*?)<\/source>/);
  return match ? decodeXmlEntities(match[1]).trim() : "";
}

/**
 * Recent Japanese-language news for a free-text query, via Google News'
 * RSS search. Results are ranked by Google's own relevance/recency
 * (typically dominated by the most recent matching coverage), which is
 * enough for "news about this recurring macro event" without needing to
 * hand-tune a date filter per event.
 */
export async function searchJapaneseNews(
  query: string,
  count = 2
): Promise<JapaneseNewsItem[]> {
  const url = `${RSS_URL}?q=${encodeURIComponent(query)}&hl=ja&gl=JP&ceid=JP:ja`;
  const res = await fetch(url, {
    cache: "no-store",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
    },
  });

  if (!res.ok) {
    throw new Error(`Google News RSS error (${res.status}) for ${query}`);
  }

  const xml = await res.text();
  const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];

  return items.slice(0, count).map((block) => {
    const pubDate = extractTag(block, "pubDate");
    const source = extractSource(block);
    let title = extractTag(block, "title") ?? "";
    // Google News appends " - <source>" to every title; we already show
    // the source separately, so drop the duplicate suffix.
    if (source && title.endsWith(` - ${source}`)) {
      title = title.slice(0, -(source.length + 3));
    }

    return {
      title,
      link: extractTag(block, "link") ?? "",
      source,
      publishedAt: pubDate ? new Date(pubDate).toISOString() : "",
    };
  });
}
