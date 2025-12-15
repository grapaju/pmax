import React, { useState } from 'react';
import { 
  AlertTriangle, CheckCircle2, TrendingUp, TrendingDown, 
  MousePointerClick, Eye, Target, DollarSign, Lightbulb,
  MoreHorizontal, Copy, LayoutTemplate, Image as ImageIcon, Type
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const AdAnalysis = ({ targetRoas = 4, targetCpa = 45 }) => {
  // Mock Data for Ads
  const [ads] = useState([
    {
      id: 1,
      headline: "Promoção de Tênis Esportivos | Frete Grátis Brasil",
      description: "A melhor tecnologia para sua corrida. Conforto e desempenho garantidos com 30% OFF.",
      type: "Responsive Search",
      assetType: "text",
      roas: 6.8,
      ctr: 5.2,
      conversions: 145,
      cpa: 22.50,
      impressions: 25400,
      clicks: 1320,
      status: "excellent"
    },
    {
      id: 2,
      headline: "Coleção Verão 2024 - Chegou a Hora de Brilhar",
      description: "Novos modelos disponíveis. Parcele em até 10x sem juros no cartão.",
      type: "Display / Image",
      assetType: "image",
      roas: 4.5,
      ctr: 1.8,
      conversions: 82,
      cpa: 38.10,
      impressions: 45000,
      clicks: 810,
      status: "good"
    },
    {
      id: 3,
      headline: "Oferta Relâmpago: Sapatos Sociais",
      description: "Elegância e sofisticação para o seu trabalho. Descontos progressivos.",
      type: "Responsive Search",
      assetType: "text",
      roas: 3.9,
      ctr: 3.1,
      conversions: 45,
      cpa: 48.00,
      impressions: 12000,
      clicks: 372,
      status: "average"
    },
    {
      id: 4,
      headline: "Kit 3 Camisetas Básicas - Algodão Egípcio",
      description: "O básico que funciona. Alta durabilidade e conforto extremo.",
      type: "Video Ad",
      assetType: "video",
      roas: 2.1,
      ctr: 0.8,
      conversions: 12,
      cpa: 85.50,
      impressions: 8500,
      clicks: 68,
      status: "poor"
    },
    {
      id: 5,
      headline: "Liquidação de Inverno - Últimas Peças",
      description: "Garanta seu look de inverno com preços imperdíveis. Estoque limitado.",
      type: "Display / Image",
      assetType: "image",
      roas: 1.5,
      ctr: 0.5,
      conversions: 5,
      cpa: 120.00,
      impressions: 15000,
      clicks: 75,
      status: "poor"
    }
  ]);

  // Sort by performance (ROAS)
  const sortedAds = [...ads].sort((a, b) => b.roas - a.roas);

  const getStatusColor = (status) => {
    switch (status) {
      case 'excellent': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'good': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'average': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
      case 'poor': return 'bg-red-500/10 text-red-400 border-red-500/20';
      default: return 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20';
    }
  };

  const getImprovementSuggestion = (ad) => {
    if (ad.roas < 2.0) return { text: "Pausar ou reescrever completamente. Baixo retorno.", icon: AlertTriangle, color: "text-red-400" };
    if (ad.ctr < 1.0) return { text: "Melhorar criativo/imagem para aumentar CTR.", icon: Eye, color: "text-orange-400" };
    if (ad.cpa > targetCpa * 1.5) return { text: "Revisar Landing Page ou Segmentação.", icon: Target, color: "text-yellow-400" };
    if (ad.status === 'excellent') return { text: "Ótimo desempenho! Considere escalar.", icon: TrendingUp, color: "text-emerald-400" };
    return { text: "Monitorar desempenho.", icon: Lightbulb, color: "text-blue-400" };
  };

  const getAssetIcon = (type) => {
    switch(type) {
      case 'image': return <ImageIcon className="w-4 h-4" />;
      case 'video': return <LayoutTemplate className="w-4 h-4" />;
      default: return <Type className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Header Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800 flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 rounded-full text-emerald-400">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-zinc-500">Melhor Anúncio (ROAS)</p>
            <p className="text-xl font-bold text-white">{sortedAds[0].roas}x <span className="text-xs font-normal text-zinc-400">({sortedAds[0].type})</span></p>
          </div>
        </div>
        <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800 flex items-center gap-4">
          <div className="p-3 bg-red-500/10 rounded-full text-red-400">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-zinc-500">Requer Atenção</p>
            <p className="text-xl font-bold text-white">{sortedAds.filter(a => a.status === 'poor').length} <span className="text-xs font-normal text-zinc-400">anúncios críticos</span></p>
          </div>
        </div>
        <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800 flex items-center gap-4">
          <div className="p-3 bg-blue-500/10 rounded-full text-blue-400">
            <MousePointerClick className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-zinc-500">CTR Médio</p>
            <p className="text-xl font-bold text-white">
              {(sortedAds.reduce((acc, curr) => acc + curr.ctr, 0) / sortedAds.length).toFixed(2)}%
            </p>
          </div>
        </div>
      </div>

      {/* Ads List */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <LayoutTemplate className="w-5 h-5 text-zinc-400" />
          Ranking de Performance dos Anúncios
        </h3>

        <div className="grid gap-4">
          {sortedAds.map((ad, index) => {
            const suggestion = getImprovementSuggestion(ad);
            const SuggestionIcon = suggestion.icon;

            return (
              <div 
                key={ad.id} 
                className={`bg-zinc-900 rounded-xl border p-5 transition-all hover:border-zinc-700 group ${
                  ad.status === 'poor' ? 'border-red-900/30' : 
                  ad.status === 'excellent' ? 'border-emerald-900/30' : 'border-zinc-800'
                }`}
              >
                <div className="flex flex-col lg:flex-row gap-6">
                  
                  {/* Ad Content Preview */}
                  <div className="flex-1 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border flex items-center gap-1.5 ${getStatusColor(ad.status)}`}>
                          {getAssetIcon(ad.assetType)}
                          {ad.status === 'excellent' ? 'Excelente' : ad.status === 'good' ? 'Bom' : ad.status === 'average' ? 'Médio' : 'Ruim'}
                        </span>
                        <span className="text-xs text-zinc-500 uppercase tracking-wider">{ad.type}</span>
                      </div>
                      <div className="text-zinc-500 text-xs font-mono">#{index + 1}</div>
                    </div>

                    <div>
                      <h4 className="text-base font-semibold text-blue-400 mb-1 group-hover:underline cursor-pointer">
                        {ad.headline}
                      </h4>
                      <p className="text-sm text-zinc-400 leading-relaxed">
                        {ad.description}
                      </p>
                    </div>

                    {/* Recommendation Badge */}
                    <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg bg-zinc-950/50 border border-zinc-800/50 w-fit ${suggestion.color}`}>
                      <SuggestionIcon className="w-3.5 h-3.5" />
                      <span className="font-medium">Sugestão:</span> {suggestion.text}
                    </div>
                  </div>

                  {/* Vertical Divider */}
                  <div className="hidden lg:block w-px bg-zinc-800" />

                  {/* Metrics Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4 gap-4 lg:min-w-[480px]">
                    <div className="space-y-1">
                      <p className="text-xs text-zinc-500 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> ROAS</p>
                      <p className={`text-lg font-bold ${ad.roas >= 4 ? 'text-emerald-400' : ad.roas < 2 ? 'text-red-400' : 'text-white'}`}>
                        {ad.roas}x
                      </p>
                    </div>
                    
                    <div className="space-y-1">
                      <p className="text-xs text-zinc-500 flex items-center gap-1"><Target className="w-3 h-3" /> CPA</p>
                      <p className={`text-lg font-bold ${ad.cpa > targetCpa * 1.2 ? 'text-red-400' : 'text-white'}`}>
                        R${ad.cpa.toFixed(2)}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs text-zinc-500 flex items-center gap-1"><DollarSign className="w-3 h-3" /> Conversões</p>
                      <p className="text-lg font-bold text-white">{ad.conversions}</p>
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs text-zinc-500 flex items-center gap-1"><MousePointerClick className="w-3 h-3" /> CTR</p>
                      <p className={`text-lg font-bold ${ad.ctr < 1.0 ? 'text-orange-400' : 'text-white'}`}>
                        {ad.ctr}%
                      </p>
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs text-zinc-500 flex items-center gap-1"><Eye className="w-3 h-3" /> Impressões</p>
                      <p className="text-sm font-medium text-zinc-300">{ad.impressions.toLocaleString()}</p>
                    </div>

                     <div className="space-y-1">
                      <p className="text-xs text-zinc-500">Cliques</p>
                      <p className="text-sm font-medium text-zinc-300">{ad.clicks.toLocaleString()}</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex lg:flex-col justify-end">
                     <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0 text-zinc-400 hover:text-white hover:bg-zinc-800">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-800 text-zinc-300">
                        <DropdownMenuItem className="focus:bg-zinc-800 cursor-pointer">
                          <Copy className="w-4 h-4 mr-2" /> Duplicar Anúncio
                        </DropdownMenuItem>
                        <DropdownMenuItem className="focus:bg-zinc-800 cursor-pointer text-red-400 focus:text-red-400">
                           Pausar Anúncio
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default AdAnalysis;