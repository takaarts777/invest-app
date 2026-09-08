"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const ASSET_TYPES = [
  { value: "US_STOCK", label: "米国株" },
  { value: "LEVERAGED_ETF", label: "レバレッジETF" },
  { value: "CRYPTO", label: "暗号資産" },
] as const;

type AssetType = (typeof ASSET_TYPES)[number]["value"];

type SearchResult = {
  symbol: string;
  name: string;
  providerId: string;
  detail: string;
};

const SEARCH_DEBOUNCE_MS = 300;

export function AddTickerForm() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [assetType, setAssetType] = useState<AssetType>("US_STOCK");
  const [selected, setSelected] = useState<SearchResult | null>(null);

  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  // Company-name / ticker autocomplete search, debounced.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    function clearResults() {
      setResults([]);
      setSearching(false);
    }

    const trimmed = query.trim();
    if (!trimmed || selected) {
      clearResults();
      return;
    }

    function markSearching() {
      setSearching(true);
    }
    markSearching();

    debounceRef.current = setTimeout(async () => {
      const requestId = ++requestIdRef.current;
      try {
        const res = await fetch(
          `/api/search-ticker?q=${encodeURIComponent(trimmed)}&assetType=${assetType}`
        );
        const data = await res.json();
        if (requestId !== requestIdRef.current) return; // a newer search superseded this one
        setResults(res.ok ? (data.results ?? []) : []);
        setIsOpen(true);
        setHighlightIndex(-1);
      } catch {
        if (requestId === requestIdRef.current) setResults([]);
      } finally {
        if (requestId === requestIdRef.current) setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, assetType, selected]);

  function handleAssetTypeChange(value: AssetType) {
    setAssetType(value);
    setQuery("");
    setSelected(null);
    setResults([]);
    setIsOpen(false);
  }

  function handleQueryChange(value: string) {
    setQuery(value);
    setSelected(null);
  }

  function handleSelect(result: SearchResult) {
    setSelected(result);
    setQuery(result.symbol);
    setIsOpen(false);
    setResults([]);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!isOpen || results.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((i) => (i <= 0 ? results.length - 1 : i - 1));
    } else if (e.key === "Enter" && highlightIndex >= 0) {
      e.preventDefault();
      handleSelect(results[highlightIndex]);
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    try {
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: selected?.symbol ?? query,
          assetType,
          providerId: selected?.providerId,
          displayName: selected?.name,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "追加に失敗しました。");
        return;
      }

      setQuery("");
      setSelected(null);
      router.refresh();
    } catch {
      setError("通信エラーが発生しました。");
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-900 p-4 sm:flex-row sm:items-end"
    >
      <div className="relative flex-1">
        <label className="mb-1 block text-xs text-slate-400" htmlFor="symbol">
          銘柄コード・企業名
        </label>
        <input
          id="symbol"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 150)}
          placeholder="例: AAPL, Apple, TQQQ, ビットコイン"
          autoComplete="off"
          required
          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
        />

        {selected && (
          <p className="mt-1 text-xs text-emerald-400">✓ {selected.name}</p>
        )}

        {isOpen && (searching || results.length > 0) && (
          <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-slate-700 bg-slate-800 shadow-lg">
            {searching && results.length === 0 && (
              <li className="px-3 py-2 text-sm text-slate-500">検索中...</li>
            )}
            {results.map((r, i) => (
              <li key={`${r.providerId}-${r.symbol}`}>
                <button
                  type="button"
                  // onMouseDown fires before the input's onBlur, so the
                  // click registers before the dropdown closes.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelect(r);
                  }}
                  className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm ${
                    i === highlightIndex
                      ? "bg-sky-600/20 text-slate-100"
                      : "text-slate-300 hover:bg-slate-700/50"
                  }`}
                >
                  <span className="min-w-0">
                    <span className="font-medium text-slate-100">{r.symbol}</span>
                    <span className="ml-2 truncate text-slate-400">{r.name}</span>
                  </span>
                  {r.detail && (
                    <span className="shrink-0 text-xs text-slate-500">{r.detail}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <label className="mb-1 block text-xs text-slate-400" htmlFor="assetType">
          種別
        </label>
        <select
          id="assetType"
          value={assetType}
          onChange={(e) => handleAssetTypeChange(e.target.value as AssetType)}
          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500 sm:w-auto"
        >
          {ASSET_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-500 disabled:opacity-50"
      >
        {pending ? "追加中..." : "追加"}
      </button>

      {error && (
        <p className="text-sm text-red-400 sm:basis-full" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
