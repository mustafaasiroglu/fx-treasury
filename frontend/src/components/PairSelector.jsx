import React, { useEffect, useRef, useState } from 'react';

const PAIRS = [
  { value: 'USDTRY', label: 'USD/TRY' },
  { value: 'EURTRY', label: 'EUR/TRY' },
];

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

export default function PairSelector({ selected, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const current = PAIRS.find((p) => p.value === selected) || PAIRS[0];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 pl-3 pr-2.5 py-2 rounded-full border transition-colors ${
          open ? 'border-white/20 bg-white/[0.06]' : 'border-border bg-white/[0.035] hover:bg-white/[0.05]'
        }`}
      >
        <span className="text-[13px] font-bold text-ink select-none">{current.label}</span>
        <span className="text-muted"><Chevron open={open} /></span>
      </button>
      {open && (
        <div
          className="absolute top-full left-0 mt-1.5 z-50 border border-white/10 rounded-xl shadow-2xl py-1.5 min-w-[130px]"
          style={{ backgroundColor: '#182235' }}
        >
          {PAIRS.map((pair) => (
            <button
              key={pair.value}
              onClick={() => {
                onChange(pair.value);
                setOpen(false);
              }}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-[13px] hover:bg-white/[0.05] transition-colors ${
                pair.value === selected ? 'text-ink font-bold' : 'text-muted'
              }`}
            >
              <span className="flex-1 text-left">{pair.label}</span>
              {pair.value === selected && <span className="text-accent text-[11px]">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
