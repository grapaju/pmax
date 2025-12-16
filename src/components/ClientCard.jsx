
import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, MoreVertical, MousePointer2, DollarSign, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const ClientCard = ({ client, index, onClick }) => {
  // Aggregate data from all campaigns
  const aggregateData = (client.campaigns || []).reduce((acc, c) => ({
    spend: acc.spend + (c.spend || 0),
    budget: acc.budget + (c.budget || 0),
    conversions: acc.conversions + (c.conversions || 0),
    value: acc.value + (c.conversionValue || 0),
  }), { spend: 0, budget: 0, conversions: 0, value: 0 });

  const roas = aggregateData.spend > 0 ? aggregateData.value / aggregateData.spend : 0;
  const burnRate = aggregateData.budget > 0 ? (aggregateData.spend / aggregateData.budget) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      onClick={onClick}
      className="group relative bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-emerald-500/50 transition-all cursor-pointer hover:shadow-lg hover:shadow-emerald-900/10"
    >
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="font-semibold text-lg text-white group-hover:text-emerald-400 transition-colors">
            {client.client_name}
          </h3>
          <p className="text-zinc-500 text-xs mt-1">ID: {client.client_id}</p>
        </div>
        <div className={cn(
          "px-2 py-1 rounded text-xs font-medium",
          roas >= 4 ? "bg-emerald-500/10 text-emerald-400" : 
          roas >= 2 ? "bg-blue-500/10 text-blue-400" :
          "bg-orange-500/10 text-orange-400"
        )}>
          <abbr
            title="ROAS = Retorno sobre o gasto com anúncios (valor de conversão ÷ custo)."
            className="underline decoration-dotted underline-offset-2 cursor-help"
          >
            ROAS
          </abbr>{' '}
          {roas.toFixed(2)}x
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="space-y-1">
          <p className="text-xs text-zinc-500 flex items-center gap-1">
            <DollarSign className="w-3 h-3" /> Investimento
          </p>
          <p className="text-sm font-medium text-zinc-200">
            R$ {aggregateData.spend.toLocaleString()}
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-zinc-500 flex items-center gap-1">
            <Target className="w-3 h-3" /> Conversões
          </p>
          <p className="text-sm font-medium text-zinc-200">
            {aggregateData.conversions}
          </p>
        </div>
      </div>

      <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
        <div 
          className={cn(
            "h-full rounded-full transition-all duration-500",
            burnRate > 90 ? "bg-orange-500" : "bg-emerald-500"
          )}
          style={{ width: `${Math.min(burnRate, 100)}%` }}
        />
      </div>
      <div className="flex justify-between mt-2 text-xs">
        <span className="text-zinc-500">Consumo do Orçamento</span>
        <span className={cn(
          "font-medium",
          burnRate > 90 ? "text-orange-400" : "text-emerald-400"
        )}>{burnRate.toFixed(0)}%</span>
      </div>
    </motion.div>
  );
};

export default ClientCard;
