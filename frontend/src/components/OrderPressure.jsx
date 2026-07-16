import React, { useEffect, useRef } from 'react';
import { createChart, ColorType, LineType } from 'lightweight-charts';

export default function OrderPressure({ rateHistory }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const buySeriesRef = useRef(null);
  const sellSeriesRef = useRef(null);

  // Create chart once
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'rgba(0,0,0,0)' },
        textColor: '#90a0ba',
        fontSize: 10,
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.045)' },
        horzLines: { color: 'rgba(255,255,255,0.045)' },
      },
      rightPriceScale: {
        borderColor: 'rgba(255,255,255,0.08)',
        scaleMargins: { top: 0.05, bottom: 0.05 },
      },
      timeScale: {
        borderColor: 'rgba(255,255,255,0.08)',
        timeVisible: true,
        secondsVisible: true,
      },
      crosshair: { mode: 0 },
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
    });

    const buySeries = chart.addAreaSeries({
      topColor: 'rgba(34, 197, 94, 0.35)',
      bottomColor: 'rgba(34, 197, 94, 0.02)',
      lineColor: '#22c55e',
      lineWidth: 2,
      lineType: LineType.Curved,
      title: '',
      lastValueVisible: true,
      priceLineVisible: false,
    });

    const sellSeries = chart.addAreaSeries({
      topColor: 'rgba(239, 68, 68, 0.35)',
      bottomColor: 'rgba(239, 68, 68, 0.02)',
      lineColor: '#ef4444',
      lineWidth: 2,
      lineType: LineType.Curved,
      title: '',
      lastValueVisible: true,
      priceLineVisible: false,
    });

    chartRef.current = chart;
    buySeriesRef.current = buySeries;
    sellSeriesRef.current = sellSeries;

    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []);

  // Update data
  useEffect(() => {
    if (!buySeriesRef.current || !sellSeriesRef.current || rateHistory.length === 0) return;

    const buyData = [];
    const sellData = [];
    let lastTime = 0;

    rateHistory.forEach((point) => {
      if (!point.orderPressure) return;
      let time = Math.floor(point.timestamp / 1000);
      if (time <= lastTime) time = lastTime + 1;
      lastTime = time;
      buyData.push({ time, value: point.orderPressure.buy });
      sellData.push({ time, value: point.orderPressure.sell });
    });

    buySeriesRef.current.setData(buyData);
    sellSeriesRef.current.setData(sellData);

    if (chartRef.current) {
      chartRef.current.timeScale().scrollToRealTime();
    }
  }, [rateHistory]);

  const latest = rateHistory.length > 0 ? rateHistory[rateHistory.length - 1] : null;
  const buy = latest?.orderPressure?.buy ?? 0;
  const sell = latest?.orderPressure?.sell ?? 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="ui-section-header shrink-0">
        <div>
          <h2 className="text-sm font-semibold text-ink leading-tight">Order Pressure</h2>
          <p className="text-[11px] text-muted leading-tight">Aggregated buy / sell flow</p>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-mono">
          <span className="px-2 py-0.5 rounded-full bg-green/10 text-green font-bold">BUY {buy}</span>
          <span className="px-2 py-0.5 rounded-full bg-red/10 text-red font-bold">SELL {sell}</span>
        </div>
      </div>
      {/* Chart */}
      <div ref={containerRef} className="flex-1 min-h-0" />
    </div>
  );
}
