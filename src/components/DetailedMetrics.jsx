import React from 'react';
import { motion } from 'framer-motion';
import { Layers, MonitorPlay, ShoppingBag, Search, Radio, BarChart3, AlertCircle } from 'lucide-react';

const DetailSection = ({ title, icon: Icon, children }) => (
  <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden mb-6 shadow-lg">
    <div className="p-4 border-b border-zinc-800 bg-zinc-900/50 flex items-center gap-2">
      <Icon className="w-5 h-5 text-emerald-500" />
      <h3 className="font-semibold text-white">{title}</h3>
    </div>
    <div className="p-4">
      {children}
    </div>
  </div>
);

const PerformanceBar = ({ value, label, color = 'bg-emerald-500' }) => (
  <div className="mb-3">
    <div className="flex justify-between text-xs mb-1">
      <span className="text-zinc-300">{label}</span>
      <span className="text-zinc-400">{value}%</span>
    </div>
    <div className="h-2 bg-zinc-950 rounded-full overflow-hidden">
      <div 
        className={`h-full ${color} rounded-full transition-all duration-500`}
        style={{ width: `${Math.min(value, 100)}%` }}
      />
    </div>
  </div>
);

const DetailedMetrics = ({ client }) => {
  if (!client || !client.campaigns) return null;

  // Aggregate data from all campaigns for the manager view
  const aggregatedData = {
    assetGroups: client.campaigns.flatMap(c => c.assetGroups || []),
    assetTypes: client.campaigns.reduce((acc, c) => {
      if (!c.assetTypes) return acc;
      Object.keys(c.assetTypes).forEach(key => {
        if (!acc[key]) acc[key] = { ...c.assetTypes[key], count: 0 };
        acc[key].count++;
      });
      return acc;
    }, {}),
    listingGroups: client.campaigns.flatMap(c => c.listingGroups || []),
    searchTerms: client.campaigns.flatMap(c => c.searchTerms || []),
    audienceSignals: client.campaigns.flatMap(c => c.audienceSignals || []),
    impressionShare: client.campaigns.reduce((acc, c) => ({
      searchIS: acc.searchIS + (c.searchImpressionShare || 0),
      budgetLoss: acc.budgetLoss + (c.lostImpressionShareBudget || 0),
      rankLoss: acc.rankLoss + (c.lostImpressionShareRank || 0),
      count: acc.count + 1
    }), { searchIS: 0, budgetLoss: 0, rankLoss: 0, count: 0 })
  };

  const avgIS = {
    search: Math.round(aggregatedData.impressionShare.searchIS / (aggregatedData.impressionShare.count || 1)),
    budget: Math.round(aggregatedData.impressionShare.budgetLoss / (aggregatedData.impressionShare.count || 1)),
    rank: Math.round(aggregatedData.impressionShare.rankLoss / (aggregatedData.impressionShare.count || 1))
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Impression Share Metrics */}
        <DetailSection title="Análise de Parcela de Impressões" icon={BarChart3}>
          <div className="space-y-4">
            <PerformanceBar value={avgIS.search} label="Parcela de Impressões na Pesquisa" color="bg-emerald-500" />
            <PerformanceBar value={avgIS.budget} label="Perda p/ Orçamento (Taxa de Consumo)" color="bg-orange-500" />
            <PerformanceBar value={avgIS.rank} label="Perda p/ Classificação (Força do Anúncio)" color="bg-red-500" />
            <div className="mt-4 p-3 bg-zinc-950/50 border border-zinc-800 rounded-lg text-xs text-zinc-300 flex gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-zinc-500" />
              <p>
                {avgIS.budget > 20 ? 'Considere aumentar o orçamento para capturar demanda perdida.' : 
                 avgIS.rank > 20 ? 'A força do anúncio está baixa. Melhore os recursos e a qualidade do feed.' : 
                 'A parcela de impressões está saudável.'}
              </p>
            </div>
          </div>
        </DetailSection>

        {/* Asset Group Performance */}
        <DetailSection title="Desempenho do Grupo de Recursos" icon={Layers}>
          <div className="space-y-3 max-h-[250px] overflow-y-auto custom-scrollbar">
            {aggregatedData.assetGroups.length > 0 ? (
              aggregatedData.assetGroups.map((group, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 bg-zinc-950 rounded border border-zinc-800">
                  <div>
                    <p className="text-sm font-medium text-white">{group.name}</p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                      group.status === 'Excellent' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-yellow-500/20 text-yellow-400'
                    }`}>{group.status === 'Excellent' ? 'Excelente' : group.status === 'Good' ? 'Bom' : 'Aprendizado'}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-zinc-400">Perf: <span className={group.performance === 'high' ? 'text-emerald-400' : 'text-orange-400'}>{group.performance === 'high' ? 'Alta' : 'Média'}</span></p>
                  </div>
                </div>
              ))
            ) : <p className="text-zinc-500 text-sm">Nenhum dado de grupo de recursos disponível.</p>}
          </div>
        </DetailSection>

        {/* Search Terms & Conversions */}
        <DetailSection title="Termos de Pesquisa c/ Conversões" icon={Search}>
          <div className="space-y-2 max-h-[250px] overflow-y-auto custom-scrollbar">
            <table className="w-full text-sm">
              <thead className="text-xs text-zinc-500 border-b border-zinc-800">
                <tr>
                  <th className="text-left py-1">Termo</th>
                  <th className="text-right py-1">Conv.</th>
                  <th className="text-right py-1">Custo</th>
                </tr>
              </thead>
              <tbody className="text-zinc-300">
                {aggregatedData.searchTerms.map((term, idx) => (
                  <tr key={idx} className="border-b border-zinc-800/50">
                    <td className="py-2">{term.term}</td>
                    <td className="text-right">{term.conversions}</td>
                    <td className="text-right text-zinc-400">R${term.cost}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DetailSection>

        {/* Listing Groups (Products) */}
        <DetailSection title="Desempenho do Grupo de Listagem" icon={ShoppingBag}>
          <div className="space-y-3">
             {aggregatedData.listingGroups.map((group, idx) => (
                <div key={idx} className="flex justify-between items-center text-sm">
                  <span className="text-zinc-300">{group.name}</span>
                  <div className="flex gap-3">
                    <span className="text-zinc-400">{group.conversions} Conv</span>
                    <span className={`${group.roas > 4 ? 'text-emerald-400' : 'text-orange-400'}`}>{group.roas}x ROAS</span>
                  </div>
                </div>
             ))}
          </div>
        </DetailSection>

        {/* Asset Type Breakdown */}
        <DetailSection title="Análise por Tipo de Recurso" icon={MonitorPlay}>
          <div className="grid grid-cols-2 gap-2">
            {Object.values(aggregatedData.assetTypes).map((type, idx) => (
              <div key={idx} className="bg-zinc-950 p-3 rounded-lg border border-zinc-800 text-center">
                <p className="text-xs text-zinc-400 mb-1">{type.label}</p>
                <div className={`text-sm font-semibold ${
                  type.performance === 'high' ? 'text-emerald-400' : 
                  type.performance === 'good' ? 'text-blue-400' : 'text-orange-400'
                }`}>
                  {type.performance === 'high' ? 'ALTA' : type.performance === 'good' ? 'BOA' : 'MÉDIA'}
                </div>
              </div>
            ))}
          </div>
        </DetailSection>

         {/* Audience Signals */}
         <DetailSection title="Força do Sinal de Público" icon={Radio}>
          <div className="space-y-2">
             {aggregatedData.audienceSignals.map((signal, idx) => (
                <div key={idx} className="flex justify-between items-center text-sm p-2 hover:bg-zinc-950 rounded transition-colors">
                  <span className="text-zinc-300">{signal.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    signal.strength === 'Strong' ? 'bg-purple-500/20 text-purple-400' : 'bg-zinc-500/20 text-zinc-400'
                  }`}>{signal.strength === 'Strong' ? 'Forte' : 'Médio'}</span>
                </div>
             ))}
          </div>
        </DetailSection>

      </div>
    </div>
  );
};

export default DetailedMetrics;