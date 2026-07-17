import React, { useEffect, useRef, useState } from 'react';
import { fetchNews } from '../services/api';

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

function formatRelative(iso) {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, Math.floor((now - then) / 1000));
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

const LiveNewsRow = React.memo(function LiveNewsRow({ item }) {
  const publishedTs = item.datePublished ? new Date(item.datePublished).getTime() : 0;
  const isFresh = publishedTs > 0 && Date.now() - publishedTs <= 60 * 60_000;
  const time = formatRelative(item.datePublished);

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2.5 px-[18px] py-2 hover:bg-white/[0.03] transition-colors cursor-pointer"
    >
      <div className="flex-1 min-w-0">
        {/* Top line: provider · relative time · fresh dot */}
        <div className="flex items-center gap-1.5 text-[10px] text-muted">
          {item.provider && (
            <span className="truncate max-w-[55%] text-subtle uppercase tracking-wide">
              {item.provider}
            </span>
          )}
          {time && <span className="font-mono">· {time}</span>}
          {isFresh && (
            <span
              className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
              style={{ backgroundColor: '#68a5ff' }}
            />
          )}
        </div>
        {/* Bottom line: title */}
        <div className="text-[11.5px] text-ink/90 leading-snug line-clamp-2 mt-0.5">
          {item.title}
        </div>
      </div>

      {/* AI analyze icon — always visible */}
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          window.dispatchEvent(new CustomEvent('agent-chat-send', {
            detail: { message: `${item.title} başlıklı haberi yorumla. ${item.url}` },
          }));
        }}
        title="Analyze with agent"
        className="shrink-0 w-6 h-6 rounded-md bg-white/[0.05] hover:bg-purple/20 text-muted hover:text-purple grid place-items-center transition-colors"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 3l1.8 4.9L18.7 9.7l-4.9 1.8L12 16.4l-1.8-4.9L5.3 9.7l4.9-1.8L12 3z" fill="currentColor" />
          <path d="M19 14l.9 2.5L22.4 17.4l-2.5.9L19 20.8l-.9-2.5L15.6 17.4l2.5-.9L19 14z" fill="currentColor" />
        </svg>
      </button>
    </a>
  );
});

export default function EventTimeline({ pair = 'USDTRY' }) {
  const [tab, setTab] = useState('live');
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (tab !== 'live') return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchNews(pair)
      .then((data) => {
        if (cancelled) return;
        setNews(data.items || []);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [tab, pair]);

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

  const scheduledItems = tab === 'upcoming' ? future : tab === 'past' ? past : [];

  const tabClass = (id) =>
    `text-[11px] px-2.5 py-1 rounded-full transition-colors ${
      tab === id ? 'bg-ink text-[#0b1018] font-bold' : 'text-muted hover:text-ink'
    }`;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="ui-section-header shrink-0">
        <div>
          <h2 className="text-sm font-semibold text-ink leading-tight">Market News</h2>
          <p className="text-[11px] text-muted leading-tight">Live &amp; Scheduled</p>
        </div>
        <div className="flex items-center gap-1 bg-white/[0.04] border border-white/[0.07] rounded-full p-0.5">
          <button onClick={() => setTab('live')} className={tabClass('live')}>Live</button>
          <button onClick={() => setTab('upcoming')} className={tabClass('upcoming')}>Upcoming</button>
          <button onClick={() => setTab('past')} className={tabClass('past')}>Past</button>
        </div>
      </div>
      {/* List */}
      <div className="flex-1 overflow-y-auto py-1">
        {tab === 'live' ? (
          loading ? (
            <div className="text-center text-muted text-[10px] py-4">Loading news…</div>
          ) : error ? (
            <div className="text-center text-red text-[10px] py-4">Failed to load: {error}</div>
          ) : news.length === 0 ? (
            <div className="text-center text-muted text-[10px] py-4">No live news</div>
          ) : (
            news.map((item, i) => <LiveNewsRow key={i} item={item} />)
          )
        ) : scheduledItems.length === 0 ? (
          <div className="text-center text-muted text-[10px] py-4">No {tab} events</div>
        ) : (
          scheduledItems.map((e, i) => <EventRow key={i} event={e} />)
        )}
      </div>
    </div>
  );
}
