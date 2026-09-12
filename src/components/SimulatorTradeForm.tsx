"use client";

import { useEffect, useRef, useState } from "react";
import type { SimulatorSummary } from "@/lib/simulator";

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

export function SimulatorTradeForm({
  onTraded,
}: {
  onTraded: (summary: SimulatorSummary) => void;
}) {
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [query, setQuery] = useState("");
  const [assetType, setAssetType] = useState<AssetType>("US_STOCK");
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const [quantity, setQuantity] = useState("");

  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  // Company-name / ticker autocomplete search, debounced — same pattern
  // as AddTickerForm.
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
        if (requestId !== requestIdRef.current) return;
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
    setNotice(null);

    const parsedQuantity = Number(quantity);
    if (!(parsedQuantity > 0)) {
      setError("数量は正の数で入力してください。");
      setPending(false);
      return;
    }

    try {
      const res = await fetch("/api/simulator/trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: selected?.symbol ?? query,
          assetType,
          side,
          quantity: parsedQuantity,
          providerId: selected?.providerId,
          displayName: selected?.name,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "取引に失敗しました。");
        return;
      }

      onTraded(data.summary);
      setNotice(
        side === "BUY"
          ? `${selected?.symbol ?? query} を ${parsedQuantity} 単位 購入しました。`
          : `${selected?.symbol ?? query} を ${parsedQuantity} 単位 売却しました。`
      );
      setQuery("");
      setSelected(null);
      setQuantity("");
    } catch {
      setError("通信エラーが発生しました。");
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4"
    >
      <div className="flex gap-2">
        {(["BUY", "SELL"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSide(s)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
              side === s
                ? s === "BUY"
                  ? "bg-emerald-600 text-white"
                  : "bg-red-600 text-white"
                : "bg-slate-800 text-slate-400 hover:text-slate-200"
            }`}
          >
            {s === "BUY" ? "買い" : "売り"}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="relative flex-1">
          <label className="mb-1 block text-xs text-slate-400" htmlFor="sim-symbol">
            銘柄コード・企業名
          </label>
          <input
            id="sim-symbol"
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
          <label className="mb-1 block text-xs text-slate-400" htmlFor="sim-assetType">
            種別
          </label>
          <select
            id="sim-assetType"
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

        <div>
          <label className="mb-1 block text-xs text-slate-400" htmlFor="sim-quantity">
            数量
          </label>
          <input
            id="sim-quantity"
            type="number"
            step="any"
            min="0"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="0"
            required
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500 sm:w-28"
          />
        </div>

        <button
          type="submit"
          disabled={pending}
          className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition disabled:opacity-50 ${
            side === "BUY" ? "bg-emerald-600 hover:bg-emerald-500" : "bg-red-600 hover:bg-red-500"
          }`}
        >
          {pending ? "実行中..." : side === "BUY" ? "購入する" : "売却する"}
        </button>
      </div>

      {notice && (
        <p className="text-sm text-emerald-400" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
