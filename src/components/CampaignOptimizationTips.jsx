import React from 'react';
import { Lightbulb, Zap, Target, TrendingUp, MousePointerClick, RefreshCw, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';

const CampaignOptimizationTips = ({ totals, targets }) => {
  if (!totals || !targets) return null;

  const tips = [];

  // 1. ROAS Analysis
  if (totals.roas < targets.roas) {
    tips.push({
      type: 'bid',
      title: 'Ajuste de Lance (tROAS)',
      description: `Seu ROAS atual (${totals.roas.toFixed(2)}x) está abaixo da meta (${targets.roas}x). Considere reduzir o target ROAS para ganhar tração ou pausar grupos de recursos com baixo desempenho.`,
      icon: Target,
      color: 'text-orange-400',
      bg: 'bg-orange-500/10',
      border: 'border-orange-500/20'
    });
  } else if (totals.roas > targets.roas * 1.2) {
    tips.push({
      type: 'scale',
      title: 'Oportunidade de Escala',
      description: `Performance excelente! Seu ROAS (${totals.roas.toFixed(2)}x) está bem acima da meta. Você pode aumentar o orçamento ou diminuir o tROAS para buscar mais volume.`,
      icon: TrendingUp,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20'
    });
  }

  // 2. CTR Analysis (Creative Quality)
  if (totals.ctr < 1.0) {
    tips.push({
      type: 'creative',
      title: 'Otimização de Criativos',
      description: `CTR de ${totals.ctr.toFixed(2)}% indica fadiga de anúncio ou baixa relevância. Atualize imagens, teste novos vídeos e revise títulos para melhorar o índice de qualidade.`,
      icon: RefreshCw,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/20'
    });
  }

  // 3. CPA Analysis
  if (totals.cpa > targets.cpa * 1.15) {
    tips.push({
      type: 'audience',
      title: 'Refinamento de Público',
      description: `CPA alto (R$${totals.cpa.toFixed(2)}). Revise seus sinais de audiência. Adicione listas de clientes compradores e remova segmentos muito amplos.`,
      icon: Zap,
      color: 'text-red-400',
      bg: 'bg-red-500/10',
      border: 'border-red-500/20'
    });
  }

  // 4. CPC/Budget Analysis
  if (totals.spend < targets.budget * 0.7) {
     tips.push({
      type: 'budget',
      title: 'Orçamento Subutilizado',
      description: `Você investiu apenas R$${totals.spend.toFixed(0)} do orçamento de R$${targets.budget}. Verifique se o tROAS/tCPA não está muito restritivo limitando os lances.`,
      icon: DollarSign,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10',
      border: 'border-purple-500/20'
    });
  }

  // Ensure we have at least generic tips if performing perfectly
  if (tips.length === 0) {
    tips.push({
      type: 'general',
      title: 'Monitoramento Contínuo',
      description: 'Campanha estável e dentro das metas. Continue monitorando os termos de pesquisa para negativar tráfego irrelevante periodicamente.',
      icon: Lightbulb,
      color: 'text-yellow-400',
      bg: 'bg-yellow-500/10',
      border: 'border-yellow-500/20'
    });
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-yellow-500" />
          Dicas de Otimização PMax
        </h3>
        <span className="text-xs text-zinc-500">Baseado nas métricas atuais</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {tips.map((tip, index) => (
          <div 
            key={index} 
            className={`p-4 rounded-lg border flex gap-4 transition-all hover:bg-zinc-800/50 ${tip.bg} ${tip.border}`}
          >
            <div className={`mt-1 p-2 rounded-full bg-zinc-950/50 h-fit ${tip.color}`}>
              <tip.icon className="w-4 h-4" />
            </div>
            <div>
              <h4 className={`text-sm font-semibold mb-1 ${tip.color}`}>{tip.title}</h4>
              <p className="text-xs text-zinc-300 leading-relaxed">
                {tip.description}
              </p>
              <Button variant="link" className={`h-auto p-0 text-xs mt-2 ${tip.color} opacity-80 hover:opacity-100`}>
                Aplicar Recomendação →
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CampaignOptimizationTips;