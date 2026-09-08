// The 11 SPDR sector ETFs — a standard, well-known proxy for GICS sector
// performance (the same sectors a Finviz-style "S&P 500 sector map" groups
// by), used here as the tiles for the dashboard's sector heatmap.
export const SECTOR_ETFS = [
  { symbol: "XLK", name: "情報技術" },
  { symbol: "XLF", name: "金融" },
  { symbol: "XLV", name: "ヘルスケア" },
  { symbol: "XLY", name: "一般消費財" },
  { symbol: "XLC", name: "コミュニケーション" },
  { symbol: "XLI", name: "資本財" },
  { symbol: "XLP", name: "生活必需品" },
  { symbol: "XLE", name: "エネルギー" },
  { symbol: "XLU", name: "公益事業" },
  { symbol: "XLRE", name: "不動産" },
  { symbol: "XLB", name: "素材" },
] as const;
