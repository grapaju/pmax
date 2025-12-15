import React from 'react';
import { motion } from 'framer-motion';
import { Lightbulb, TrendingUp, Target, Zap, AlertTriangle, ShieldCheck, DollarSign } from 'lucide-react';

const OptimizationSuggestions = ({ clients }) => {
  const suggestions = [];

  clients.forEach(client => {
    client.campaigns.forEach(campaign => {
      // 1. Impression Loss by Budget (Burn Rate High)
      if (campaign.lostImpressionShareBudget > 15) {
        suggestions.push({
          icon: DollarSign,
          title: 'Aumentar Orçamento (Limitado)',
          message: `${campaign.name} está perdendo ${campaign.lostImpressionShareBudget}% de impressões devido ao orçamento. Aumentar o orçamento pode capturar mais volume.`,
          priority: 'high',
          type: 'budget'
        });
      }

      // 2. Ranking Loss (Ad Strength)
      if (campaign.lostImpressionShareRank > 25) {
        suggestions.push({
          icon: Zap,
          title: 'Melhorar Força do Anúncio',
          message: `${campaign.name} está perdendo ${campaign.lostImpressionShareRank}% de impressões por classificação. Atualize títulos, vídeos ou a qualidade do feed.`,
          priority: 'high',
          type: 'creative'
        });
      }

      // 3. ROAS Analysis
      if (campaign.roas < campaign.targetRoas) {
        suggestions.push({
          icon: AlertTriangle,
          title: 'ROAS Abaixo da Meta',
          message: `O ROAS de ${campaign.name} (${campaign.roas}x) está abaixo da meta (${campaign.targetRoas}x). Considere excluir grupos de listagem com baixo desempenho.`,
          priority: 'critical',
          type: 'performance'
        });
      } else if (campaign.roas > campaign.targetRoas * 1.2 && campaign.lostImpressionShareBudget < 5) {
         suggestions.push({
          icon: TrendingUp,
          title: 'Oportunidade de Escala',
          message: `${campaign.name} está superando a meta de ROAS (${campaign.roas}x). Reduza a meta de ROAS ou aumente o CPA para escalar o volume.`,
          priority: 'medium',
          type: 'scaling'
        });
      }

      // 4. Search Terms (Negative suggestions)
      if (campaign.searchTerms) {
        const wastefulTerms = campaign.searchTerms.filter(t => t.cost > 50 && t.conversions === 0);
        if (wastefulTerms.length > 0) {
           suggestions.push({
            icon: ShieldCheck,
            title: 'Adicionar Palavras-chave Negativas',
            message: `Encontrados ${wastefulTerms.length} termos (ex: "${wastefulTerms[0].term}") gastando verba sem conversões. Adicione como negativas.`,
            priority: 'medium',
            type: 'optimization'
          });
        }
      }

      // 5. Asset Groups
      if (campaign.assetGroups) {
        const poorGroups = campaign.assetGroups.filter(g => g.performance === 'low');
        if (poorGroups.length > 0) {
           suggestions.push({
            icon: Target,
            title: 'Renovar Grupos de Recursos',
            message: `Grupo de recursos "${poorGroups[0].name}" tem baixo desempenho. Substitua imagens e reescreva descrições.`,
            priority: 'medium',
            type: 'creative'
          });
        }
      }
    });
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.3 }}
      className="bg-zinc-900 rounded-xl p-6 border border-zinc-800 shadow-lg"
    >
      <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
        <Lightbulb className="w-5 h-5 text-yellow-400" />
        Motor de Diagnóstico & Otimização
      </h2>

      <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar">
        {suggestions.length > 0 ? (
          suggestions.map((suggestion, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              className={`p-4 rounded-lg border bg-gradient-to-r ${
                suggestion.priority === 'critical' ? 'from-red-900/10 to-red-900/5 border-red-900/20' :
                suggestion.priority === 'high' ? 'from-orange-900/10 to-orange-900/5 border-orange-900/20' :
                'from-emerald-900/10 to-emerald-900/5 border-emerald-900/20'
              }`}
            >
              <div className="flex items-start gap-3">
                <suggestion.icon className={`w-5 h-5 flex-shrink-0 ${
                   suggestion.priority === 'critical' ? 'text-red-400' :
                   suggestion.priority === 'high' ? 'text-orange-400' :
                   'text-emerald-400'
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-white font-semibold text-sm">{suggestion.title}</p>
                    <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${
                       suggestion.priority === 'critical' ? 'bg-red-500/10 text-red-400' :
                       suggestion.priority === 'high' ? 'bg-orange-500/10 text-orange-400' :
                       'bg-emerald-500/10 text-emerald-400'
                    }`}>
                      {suggestion.priority === 'critical' ? 'Crítico' : 
                       suggestion.priority === 'high' ? 'Alto' : 'Médio'}
                    </span>
                  </div>
                  <p className="text-zinc-400 text-xs leading-relaxed">{suggestion.message}</p>
                </div>
              </div>
            </motion.div>
          ))
        ) : (
          <div className="text-center py-8">
            <ShieldCheck className="w-12 h-12 text-emerald-500/20 mx-auto mb-3" />
            <p className="text-zinc-400">Sistemas Saudáveis</p>
            <p className="text-zinc-500 text-sm mt-1">Nenhuma otimização crítica detectada.</p>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default OptimizationSuggestions;