import React from 'react';
import { motion } from 'framer-motion';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

const KPI_TOOLTIPS = {
  ROAS: 'Retorno sobre o gasto com anúncios (valor de conversão ÷ custo). Quanto maior, melhor.',
  CPA: 'Custo por aquisição/conversão (custo ÷ conversões). Quanto menor, melhor.',
  CPC: 'Custo por clique (custo ÷ cliques).',
  CTR: 'Taxa de cliques (cliques ÷ impressões). Indica o quanto o anúncio chama atenção.',
  CVR: 'Taxa de conversão (conversões ÷ cliques).',
  CPM: 'Custo por mil impressões. Útil para medir alcance/visibilidade.',
};

function renderWithKpiTooltips(text) {
  if (typeof text !== 'string') return text;

  const re = /\b(ROAS|CPA|CPC|CTR|CVR|CPM)\b/g;
  const parts = [];
  let lastIndex = 0;
  let match;

  // eslint-disable-next-line no-cond-assign
  while ((match = re.exec(text)) !== null) {
    const idx = match.index;
    const token = match[1];
    if (idx > lastIndex) parts.push(text.slice(lastIndex, idx));

    parts.push(
      <abbr
        key={`${token}-${idx}`}
        title={KPI_TOOLTIPS[token]}
        className="underline decoration-dotted underline-offset-2 cursor-help"
      >
        {token}
      </abbr>
    );

    lastIndex = idx + token.length;
  }

  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  if (parts.length === 0) return text;
  return <>{parts}</>;
}

const MetricCard = ({ 
  title, 
  value, 
  subValue, 
  trend, 
  trendValue, 
  icon: Icon, 
  color = 'blue',
  status = 'neutral' 
}) => {
  // Mapping 'blue' to emerald/zinc for the new dark elegant theme
  // 'green' stays green (emerald), 'orange' stays orange
  const colorMap = {
    blue: 'from-zinc-800 to-zinc-900 border-zinc-700 text-emerald-400',
    green: 'from-emerald-900/10 to-emerald-900/5 border-emerald-900/20 text-emerald-400',
    purple: 'from-zinc-800 to-zinc-900 border-zinc-700 text-purple-400', 
    orange: 'from-orange-900/10 to-orange-900/5 border-orange-900/20 text-orange-400',
    red: 'from-red-900/10 to-red-900/5 border-red-900/20 text-red-400',
  };

  const iconColor = {
    blue: 'text-emerald-400',
    green: 'text-emerald-400',
    purple: 'text-purple-400',
    orange: 'text-orange-400',
    red: 'text-red-400',
  };

  const statusColor = {
    good: 'text-emerald-400',
    warning: 'text-orange-400',
    bad: 'text-red-400',
    neutral: 'text-zinc-500'
  };
  
  const trendColor = {
    up: 'text-emerald-400',
    down: 'text-red-400',
    neutral: 'text-zinc-500'
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-gradient-to-br ${colorMap[color]} rounded-xl p-6 border shadow-sm backdrop-blur-sm`}
    >
      <div className="flex justify-between items-start mb-4">
        {/* Removed background, kept padding but transparent */}
        <div className={`p-0 rounded-lg bg-transparent ${iconColor[color]}`}>
          {Icon && <Icon className="w-8 h-8" />} 
        </div>
        {trend && (
          <div className={`flex items-center text-xs font-medium px-2 py-1 rounded-full bg-black/40 ${
            trendColor[trend] || trendColor.neutral
          }`}>
            {trend === 'up' && <ArrowUpRight className="w-3 h-3 mr-1" />}
            {trend === 'down' && <ArrowDownRight className="w-3 h-3 mr-1" />}
            {trend === 'neutral' && <Minus className="w-3 h-3 mr-1" />}
            {trendValue}
          </div>
        )}
      </div>
      
      <div>
        <h3 className="text-zinc-400 text-sm font-medium mb-1">{renderWithKpiTooltips(title)}</h3>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-white">{value}</span>
          {subValue && (
            <span className={`text-xs ${statusColor[status]}`}>
              {renderWithKpiTooltips(subValue)}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default MetricCard;