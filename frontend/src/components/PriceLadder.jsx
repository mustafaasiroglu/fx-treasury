import React, { useMemo } from 'react';

const BUY_COLOR = '#4ade80';  // muted green
const SELL_COLOR = '#f87171'; // muted red
const BAR_BORDER = '1px solid #334155'; // dark gray border

export default function PriceLadder({ orderBook, currentRate, visiblePriceRange }) {
  // Filter levels to only those visible in the chart's price range
  const visibleLevels = useMemo(() => {
    if (!orderBook?.levels || !visiblePriceRange) return [];
    const { topPrice, bottomPrice } = visiblePriceRange;
    return orderBook.levels.filter(
      (l) => l.price <= topPrice && l.price >= bottomPrice
    );
  }, [orderBook, visiblePriceRange]);

  // Compute totals
  const totals = useMemo(() => {
    if (!orderBook?.levels) return { buy: 0, sell: 0 };
    return orderBook.levels.reduce(
      (acc, l) => ({ buy: acc.buy + l.buy, sell: acc.sell + l.sell }),
      { buy: 0, sell: 0 }
    );
  }, [orderBook]);

  if (!visiblePriceRange || !orderBook?.levels) {
    return (
      <div className="h-full flex items-center justify-center bg-panel">
        <span className="text-[9px] text-muted">Loading...</span>
      </div>
    );
  }

  const { topPrice, bottomPrice } = visiblePriceRange;
  const priceRange = topPrice - bottomPrice;
  const maxVol = orderBook.maxVolume || 1;

  // Calculate bar height: each level is 0.01 apart, map to pixels
  const pxPerPrice = visiblePriceRange.chartHeight / priceRange;
  const barHeight = Math.max(2, Math.min(16, pxPerPrice * 0.01 * 0.85));

  const totalSum = totals.buy + totals.sell || 1;
  const buyPctTotal = Math.round((totals.buy / totalSum) * 100);
  const sellPctTotal = 100 - buyPctTotal;

  return (
    <div className="h-full flex flex-col bg-panel overflow-hidden select-none">
      {/* Title bar */}
      <div className="flex items-center px-4 py-1.5 border-b border-border shrink-0">
        <h2 className="text-xs font-bold text-muted whitespace-nowrap">Open Orders</h2>
      </div>
      {/* Chart-aligned area */}
      <div className="flex-1 relative min-h-0 overflow-hidden">
        {/* Vertical center axis line */}
        <div className="absolute top-0 bottom-0 left-1/2 w-px bg-slate-600/40 -translate-x-[0.5px]" />
        {visibleLevels.map((level) => {
          const yPct = ((topPrice - level.price) / priceRange) * 100;
          const buyPct = (level.buy / maxVol) * 100;
          const sellPct = (level.sell / maxVol) * 100;

          return (
            <div
              key={level.price}
              className="absolute flex items-center"
              style={{
                top: `${yPct}%`,
                left: 0,
                right: 0,
                height: `${barHeight}px`,
                transform: 'translateY(-50%)',
              }}
            >
              {/* Buy bar */}
              <div className="w-1/2 h-full flex justify-end">
                <div
                  className="h-full rounded-l-sm"
                  style={{
                    width: `${buyPct}%`,
                    backgroundColor: BUY_COLOR,
                    opacity: 0.75,
                    border: BAR_BORDER,
                    borderRight: 'none',
                  }}
                />
              </div>
              {/* Sell bar */}
              <div className="w-1/2 h-full flex justify-start">
                <div
                  className="h-full rounded-r-sm"
                  style={{
                    width: `${sellPct}%`,
                    backgroundColor: SELL_COLOR,
                    opacity: 0.75,
                    border: BAR_BORDER,
                    borderLeft: 'none',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
      {/* Total section at bottom */}
      <div className="shrink-0 border-t border-border px-2 py-1.5 bg-panel">
        <div className="flex h-3 rounded overflow-hidden border border-slate-600/50">
          <div
            className="h-full transition-all duration-500"
            style={{ width: `${buyPctTotal}%`, backgroundColor: BUY_COLOR, opacity: 0.8 }}
          />
          <div
            className="h-full transition-all duration-500"
            style={{ width: `${sellPctTotal}%`, backgroundColor: SELL_COLOR, opacity: 0.8 }}
          />
        </div>
        <div className="flex justify-between mt-1 text-[9px] font-mono">
          <span style={{ color: BUY_COLOR }}>{buyPctTotal}%</span>
          <span style={{ color: SELL_COLOR }}>{sellPctTotal}%</span>
        </div>
      </div>
    </div>
  );
}
