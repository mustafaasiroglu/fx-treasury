import React from 'react';

function TrendArrow({ current, previous }) {
  if (previous == null || current == null) return null;
  const diff = current - previous;
  if (Math.abs(diff) < 0.00005) return null;
  const up = diff > 0;
  return (
    <span className={`text-sm font-bold ${up ? 'text-green' : 'text-red'}`}>
      {up ? '▲' : '▼'}
    </span>
  );
}

function KpiCard({ label, value, unit, format, sub1Label, sub1Value, sub2Label, sub2Value, prevValue, tooltip }) {
  const formatted = format ? format(value) : value;
  const sub1Formatted = format ? format(sub1Value) : sub1Value;
  const sub2Formatted = format ? format(sub2Value) : sub2Value;

  return (
    <article className="ui-card p-4 min-h-[118px] flex flex-col">
      <div className="flex items-center gap-2 text-[11px] text-muted uppercase tracking-[0.07em]">
        <span>{label}</span>
        <span className="relative group">
          <span className="w-[17px] h-[17px] inline-grid place-items-center rounded-full bg-white/[0.08] text-muted text-[11px] cursor-help">?</span>
          {tooltip && (
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-lg text-[10px] normal-case tracking-normal text-ink leading-relaxed w-48 opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 z-50" style={{ background: 'linear-gradient(180deg, #1e2030, #181a2a)', border: '1px solid rgba(255,255,255,0.12)' }}>
              {tooltip}
            </span>
          )}
        </span>
      </div>
      <div className="mt-2.5 flex items-baseline gap-2">
        <span className="text-[26px] font-extrabold tracking-tight text-ink font-mono">{formatted}</span>
        {unit && <span className="text-[13px] font-bold text-muted">{unit}</span>}
        <TrendArrow current={value} previous={prevValue} />
      </div>
      <div className="mt-auto pt-3 text-xs text-muted leading-relaxed">
        {sub1Label && (
          <span>{sub1Label}: <b className="text-ink font-mono">{sub1Formatted}</b></span>
        )}
        {sub2Label && (
          <span> · {sub2Label}: <b className="text-ink font-mono">{sub2Formatted}</b></span>
        )}
      </div>
    </article>
  );
}

export default function KpiCards({ rateHistory }) {
  const len = rateHistory.length;
  if (len === 0) return null;

  const current = rateHistory[len - 1];
  const prev = len > 1 ? rateHistory[len - 2] : null;

  // Current Spread (market ask - market bid)
  const currentSpread = current.marketAsk - current.marketBid;
  const prevSpread = prev ? prev.marketAsk - prev.marketBid : null;

  // Spread averages
  const last60mPoints = rateHistory.filter(p => current.timestamp - p.timestamp <= 3600000);
  const last24hPoints = rateHistory; // we only have what's loaded
  const avgSpread60m = last60mPoints.length > 0
    ? last60mPoints.reduce((sum, p) => sum + (p.marketAsk - p.marketBid), 0) / last60mPoints.length
    : currentSpread;
  const avgSpreadAll = last24hPoints.reduce((sum, p) => sum + (p.marketAsk - p.marketBid), 0) / last24hPoints.length;

  // Current Margin (client spread - market spread, i.e. treasury markup)
  const marketSpread = currentSpread;
  const clientSpread = current.clientAsk - current.clientBid;
  const currentMargin = clientSpread - marketSpread;
  const prevMargin = prev ? (prev.clientAsk - prev.clientBid) - (prev.marketAsk - prev.marketBid) : null;
  const avgMargin60m = last60mPoints.length > 0
    ? last60mPoints.reduce((sum, p) => sum + ((p.clientAsk - p.clientBid) - (p.marketAsk - p.marketBid)), 0) / last60mPoints.length
    : currentMargin;
  const avgMarginAll = last24hPoints.reduce((sum, p) => sum + ((p.clientAsk - p.clientBid) - (p.marketAsk - p.marketBid)), 0) / last24hPoints.length;

  // Mid Deviation (client mid vs market mid)
  const midDeviation = current.clientMid - current.median;
  const prevMidDev = prev ? prev.clientMid - prev.median : null;
  const avgMidDev60m = last60mPoints.length > 0
    ? last60mPoints.reduce((sum, p) => sum + (p.clientMid - p.median), 0) / last60mPoints.length
    : midDeviation;
  const avgMidDevAll = last24hPoints.reduce((sum, p) => sum + (p.clientMid - p.median), 0) / last24hPoints.length;

  // Spread Ratio (client spread / market spread)
  const spreadRatio = marketSpread > 0 ? clientSpread / marketSpread : 1;
  const prevRatio = prev ? ((prev.clientAsk - prev.clientBid) / Math.max(prev.marketAsk - prev.marketBid, 0.0001)) : null;
  const avgRatio60m = last60mPoints.length > 0
    ? last60mPoints.reduce((sum, p) => sum + ((p.clientAsk - p.clientBid) / Math.max(p.marketAsk - p.marketBid, 0.0001)), 0) / last60mPoints.length
    : spreadRatio;
  const avgRatioAll = last24hPoints.reduce((sum, p) => sum + ((p.clientAsk - p.clientBid) / Math.max(p.marketAsk - p.marketBid, 0.0001)), 0) / last24hPoints.length;

  const fmtPips = (v) => (v * 10000).toFixed(1);
  const fmtBps = (v) => (v * 10000).toFixed(1);
  const fmtRatio = (v) => v?.toFixed(2);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <KpiCard
        label="Market Spread"
        value={currentSpread}
        prevValue={prevSpread}
        unit="pips"
        format={fmtPips}
        sub1Label="Avg 60m"
        sub1Value={avgSpread60m}
        sub2Label="Session"
        sub2Value={avgSpreadAll}
        tooltip="Difference between best ask and best bid across all market feeds. Measured in pips (0.0001)."
      />
      <KpiCard
        label="Treasury Margin"
        value={currentMargin}
        prevValue={prevMargin}
        unit="bps"
        format={fmtBps}
        sub1Label="Avg 60m"
        sub1Value={avgMargin60m}
        sub2Label="Session"
        sub2Value={avgMarginAll}
        tooltip="Client spread minus market spread — the treasury markup added on top of market pricing."
      />
      <KpiCard
        label="Mid Deviation"
        value={midDeviation}
        prevValue={prevMidDev}
        unit="pips"
        format={fmtPips}
        sub1Label="Avg 60m"
        sub1Value={avgMidDev60m}
        sub2Label="Session"
        sub2Value={avgMidDevAll}
        tooltip="Gap between the client mid rate and the live market mid. Positive = client rate above market."
      />
      <KpiCard
        label="Spread Ratio"
        value={spreadRatio}
        prevValue={prevRatio}
        unit="x"
        format={fmtRatio}
        sub1Label="Avg 60m"
        sub1Value={avgRatio60m}
        sub2Label="Session"
        sub2Value={avgRatioAll}
        tooltip="Client spread divided by market spread. Values above 1.0x indicate wider-than-market pricing."
      />
    </div>
  );
}
