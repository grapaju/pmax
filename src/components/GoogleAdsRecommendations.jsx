import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle,
  Lightbulb,
  Target,
  DollarSign,
  Zap
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';

/**
 * GoogleAdsRecommendations - Exibe recomendações de otimização
 */
export function GoogleAdsRecommendations({ clientId, analysisId }) {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, alta, média, baixa
  const [typeFilter, setTypeFilter] = useState('all'); // all, keyword, budget, quality_score, ad

  useEffect(() => {
    loadRecommendations();
  }, [clientId, analysisId]);

  const loadRecommendations = async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('google_ads_recommendations')
        .select('*')
        .eq('client_id', clientId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (analysisId) {
        query = query.eq('analysis_id', analysisId);
      }

      const { data, error } = await query;

      if (error) throw error;

      setRecommendations(data || []);
    } catch (error) {
      console.error('Erro ao carregar recomendações:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = async (id) => {
    try {
      const { error } = await supabase
        .from('google_ads_recommendations')
        .update({ 
          status: 'dismissed',
          dismissed_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      setRecommendations(prev => prev.filter(r => r.id !== id));
    } catch (error) {
      console.error('Erro ao descartar recomendação:', error);
    }
  };

  const handleComplete = async (id) => {
    try {
      const { error } = await supabase
        .from('google_ads_recommendations')
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      setRecommendations(prev => prev.filter(r => r.id !== id));
    } catch (error) {
      console.error('Erro ao marcar como completa:', error);
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'alta':
        return 'destructive';
      case 'média':
        return 'default';
      case 'baixa':
        return 'secondary';
      default:
        return 'default';
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'keyword':
        return <Target className="h-4 w-4" />;
      case 'budget':
        return <DollarSign className="h-4 w-4" />;
      case 'quality_score':
        return <TrendingUp className="h-4 w-4" />;
      case 'ad':
        return <Zap className="h-4 w-4" />;
      case 'landing_page':
        return <Lightbulb className="h-4 w-4" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const filteredRecommendations = recommendations.filter(rec => {
    if (filter !== 'all' && rec.priority !== filter) return false;
    if (typeFilter !== 'all' && rec.type !== typeFilter) return false;
    return true;
  });

  const summary = {
    total: recommendations.length,
    alta: recommendations.filter(r => r.priority === 'alta').length,
    média: recommendations.filter(r => r.priority === 'média').length,
    baixa: recommendations.filter(r => r.priority === 'baixa').length,
    estimatedImpact: recommendations.reduce((sum, r) => sum + (r.estimated_impact_value || 0), 0),
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Carregando recomendações...</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{summary.total}</div>
            <p className="text-xs text-muted-foreground">Total de Recomendações</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-red-600">{summary.alta}</div>
            <p className="text-xs text-muted-foreground">Prioridade Alta</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-yellow-600">{summary.média}</div>
            <p className="text-xs text-muted-foreground">Prioridade Média</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">
              R$ {summary.estimatedImpact.toFixed(0)}
            </div>
            <p className="text-xs text-muted-foreground">Impacto Estimado</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={filter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('all')}
            >
              Todas ({summary.total})
            </Button>
            <Button
              variant={filter === 'alta' ? 'destructive' : 'outline'}
              size="sm"
              onClick={() => setFilter('alta')}
            >
              Alta ({summary.alta})
            </Button>
            <Button
              variant={filter === 'média' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('média')}
            >
              Média ({summary.média})
            </Button>
            <Button
              variant={filter === 'baixa' ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => setFilter('baixa')}
            >
              Baixa ({summary.baixa})
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Recomendações */}
      <div className="space-y-3">
        {filteredRecommendations.length === 0 ? (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>
              Nenhuma recomendação pendente. Ótimo trabalho!
            </AlertDescription>
          </Alert>
        ) : (
          filteredRecommendations.map((rec) => (
            <Card key={rec.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="mt-1">
                      {getTypeIcon(rec.type)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <CardTitle className="text-base">{rec.title}</CardTitle>
                        <Badge variant={getPriorityColor(rec.priority)}>
                          {rec.priority}
                        </Badge>
                        {rec.impact && (
                          <Badge variant="outline">
                            Impacto: {rec.impact}
                          </Badge>
                        )}
                      </div>
                      <CardDescription>{rec.description}</CardDescription>
                    </div>
                  </div>
                  {rec.estimated_impact_value > 0 && (
                    <div className="text-right">
                      <div className="text-sm font-semibold text-green-600">
                        +R$ {rec.estimated_impact_value.toFixed(0)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        economia
                      </div>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* Ação recomendada */}
                  <Alert>
                    <Lightbulb className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Ação:</strong> {rec.action}
                    </AlertDescription>
                  </Alert>

                  {/* Detalhes adicionais */}
                  {rec.keyword_text && (
                    <div className="text-sm text-muted-foreground">
                      <strong>Palavra-chave:</strong> {rec.keyword_text}
                    </div>
                  )}
                  {rec.campaign_id && rec.related_data?.campaign?.campaign_name && (
                    <div className="text-sm text-muted-foreground">
                      <strong>Campanha:</strong> {rec.related_data.campaign.campaign_name}
                    </div>
                  )}

                  {/* Botões de ação */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => handleComplete(rec.id)}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      Implementada
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDismiss(rec.id)}
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Descartar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

export default GoogleAdsRecommendations;
