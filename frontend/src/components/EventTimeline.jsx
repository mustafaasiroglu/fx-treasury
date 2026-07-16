import React, { useState } from 'react';

const EVENTS = [
  { time: '09:30', label: 'Market Open', type: 'info', impact: 'Low volatility expected', detail: 'London session opens. Liquidity increasing across G10 pairs. No major gaps expected from Asia close.' },
  { time: '10:15', label: 'ECB Statement', type: 'macro', impact: 'EUR weakness +0.3%', detail: 'ECB Governing Council press conference scheduled. Markets pricing 25bps hold. Watch for forward guidance changes on QT timeline.' },
  { time: '11:00', label: 'USD Spike', type: 'alert', impact: 'Spread widening likely', detail: 'DXY surged 40 pips in 2 minutes. Likely triggered by US 10Y yield breakout above 4.50%. Expect wider bid-ask spreads for 15-20 min.' },
  { time: '13:45', label: 'CBRT Decision', type: 'macro', impact: 'TRY ±2% swing risk', detail: 'Central Bank of Turkey rate decision. Consensus: hold at 50%. Any surprise cut could trigger 2-3% TRY depreciation. Hedging recommended.' },
  { time: '14:30', label: 'Order Flow Surge', type: 'alert', impact: 'Bid-side pressure', detail: 'Unusual buy-side flow detected from corporate accounts. Volume 3x normal for this time window. Possible large FX conversion for M&A deal.' },
  { time: '16:00', label: 'Policy Change', type: 'info', impact: 'Regime shift possible', detail: 'Internal treasury policy review outcome expected. May affect client spread parameters and risk limits for exotic pairs.' },
];

const EVENT_COLORS = { info: '#68a5ff', macro: '#ffad4d', alert: '#ff6870' };
const TYPE_LABELS = { info: 'INFO', macro: 'MACRO', alert: 'ALERT' };

function EventRow({ event }) {
  const [hover, setHover] = useState(false);
  const [popupStyle, setPopupStyle] = useState({});
  const rowRef = React.useRef(null);

  const handleMouseEnter = () => {
    setHover(true);
    if (rowRef.current) {
      const rect = rowRef.current.getBoundingClientRect();
      setPopupStyle({
        position: 'fixed',
        left: rect.left + rect.width / 2 - 128,
        top: rect.top - 8,
        transform: 'translateY(-100%)',
      });
    }
  };

  return (
    <div
      ref={rowRef}
      className="flex items-center gap-2.5 px-[18px] py-2 hover:bg-white/[0.03] transition-colors cursor-pointer"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setHover(false)}
    >
      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: EVENT_COLORS[event.type] }} />
      <span className="text-[11px] text-muted font-mono w-10 shrink-0">{event.time}</span>
      <span className="text-xs text-ink/90 flex-1 truncate">{event.label}</span>
      <span className="text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide shrink-0"
        style={{ backgroundColor: EVENT_COLORS[event.type] + '22', color: EVENT_COLORS[event.type] }}>
        {TYPE_LABELS[event.type]}
      </span>

      {/* Hover popup — fixed position to avoid clipping */}
      {hover && (
        <div className="w-64 ui-card p-3 pointer-events-none z-[9999]" style={{ ...popupStyle, background: 'linear-gradient(180deg, #1e2030, #181a2a)', border: '1px solid rgba(255,255,255,0.12)' }}>
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: EVENT_COLORS[event.type] }} />
            <span className="text-xs font-bold text-ink">{event.label}</span>
            <span className="text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide ml-auto"
              style={{ backgroundColor: EVENT_COLORS[event.type] + '22', color: EVENT_COLORS[event.type] }}>
              {TYPE_LABELS[event.type]}
            </span>
          </div>
          <div className="flex items-center gap-2 mb-2 text-[10px]">
            <span className="text-muted">⏰ {event.time}</span>
            <span className="text-yellow">⚡ {event.impact}</span>
          </div>
          <p className="text-[10px] text-muted leading-relaxed">{event.detail}</p>
        </div>
      )}
    </div>
  );
}

export default function EventTimeline() {
  const [tab, setTab] = useState('upcoming');

  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const past = EVENTS.filter(e => {
    const [h, m] = e.time.split(':').map(Number);
    return h * 60 + m <= nowMins;
  });
  const future = EVENTS.filter(e => {
    const [h, m] = e.time.split(':').map(Number);
    return h * 60 + m > nowMins;
  });

  const items = tab === 'upcoming' ? future : past;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="ui-section-header shrink-0">
        <div>
          <h2 className="text-sm font-semibold text-ink leading-tight">Market News &amp; Alerts</h2>
          <p className="text-[11px] text-muted leading-tight">Macro events &amp; risk signals</p>
        </div>
        <div className="flex items-center gap-1 bg-white/[0.04] border border-white/[0.07] rounded-full p-0.5">
          <button
            onClick={() => setTab('upcoming')}
            className={`text-[11px] px-2.5 py-1 rounded-full transition-colors ${
              tab === 'upcoming' ? 'bg-ink text-[#0b1018] font-bold' : 'text-muted hover:text-ink'
            }`}
          >
            Upcoming
          </button>
          <button
            onClick={() => setTab('past')}
            className={`text-[11px] px-2.5 py-1 rounded-full transition-colors ${
              tab === 'past' ? 'bg-ink text-[#0b1018] font-bold' : 'text-muted hover:text-ink'
            }`}
          >
            Past
          </button>
        </div>
      </div>
      {/* List */}
      <div className="flex-1 overflow-y-auto py-1">
        {items.length === 0 ? (
          <div className="text-center text-muted text-[10px] py-4">No {tab} events</div>
        ) : (
          items.map((e, i) => <EventRow key={i} event={e} />)
        )}
      </div>
    </div>
  );
}
