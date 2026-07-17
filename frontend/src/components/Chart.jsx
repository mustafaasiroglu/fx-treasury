import React, { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, CrosshairMode, LineType } from 'lightweight-charts';
import PairSelector from './PairSelector';

const LEGEND_ITEMS = [
  { key: 'reuters', label: 'Reuters', color: '#4a9eff' },
  { key: 'bloomberg', label: 'Bloomberg', color: '#9b59b6' },
  { key: 'internal', label: 'Internal', color: '#ffa502' },
  { key: 'spotAsk', label: '▲', color: '#c9a22744' },
  { key: 'median', label: 'Spot', color: '#c9a227' },
  { key: 'spotBid', label: '▼', color: '#c9a22744' },
  { key: 'clientAsk', label: '▲', color: '#00d4aa44' },
  { key: 'client', label: 'Client', color: '#00d4aa' },
  { key: 'clientBid', label: '▼', color: '#00d4aa44' },
  { key: 'agentAsk', label: '▲', color: '#a855f744' },
  { key: 'agent', label: 'Model', color: '#a855f7' },
  { key: 'agentBid', label: '▼', color: '#a855f744' },
];

// Groups: Sources is a multi-item dropdown, the rest are triplets (ask, mid, bid)
const SOURCES = [
  { key: 'reuters', label: 'Reuters', color: '#4a9eff' },
  { key: 'bloomberg', label: 'Bloomberg', color: '#9b59b6' },
  { key: 'internal', label: 'Internal', color: '#ffa502' },
];
const GROUPS = [
  { mid: 'median', ask: 'spotAsk', bid: 'spotBid', extra: [{ key: 'spreadHist', label: 'Spread', marker: '▮' }], label: 'Spot', color: '#c9a227' },
  { mid: 'agent', ask: 'agentAsk', bid: 'agentBid', label: 'Model', color: '#a855f7' },
  { mid: 'client', ask: 'clientAsk', bid: 'clientBid', label: 'Client', color: '#00d4aa' },
];

const defaultVisibility = Object.fromEntries(
  LEGEND_ITEMS.map((i) => [i.key, !['reuters', 'bloomberg', 'internal', 'spotAsk', 'spotBid', 'clientAsk', 'clientBid', 'agentAsk', 'agentBid'].includes(i.key)])
);
// Add spreadHist default visibility
defaultVisibility.spreadHist = true;

const TIME_RANGES = ['5m', '15m', '1h', '24h', '7d'];

function Chevron({ open }) {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export default function Chart({ rateHistory, pair, onPairChange, onVisiblePriceRange, timeRange, onTimeRangeChange }) {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef({});
  const [visibility, setVisibility] = useState(defaultVisibility);
  const [spreadTooltip, setSpreadTooltip] = useState(null);

  const [openGroup, setOpenGroup] = useState(null);

  const toggleSeries = (key) => {
    setVisibility((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      const series = seriesRef.current[key];
      if (series) {
        series.applyOptions({ visible: next[key] });
      }
      return next;
    });
  };

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'rgba(0,0,0,0)' },
        textColor: '#90a0ba',
        fontSize: 10,
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.05)' },
        horzLines: { color: 'rgba(255,255,255,0.05)' },
      },
      crosshair: { mode: CrosshairMode.Normal },
      localization: {
        priceFormatter: (price) => price.toFixed(3),
      },
      rightPriceScale: {
        borderColor: 'rgba(255,255,255,0.08)',
        scaleMargins: { top: 0.05, bottom: 0.18 },
        autoScale: true,
      },
      timeScale: {
        borderColor: 'rgba(255,255,255,0.08)',
        timeVisible: true,
        secondsVisible: true,
        fixLeftEdge: true,
        fixRightEdge: true,
      },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
    });

    // SpotAsk line (market ask, transparent yellow)
    const spotAskSeries = chart.addLineSeries({
      color: '#c9a22744',
      lineWidth: 1,
      title: '',
      visible: false,
      lastValueVisible: false,
      priceLineVisible: false,
    });

    // SpotBid line (market bid, transparent yellow)
    const spotBidSeries = chart.addLineSeries({
      color: '#c9a22744',
      lineWidth: 1,
      title: '',
      visible: false,
      lastValueVisible: false,
      priceLineVisible: false,
    });

    // Reuters feed (thin blue) — default hidden
    const reutersSeries = chart.addLineSeries({
      color: '#4a9eff44',
      lineWidth: 1,
      title: '',
      visible: false,
      lastValueVisible: false,
      priceLineVisible: false,
    });

    // Bloomberg feed (thin purple) — default hidden
    const bloombergSeries = chart.addLineSeries({
      color: '#9b59b644',
      lineWidth: 1,
      title: '',
      visible: false,
      lastValueVisible: false,
      priceLineVisible: false,
    });

    // Internal feed (thin orange) — default hidden
    const internalSeries = chart.addLineSeries({
      color: '#ffa50244',
      lineWidth: 1,
      title: '',
      visible: false,
      lastValueVisible: false,
      priceLineVisible: false,
    });

    // SpotMid rate (yellow shaded area, smooth with markers)
    const medianSeries = chart.addAreaSeries({
      topColor: 'rgba(201, 162, 39, 0.25)',
      bottomColor: 'rgba(201, 162, 39, 0.02)',
      lineColor: '#c9a227',
      lineWidth: 2,
      lineType: LineType.Curved,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 4,
      crosshairMarkerBorderWidth: 2,
      crosshairMarkerBorderColor: '#c9a227',
      crosshairMarkerBackgroundColor: '#1a1a2e',
      title: '',
      lastValueVisible: true,
      priceLineVisible: false,
      priceFormat: { type: 'price', precision: 3, minMove: 0.001 },
    });

    // Client Ask (transparent turquoise)
    const clientAskSeries = chart.addLineSeries({
      color: '#00d4aa44',
      lineWidth: 1,
      title: '',
      visible: false,
      lastValueVisible: false,
      priceLineVisible: false,
    });

    // Client Mid (solid turquoise)
    const clientSeries = chart.addLineSeries({
      color: '#00d4aa',
      lineWidth: 2,
      lineStyle: 0,
      title: '',
      lastValueVisible: true,
      priceLineVisible: false,
      priceFormat: { type: 'price', precision: 3, minMove: 0.001 },
    });

    // Client Bid (transparent turquoise)
    const clientBidSeries = chart.addLineSeries({
      color: '#00d4aa44',
      lineWidth: 1,
      title: '',
      visible: false,
      lastValueVisible: false,
      priceLineVisible: false,
    });

    // Agent Ask (transparent purple)
    const agentAskSeries = chart.addLineSeries({
      color: '#a855f744',
      lineWidth: 1,
      title: '',
      visible: false,
      lastValueVisible: false,
      priceLineVisible: false,
    });

    // Agent Mid suggestion markers series
    const agentSeries = chart.addLineSeries({
      color: '#a855f7',
      lineWidth: 2,
      lineType: LineType.Curved,
      pointMarkersVisible: true,
      pointMarkersRadius: 3,
      title: '',
      lastValueVisible: true,
      priceLineVisible: false,
      priceFormat: { type: 'price', precision: 3, minMove: 0.001 },
    });

    // Agent Bid (transparent purple)
    const agentBidSeries = chart.addLineSeries({
      color: '#a855f744',
      lineWidth: 1,
      title: '',
      visible: false,
      lastValueVisible: false,
      priceLineVisible: false,
    });

    // Spot spread as volume-like histogram at bottom
    const spreadHistSeries = chart.addHistogramSeries({
      color: 'rgba(201, 162, 39, 0.35)',
      priceFormat: { type: 'price', precision: 4, minMove: 0.0001 },
      priceScaleId: 'spread',
      title: '',
      lastValueVisible: false,
    });
    chart.priceScale('spread').applyOptions({
      scaleMargins: { top: 0.83, bottom: 0 },
      borderVisible: false,
      visible: false,
    });

    seriesRef.current = {
      reuters: reutersSeries,
      bloomberg: bloombergSeries,
      internal: internalSeries,
      spotAsk: spotAskSeries,
      median: medianSeries,
      spotBid: spotBidSeries,
      clientAsk: clientAskSeries,
      client: clientSeries,
      clientBid: clientBidSeries,
      agentAsk: agentAskSeries,
      agent: agentSeries,
      agentBid: agentBidSeries,
      spreadHist: spreadHistSeries,
    };

    // Line types: client = stepped, agent = simple (straight), rest = curved (smooth)
    const steppedKeys = ['clientAsk', 'client', 'clientBid'];
    const simpleKeys = ['agentAsk', 'agent', 'agentBid'];
    const skipLineType = ['spreadHist', 'median'];
    Object.entries(seriesRef.current).forEach(([key, s]) => {
      if (skipLineType.includes(key)) return;
      const lineType = steppedKeys.includes(key)
        ? LineType.WithSteps
        : simpleKeys.includes(key)
          ? LineType.Simple
          : LineType.Curved;
      s.applyOptions({ lineType });
    });
    chartRef.current = chart;

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
        emitPriceRange();
      }
    };

    const emitPriceRange = () => {
      if (!onVisiblePriceRange || !chartContainerRef.current) return;
      const series = seriesRef.current.median;
      if (!series) return;
      const h = chartContainerRef.current.clientHeight;
      if (h <= 0) return;
      try {
        const topPrice = series.coordinateToPrice(0);
        const bottomPrice = series.coordinateToPrice(h);
        if (isFinite(topPrice) && isFinite(bottomPrice) && topPrice !== bottomPrice) {
          onVisiblePriceRange({ topPrice, bottomPrice, chartHeight: h });
        }
      } catch {
        // series not ready yet
      }
    };

    // Emit range on crosshair move (covers zoom/scroll)
    chart.subscribeCrosshairMove((param) => {
      emitPriceRange();
      if (!param.time || !param.seriesData) {
        setSpreadTooltip(null);
        return;
      }
      const spreadVal = param.seriesData.get(seriesRef.current.spreadHist);
      if (spreadVal && spreadVal.value != null) {
        setSpreadTooltip({
          value: (spreadVal.value * 10000).toFixed(1),
          x: param.point?.x ?? 0,
          y: param.point?.y ?? 0,
        });
      } else {
        setSpreadTooltip(null);
      }
    });

    // Emit on time scale changes (zoom/scroll affects visible prices)
    chart.timeScale().subscribeVisibleLogicalRangeChange(emitPriceRange);

    // Poll for price scale changes (dragging Y axis has no direct event)
    const priceRangePoll = setInterval(emitPriceRange, 100);

    window.addEventListener('resize', handleResize);

    return () => {
      clearInterval(priceRangePoll);
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [pair]); // recreate chart only on pair change

  // Update data when history changes
  useEffect(() => {
    if (!seriesRef.current.median || rateHistory.length === 0) return;

    const reutersData = [];
    const bloombergData = [];
    const internalData = [];
    const medianData = [];
    const spotAskData = [];
    const spotBidData = [];
    const clientAskData = [];
    const clientData = [];
    const clientBidData = [];
    const agentAskData = [];
    const agentData = [];
    const agentBidData = [];
    const spreadData = [];

    let lastTime = 0;
    // Lightweight-charts renders time axis as UTC. To display in the viewer's
    // local time zone, shift each timestamp by the negative TZ offset.
    const tzOffsetSec = new Date().getTimezoneOffset() * 60;
    rateHistory.forEach((point) => {
      let time = Math.floor(point.timestamp / 1000) - tzOffsetSec;
      // Ensure strictly ascending timestamps
      if (time <= lastTime) {
        time = lastTime + 1;
      }
      lastTime = time;

      // Feed mid rates (for individual feed lines)
      reutersData.push({ time, value: point.feeds[0]?.mid });
      bloombergData.push({ time, value: point.feeds[1]?.mid });
      internalData.push({ time, value: point.feeds[2]?.mid });
      // Market mid/ask/bid
      medianData.push({ time, value: point.median });
      spotAskData.push({ time, value: point.marketAsk });
      spotBidData.push({ time, value: point.marketBid });
      // Spread (ask - bid)
      spreadData.push({ time, value: point.marketAsk - point.marketBid });
      // Client mid/ask/bid
      clientData.push({ time, value: point.clientMid });
      clientAskData.push({ time, value: point.clientAsk });
      clientBidData.push({ time, value: point.clientBid });
      // Agent suggestion (mid/ask/bid)
      if (point.agentMid) {
        agentData.push({ time, value: point.agentMid });
        agentAskData.push({ time, value: point.agentAsk });
        agentBidData.push({ time, value: point.agentBid });
      }
    });

    seriesRef.current.reuters.setData(reutersData);
    seriesRef.current.bloomberg.setData(bloombergData);
    seriesRef.current.internal.setData(internalData);
    seriesRef.current.median.setData(medianData);
    seriesRef.current.spotAsk.setData(spotAskData);
    seriesRef.current.spotBid.setData(spotBidData);
    seriesRef.current.spreadHist.setData(spreadData);
    seriesRef.current.clientAsk.setData(clientAskData);
    seriesRef.current.client.setData(clientData);
    seriesRef.current.clientBid.setData(clientBidData);
    if (agentData.length > 0) {
      seriesRef.current.agentAsk.setData(agentAskData);
      seriesRef.current.agent.setData(agentData);
      seriesRef.current.agentBid.setData(agentBidData);
    }

    // Scroll to latest without resetting zoom
    if (chartRef.current) {
      chartRef.current.timeScale().scrollToRealTime();
    }

    // Emit visible price range after data update
    if (onVisiblePriceRange && chartContainerRef.current && seriesRef.current.median) {
      requestAnimationFrame(() => {
        try {
          const h = chartContainerRef.current?.clientHeight;
          if (!h) return;
          const topPrice = seriesRef.current.median.coordinateToPrice(0);
          const bottomPrice = seriesRef.current.median.coordinateToPrice(h);
          if (isFinite(topPrice) && isFinite(bottomPrice) && topPrice !== bottomPrice) {
            onVisiblePriceRange({ topPrice, bottomPrice, chartHeight: h });
          }
        } catch { /* not ready */ }
      });
    }
  }, [rateHistory]);

  return (
    <div className="w-full h-full flex flex-col">
      {/* Chart header + legend in one row */}
      <div className="flex items-center gap-3 px-[18px] py-3 border-b border-white/[0.075] shrink-0">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-ink whitespace-nowrap leading-tight">Live Rate Chart</h2>
        </div>
        <span className="w-px h-6 bg-white/10" />
        {/* Sources dropdown */}
        <div className="relative">
          <button
            onClick={() => setOpenGroup(openGroup === 'sources' ? null : 'sources')}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border transition-colors ${
              openGroup === 'sources'
                ? 'border-white/20 bg-white/[0.06]'
                : 'border-white/[0.07] hover:bg-white/[0.04]'
            } ${SOURCES.some((s) => visibility[s.key]) ? 'opacity-100' : 'opacity-50'}`}
            title="Toggle source feeds"
          >
            <span className="w-3 h-[3px] rounded-sm inline-block bg-blue-400" />
            <span className="text-xs text-ink/90 select-none">Sources</span>
            <span className="text-muted ml-0.5"><Chevron open={openGroup === 'sources'} /></span>
          </button>
          {openGroup === 'sources' && (
            <div className="absolute top-full left-0 mt-1.5 z-50 border border-white/10 rounded-xl shadow-2xl py-1.5 min-w-[120px]" style={{ backgroundColor: '#182235' }}>
              {SOURCES.map((src) => (
                <button
                  key={src.key}
                  onClick={() => toggleSeries(src.key)}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-white/[0.05] transition-colors ${visibility[src.key] ? 'text-ink' : 'text-muted'}`}
                >
                  <span className="w-2 h-2 rounded-full inline-block transition-opacity" style={{ backgroundColor: src.color, opacity: visibility[src.key] ? 1 : 0.35 }} />
                  <span className="flex-1 text-left">{src.label}</span>
                  {visibility[src.key] && <span className="text-accent text-[11px]">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Grouped dropdowns for Spot/Client/Agent */}
        {GROUPS.map((group) => {
          const midVisible = visibility[group.mid];
          const askVisible = visibility[group.ask];
          const bidVisible = visibility[group.bid];
          const anyVisible = midVisible || askVisible || bidVisible;
          const isOpen = openGroup === group.mid;
          const items = [
            { key: group.mid, label: 'Mid', visible: midVisible, marker: '●' },
            { key: group.ask, label: 'Ask', visible: askVisible, marker: '▲' },
            { key: group.bid, label: 'Bid', visible: bidVisible, marker: '▼' },
            ...(group.extra || []).map(e => ({ key: e.key, label: e.label, visible: visibility[e.key], marker: e.marker })),
          ];

          return (
            <div key={group.mid} className="relative">
              <button
                onClick={() => setOpenGroup(isOpen ? null : group.mid)}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border transition-colors ${
                  isOpen ? 'border-white/20 bg-white/[0.06]' : 'border-white/[0.07] hover:bg-white/[0.04]'
                } ${anyVisible ? 'opacity-100' : 'opacity-50'}`}
                title={`Toggle ${group.label} lines`}
              >
                <span className="w-3 h-[3px] rounded-sm inline-block" style={{ backgroundColor: group.color }} />
                <span className="text-xs text-ink/90 select-none">{group.label}</span>
                <span className="text-muted ml-0.5"><Chevron open={isOpen} /></span>
              </button>
              {/* Dropdown menu */}
              {isOpen && (
                <div className="absolute top-full left-0 mt-1.5 z-50 border border-white/10 rounded-xl shadow-2xl py-1.5 min-w-[110px]" style={{ backgroundColor: '#182235' }}>
                  {items.map((item) => (
                    <button
                      key={item.key}
                      onClick={() => toggleSeries(item.key)}
                      className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-white/[0.05] transition-colors ${item.visible ? 'text-ink' : 'text-muted'}`}
                    >
                      <span className="text-[10px] w-3 text-center" style={{ color: group.color, opacity: item.visible ? 1 : 0.35 }}>{item.marker}</span>
                      <span className="flex-1 text-left">{item.label}</span>
                      {item.visible && <span className="text-accent text-[11px]">✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {/* Time range selector — right aligned */}
        <div className="flex gap-1 ml-auto bg-white/[0.04] border border-white/[0.07] rounded-full p-0.5">
          {TIME_RANGES.map((r) => (
            <button
              key={r}
              onClick={() => onTimeRangeChange(r)}
              className={`px-2.5 py-1 text-[11px] rounded-full transition-colors ${
                timeRange === r
                  ? 'text-white font-bold'
                  : 'text-muted hover:text-ink'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      {/* Chart */}
      <div className="flex-1 min-h-0 relative">
        <div ref={chartContainerRef} className="absolute inset-0" />
        {spreadTooltip && visibility.spreadHist && (
          <div
            className="absolute pointer-events-none px-2 py-1 rounded text-[10px] font-mono text-ink whitespace-nowrap z-50"
            style={{
              left: spreadTooltip.x - 100,
              bottom: 40,
              background: 'linear-gradient(180deg, #1e2030, #181a2a)',
              border: '1px solid rgba(255,255,255,0.12)',
            }}
          >
            Spread: <span className="text-yellow-400 font-bold">{spreadTooltip.value} pips</span>
          </div>
        )}
      </div>
    </div>
  );
}
