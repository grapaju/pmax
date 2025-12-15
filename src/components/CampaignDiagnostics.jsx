import React, { useState, useEffect } from 'react';
import { 
  Lightbulb, TrendingUp, Target, Zap, AlertTriangle, ShieldCheck, DollarSign, 
  CheckCircle2, Clock, Calendar, Check, Circle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from '@/components/ui/use-toast';

const CampaignDiagnostics = ({ campaign }) => {
  const [suggestions, setSuggestions] = useState([]);
  const [savedStates, setSavedStates] = useState({});

  // Initialize and load saved states
  useEffect(() => {
    const saved = localStorage.getItem('pmax_diagnostics_state');
    if (saved) {
      setSavedStates(JSON.parse(saved));
    }
  }, []);

  // Generate suggestions based on campaign data
  useEffect(() => {
    const newSuggestions = [];

    // 1. Impression Loss by Budget
    if (campaign.lostImpressionShareBudget > 15) {
      newSuggestions.push({
        id: 'budget_constrained',
        icon: DollarSign,
        title: 'Aumentar Orçamento (Limitado)',
        message: `${campaign.name} está perdendo ${campaign.lostImpressionShareBudget}% de impressões devido ao orçamento. Aumentar o orçamento pode capturar mais volume.`,
        priority: 'high',
        type: 'budget'
      });
    }

    // 2. Ranking Loss (Ad Strength)
    if (campaign.lostImpressionShareRank > 25) {
      newSuggestions.push({
        id: 'ad_strength_low',
        icon: Zap,
        title: 'Melhorar Força do Anúncio',
        message: `${campaign.name} está perdendo ${campaign.lostImpressionShareRank}% de impressões por classificação. Atualize títulos, vídeos ou a qualidade do feed.`,
        priority: 'high',
        type: 'creative'
      });
    }

    // 3. ROAS Analysis
    if (campaign.roas < campaign.targetRoas) {
      newSuggestions.push({
        id: 'roas_low',
        icon: AlertTriangle,
        title: 'ROAS Abaixo da Meta',
        message: `O ROAS de ${campaign.name} (${campaign.roas}x) está abaixo da meta (${campaign.targetRoas}x). Considere excluir grupos de listagem com baixo desempenho.`,
        priority: 'critical',
        type: 'performance'
      });
    } else if (campaign.roas > campaign.targetRoas * 1.2 && campaign.lostImpressionShareBudget < 5) {
       newSuggestions.push({
        id: 'scale_opportunity',
        icon: TrendingUp,
        title: 'Oportunidade de Escala',
        message: `${campaign.name} está superando a meta de ROAS (${campaign.roas}x). Reduza a meta de ROAS ou aumente o CPA para escalar o volume.`,
        priority: 'medium',
        type: 'scaling'
      });
    }

    // 4. Search Terms
    if (campaign.searchTerms) {
      const wastefulTerms = campaign.searchTerms.filter(t => t.cost > 50 && t.conversions === 0);
      if (wastefulTerms.length > 0) {
         newSuggestions.push({
          id: 'negative_keywords',
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
         newSuggestions.push({
          id: 'asset_refresh',
          icon: Target,
          title: 'Renovar Grupos de Recursos',
          message: `Grupo de recursos "${poorGroups[0].name}" tem baixo desempenho. Substitua imagens e reescreva descrições.`,
          priority: 'medium',
          type: 'creative'
        });
      }
    }

    setSuggestions(newSuggestions);
  }, [campaign]);

  const handleStatusChange = (suggestionId, status) => {
    const key = `${campaign.id}_${suggestionId}`;
    const newState = {
      status,
      lastModified: new Date().toISOString()
    };

    const updatedStates = {
      ...savedStates,
      [key]: newState
    };

    setSavedStates(updatedStates);
    localStorage.setItem('pmax_diagnostics_state', JSON.stringify(updatedStates));
    
    toast({
      title: 'Status Atualizado',
      description: `O status da sugestão foi alterado para: ${status}`,
    });
  };

  const getStatus = (suggestionId) => {
    const key = `${campaign.id}_${suggestionId}`;
    return savedStates[key] || { status: 'Para Fazer', lastModified: null };
  };

  const statusOptions = [
    { label: 'Para Fazer', value: 'Para Fazer', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20' },
    { label: 'Viável', value: 'Viável', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
    { label: 'Feito', value: 'Feito', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  ];

  if (suggestions.length === 0) {
    return (
      <div className="p-6 text-center bg-zinc-900/50 rounded-lg border border-zinc-800 border-dashed">
        <CheckCircle2 className="w-10 h-10 text-emerald-500/20 mx-auto mb-2" />
        <p className="text-zinc-500">Tudo certo! Nenhuma otimização necessária no momento.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Lightbulb className="w-5 h-5 text-yellow-500" />
        <h3 className="text-lg font-semibold text-white">Checklist de Diagnóstico & Otimização</h3>
      </div>
      
      <div className="grid gap-3">
        {suggestions.map((suggestion) => {
          const currentData = getStatus(suggestion.id);
          const currentStatus = statusOptions.find(opt => opt.value === currentData.status) || statusOptions[0];
          
          return (
            <div 
              key={suggestion.id}
              className={`p-4 rounded-lg border bg-zinc-950/80 transition-all duration-300 ${
                currentData.status === 'Feito' ? 'border-zinc-800 opacity-75' : 'border-zinc-700 hover:border-zinc-600'
              }`}
            >
              <div className="flex flex-col sm:flex-row gap-4 justify-between">
                <div className="flex items-start gap-3 flex-1">
                  <div className={`p-2 rounded-lg bg-zinc-900 border border-zinc-800 ${
                     suggestion.priority === 'critical' ? 'text-red-400' :
                     suggestion.priority === 'high' ? 'text-orange-400' :
                     'text-emerald-400'
                  }`}>
                    <suggestion.icon className="w-5 h-5" />
                  </div>
                  
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className={`font-semibold text-sm ${currentData.status === 'Feito' ? 'text-zinc-400 line-through' : 'text-white'}`}>
                        {suggestion.title}
                      </h4>
                      {suggestion.priority === 'critical' && currentData.status !== 'Feito' && (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-red-400 bg-red-950/50 px-2 py-0.5 rounded border border-red-900/50">
                          Crítico
                        </span>
                      )}
                    </div>
                    <p className={`text-sm ${currentData.status === 'Feito' ? 'text-zinc-500' : 'text-zinc-400'}`}>
                      {suggestion.message}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2 min-w-[200px]">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className={`w-full justify-between border-2 font-medium ${currentStatus.color} ${currentStatus.bg} hover:bg-zinc-900`}
                      >
                        <span className="flex items-center gap-2">
                          {currentData.status === 'Feito' ? <Check className="w-3 h-3" /> : 
                           currentData.status === 'Viável' ? <Circle className="w-3 h-3" /> :
                           <Clock className="w-3 h-3" />}
                          {currentData.status}
                        </span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-800 text-white">
                      {statusOptions.map((option) => (
                        <DropdownMenuItem
                          key={option.value}
                          onClick={() => handleStatusChange(suggestion.id, option.value)}
                          className={`cursor-pointer focus:bg-zinc-800 ${option.color}`}
                        >
                          {option.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {currentData.lastModified && (
                    <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                      <Calendar className="w-3 h-3" />
                      <span>
                        {currentData.status === 'Feito' ? 'Concluído em: ' : 'Modificado: '}
                        {new Date(currentData.lastModified).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CampaignDiagnostics;