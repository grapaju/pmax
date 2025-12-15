import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertCircle,
  Star,
  Target,
  Sparkles
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { KeywordAnalyzer, QualityScoreAnalyzer } from '@/lib/googleAdsAnalyzer';

/**
 * GoogleAdsAnalysisView - Visualização completa de análise
 */
export function GoogleAdsAnalysisView({ clientId, dateRange }) {
  const [analysis, setAnalysis] = useState(null);
  const [keywords, setKeywords] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    loadData();
  }, [clientId, dateRange]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Carregar última análise
      const { data: analysisData } = await supabase
        .from('google_ads_analysis')
        .select('*')
        .eq('client_id', clientId)
        .order('analyzed_at', { ascending: false })
        .limit(1)
        .single();

      setAnalysis(analysisData);

      // Carregar keywords
      const { data: keywordsData } = await supabase
        .from('google_ads_keywords')
        .select('*')
        .eq('client_id', clientId)
        .order('cost', { ascending: false })
        .limit(500);

      setKeywords(keywordsData || []);

      // Carregar campanhas
      const { data: campaignsData } = await supabase
        .from('google_ads_metrics')
        .select('*')
        .eq('client_id', clientId)
        .order('cost', { ascending: false });

      setCampaigns(campaignsData || []);

    } catch (error) {
      console.error('Erro ao carregar análise:', error);
    } finally {
      setLoading(false);
    }
  };

  const runAnalysis = async () => {
    try {
      setAnalyzing(true);

      // Executar análise de keywords
      const keywordAnalyzer = new KeywordAnalyzer(keywords);
      const keywordAnalysis = keywordAnalyzer.analyzeAll();

      // Executar análise de quality score
      const qsAnalyzer = new QualityScoreAnalyzer(keywords);
      const qsAnalysis = qsAnalyzer.analyzeAll();

      // Salvar análise no Supabase
      const { data, error } = await supabase
        .from('google_ads_analysis')
        .insert({
          client_id: clientId,
          date_range_start: dateRange?.start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          date_range_end: dateRange?.end || new Date(),
          total_campaigns: campaigns.length,
          total_keywords: keywords.length,
          avg_quality_score: qsAnalysis.overview.averageScore,
          keywords_below_avg: qsAnalysis.overview.belowAverage,
          low_performance_keywords: keywordAnalysis.performance.lowPerformers.length,
          wasteful_keywords: keywordAnalysis.wasteful.length,
          opportunity_keywords: keywordAnalysis.opportunities.length,
          keywords_analysis: keywordAnalysis,
          quality_score_analysis: qsAnalysis,
        })
        .select()
        .single();

      if (error) throw error;

      setAnalysis(data);
      await loadData();

    } catch (error) {
      console.error('Erro ao executar análise:', error);
    } finally {
      setAnalyzing(false);
    }
  };

  if (loading) {
    return <Card><CardHeader><CardTitle>Carregando análise...</CardTitle></CardHeader></Card>;
  }

  const keywordAnalysis = analysis?.keywords_analysis || {};
  const qsAnalysis = analysis?.quality_score_analysis || {};

  return (
    <div className="space-y-6">
      {/* Header com ação */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Análise Google Ads</h2>
          <p className="text-muted-foreground">
            Análise detalhada de performance e oportunidades
          </p>
        </div>
        <Button onClick={runAnalysis} disabled={analyzing}>
          <Sparkles className="h-4 w-4 mr-2" />
          {analyzing ? 'Analisando...' : 'Executar Análise'}
        </Button>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Keywords</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{keywords.length}</div>
            <p className="text-xs text-muted-foreground">
              {keywordAnalysis.summary?.withData || 0} com dados significativos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Quality Score Médio</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {qsAnalysis.overview?.averageScore?.toFixed(1) || '-'}/10
            </div>
            <p className="text-xs text-muted-foreground">
              {qsAnalysis.overview?.belowAverage || 0} abaixo da média
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alto Desempenho</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {keywordAnalysis.performance?.highPerformers?.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">keywords excelentes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Desperdício</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {keywordAnalysis.wasteful?.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">keywords problemáticas</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs com análises detalhadas */}
      <Tabs defaultValue="performance" className="space-y-4">
        <TabsList>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="quality-score">Quality Score</TabsTrigger>
          <TabsTrigger value="opportunities">Oportunidades</TabsTrigger>
          <TabsTrigger value="wasteful">Desperdício</TabsTrigger>
        </TabsList>

        {/* Tab: Performance */}
        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Top Keywords - Alta Performance</CardTitle>
              <CardDescription>
                Keywords com melhor desempenho geral
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Keyword</TableHead>
                    <TableHead>QS</TableHead>
                    <TableHead className="text-right">Impressões</TableHead>
                    <TableHead className="text-right">CTR</TableHead>
                    <TableHead className="text-right">Conversões</TableHead>
                    <TableHead className="text-right">Custo</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(keywordAnalysis.performance?.highPerformers || []).slice(0, 10).map((kw) => (
                    <TableRow key={kw.keyword_text}>
                      <TableCell className="font-medium">{kw.keyword_text}</TableCell>
                      <TableCell>
                        <Badge variant={kw.quality_score >= 7 ? 'default' : 'secondary'}>
                          {kw.quality_score || '-'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{kw.impressions.toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        {(kw.ctr * 100).toFixed(2)}%
                      </TableCell>
                      <TableCell className="text-right">{kw.conversions.toFixed(1)}</TableCell>
                      <TableCell className="text-right">R$ {kw.cost.toFixed(2)}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="default">{kw.performanceScore}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Keywords com Baixa Performance</CardTitle>
              <CardDescription>
                Requerem atenção ou otimização
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Keyword</TableHead>
                    <TableHead>QS</TableHead>
                    <TableHead className="text-right">CTR</TableHead>
                    <TableHead className="text-right">Conversões</TableHead>
                    <TableHead className="text-right">Custo</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(keywordAnalysis.performance?.lowPerformers || []).slice(0, 10).map((kw) => (
                    <TableRow key={kw.keyword_text}>
                      <TableCell className="font-medium">{kw.keyword_text}</TableCell>
                      <TableCell>
                        <Badge variant="destructive">
                          {kw.quality_score || '-'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-red-600">
                        {(kw.ctr * 100).toFixed(2)}%
                      </TableCell>
                      <TableCell className="text-right">{kw.conversions.toFixed(1)}</TableCell>
                      <TableCell className="text-right">R$ {kw.cost.toFixed(2)}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="destructive">{kw.performanceScore}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Quality Score */}
        <TabsContent value="quality-score" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Distribuição QS</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm">QS 1-3 (Crítico)</span>
                    <span className="text-sm font-semibold">
                      {qsAnalysis.distribution?.['1-3'] || 0}
                    </span>
                  </div>
                  <Progress 
                    value={(qsAnalysis.distribution?.['1-3'] || 0) / keywords.length * 100} 
                    className="bg-red-100"
                  />
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm">QS 4-6 (Médio)</span>
                    <span className="text-sm font-semibold">
                      {qsAnalysis.distribution?.['4-6'] || 0}
                    </span>
                  </div>
                  <Progress 
                    value={(qsAnalysis.distribution?.['4-6'] || 0) / keywords.length * 100}
                    className="bg-yellow-100"
                  />
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm">QS 7-10 (Bom)</span>
                    <span className="text-sm font-semibold">
                      {qsAnalysis.distribution?.['7-10'] || 0}
                    </span>
                  </div>
                  <Progress 
                    value={(qsAnalysis.distribution?.['7-10'] || 0) / keywords.length * 100}
                    className="bg-green-100"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="col-span-2">
              <CardHeader>
                <CardTitle>Componentes do Quality Score</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <h4 className="text-sm font-medium mb-2">Ad Relevance</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>Acima da média:</span>
                        <Badge variant="default">
                          {qsAnalysis.components?.adRelevance?.aboveAverage || 0}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Média:</span>
                        <Badge variant="secondary">
                          {qsAnalysis.components?.adRelevance?.average || 0}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Abaixo:</span>
                        <Badge variant="destructive">
                          {qsAnalysis.components?.adRelevance?.belowAverage || 0}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium mb-2">Landing Page</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>Acima da média:</span>
                        <Badge variant="default">
                          {qsAnalysis.components?.landingPageExperience?.aboveAverage || 0}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Média:</span>
                        <Badge variant="secondary">
                          {qsAnalysis.components?.landingPageExperience?.average || 0}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Abaixo:</span>
                        <Badge variant="destructive">
                          {qsAnalysis.components?.landingPageExperience?.belowAverage || 0}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium mb-2">Expected CTR</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>Acima da média:</span>
                        <Badge variant="default">
                          {qsAnalysis.components?.expectedCtr?.aboveAverage || 0}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Média:</span>
                        <Badge variant="secondary">
                          {qsAnalysis.components?.expectedCtr?.average || 0}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Abaixo:</span>
                        <Badge variant="destructive">
                          {qsAnalysis.components?.expectedCtr?.belowAverage || 0}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab: Oportunidades */}
        <TabsContent value="opportunities" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Oportunidades de Crescimento</CardTitle>
              <CardDescription>
                Keywords com potencial para expandir resultados
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Keyword</TableHead>
                    <TableHead>Razões</TableHead>
                    <TableHead className="text-right">Impacto</TableHead>
                    <TableHead className="text-right">CTR</TableHead>
                    <TableHead className="text-right">Conversões</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(keywordAnalysis.opportunities || []).slice(0, 10).map((kw) => (
                    <TableRow key={kw.keyword_text}>
                      <TableCell className="font-medium">{kw.keyword_text}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {kw.opportunityReasons?.map((reason, idx) => (
                            <div key={idx} className="text-xs text-muted-foreground">
                              • {reason}
                            </div>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="default">{kw.potentialImpact}</Badge>
                      </TableCell>
                      <TableCell className="text-right text-green-600">
                        {(kw.ctr * 100).toFixed(2)}%
                      </TableCell>
                      <TableCell className="text-right">{kw.conversions.toFixed(1)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Desperdício */}
        <TabsContent value="wasteful" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Keywords Desperdiçando Budget</CardTitle>
              <CardDescription>
                Ações recomendadas: pausar ou adicionar como negativas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Keyword</TableHead>
                    <TableHead>Problemas</TableHead>
                    <TableHead className="text-right">Custo</TableHead>
                    <TableHead className="text-right">Desperdício</TableHead>
                    <TableHead className="text-right">Gravidade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(keywordAnalysis.wasteful || []).slice(0, 10).map((kw) => (
                    <TableRow key={kw.keyword_text}>
                      <TableCell className="font-medium">{kw.keyword_text}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {kw.wasteReasons?.map((reason, idx) => (
                            <div key={idx} className="text-xs text-red-600">
                              • {reason}
                            </div>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">R$ {kw.cost.toFixed(2)}</TableCell>
                      <TableCell className="text-right text-red-600 font-semibold">
                        R$ {kw.estimatedWaste?.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="destructive">{kw.wasteScore}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default GoogleAdsAnalysisView;
