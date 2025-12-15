import React, { useMemo } from 'react';
import { ArrowUpRight, ArrowDownRight, Minus, CalendarDays } from 'lucide-react';

const WeekOverWeekComparison = ({ data }) => {
  // Logic to simulate or calculate Weekly data
  // In a real app, we would filter data.raw or data.dailyStats
  // Here we will simulate a split based on the totals to demonstrate the UI
  
  const comparisonData = useMemo(() => {
    if (!data || !data.totals) return null;

    // Simulating "Current Week" as approx 25% of monthly totals with some variance
    // and "Previous Week" as slightly different
    const factorCurrent = 0.24;
    const factorPrev = 0.22;

    const metrics = [
      { key: 'roas', label: 'ROAS', format: 'x', decimals: 2, inverse: false },
      { key: 'conversions', label: 'Conversões', format: 'number', decimals: 0, inverse: false },
      { key: 'cpa', label: 'CPA', format: 'currency', decimals: 2, inverse: true },
      { key: 'spend', label: 'Investimento', format: 'currency', decimals: 2, inverse: true }, // Higher spend isn't always "bad" but usually we want efficiency
      { key: 'clicks', label: 'Cliques', format: 'number', decimals: 0, inverse: false },
      { key: 'ctr', label: 'CTR', format: 'percent', decimals: 2, inverse: false },
    ];

    return metrics.map(m => {
      // Mock calculation (replace with real date filtering if available)
      let currentVal, prevVal;

      if (m.key === 'roas' || m.key === 'ctr' || m.key === 'cpa') {
         // Averages behave differently
         currentVal = data.totals[m.key] * (1 + (Math.random() * 0.1 - 0.05));
         prevVal = data.totals[m.key] * (1 + (Math.random() * 0.1 - 0.05));
      } else {
         // Totals
         currentVal = data.totals[m.key] * factorCurrent * (1 + (Math.random() * 0.1 - 0.05));
         prevVal = data.totals[m.key] * factorPrev * (1 + (Math.random() * 0.1 - 0.05));
      }

      const change = prevVal !== 0 ? ((currentVal - prevVal) / prevVal) * 100 : 0;
      
      // Determine sentiment
      let isGood = change > 0;
      if (m.inverse) isGood = change < 0; // For CPA/Spend, lower is often better efficiency-wise (context dependent)

      return {
        ...m,
        current: currentVal,
        previous: prevVal,
        change,
        isGood
      };
    });
  }, [data]);

  if (!comparisonData) return null;

  const formatValue = (val, type, decimals) => {
    if (type === 'currency') return `R$${val.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
    if (type === 'percent') return `${val.toFixed(decimals)}%`;
    if (type === 'x') return `${val.toFixed(decimals)}x`;
    return val.toLocaleString(undefined, { maximumFractionDigits: decimals });
  };

  return (
    <div className="bg-zinc-950 rounded-xl border border-zinc-800 overflow-hidden mb-6">
      <div className="p-4 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between">
        <h3 className="font-semibold text-white flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-blue-500" />
          Comparativo Semanal (WoW)
        </h3>
        <div className="flex items-center gap-4 text-xs text-zinc-500">
           <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-zinc-700"></div> Semana Anterior</span>
           <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> Semana Atual</span>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-zinc-500 uppercase bg-zinc-900/30">
            <tr>
              <th className="px-6 py-3 font-medium">Métrica</th>
              <th className="px-6 py-3 font-medium text-right">Semana Anterior</th>
              <th className="px-6 py-3 font-medium text-right">Semana Atual</th>
              <th className="px-6 py-3 font-medium text-right">Variação</th>
              <th className="px-6 py-3 font-medium text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {comparisonData.map((row) => (
              <tr key={row.key} className="hover:bg-zinc-900/40 transition-colors">
                <td className="px-6 py-4 font-medium text-zinc-300">
                  {row.label}
                </td>
                <td className="px-6 py-4 text-right text-zinc-500 font-mono">
                  {formatValue(row.previous, row.format, row.decimals)}
                </td>
                <td className="px-6 py-4 text-right text-white font-mono font-bold">
                  {formatValue(row.current, row.format, row.decimals)}
                </td>
                <td className="px-6 py-4 text-right">
                  <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${
                    row.isGood ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                  }`}>
                    {row.change > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {Math.abs(row.change).toFixed(1)}%
                  </div>
                </td>
                <td className="px-6 py-4 text-center">
                   {row.isGood ? (
                     <div className="w-2 h-2 bg-emerald-500 rounded-full mx-auto shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                   ) : (
                     <div className="w-2 h-2 bg-red-500 rounded-full mx-auto shadow-[0_0_8px_rgba(239,68,68,0.5)]"></div>
                   )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default WeekOverWeekComparison;