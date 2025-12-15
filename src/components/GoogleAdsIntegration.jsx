import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, AlertCircle, RefreshCw, Download } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { collectGoogleAdsData, testGoogleAdsConnection } from '@/lib/googleAdsApi';
import { KeywordAnalyzer, QualityScoreAnalyzer } from '@/lib/googleAdsAnalyzer';
import { GoogleAdsRecommendationEngine } from '@/lib/googleAdsRecommendationEngine';
import GoogleAdsAnalysisView from './GoogleAdsAnalysisView';
import GoogleAdsRecommendations from './GoogleAdsRecommendations';

/**
 * GoogleAdsIntegration - Componente principal de integração
 */
export function GoogleAdsIntegration({ client }) {
  const [credentials, setCredentials] = useState({
    clientId: client.google_ads_client_id || '',
    clientSecret: client.google_ads_client_secret || '',
    developerToken: client.google_ads_developer_token || '',
    refreshToken: client.google_ads_refresh_token || '',
    customerId: client.google_ads_customer_id || '',
    loginCustomerId: client.google_ads_login_customer_id || '',
  });

  const [status, setStatus] = useState({
    collecting: false,
    analyzing: false,
    message: '',
    type: '', // success, error, info
  });

  const [lastSync, setLastSync] = useState(null);
  const [stats, setStats] = useState(null);

  const showStatus = (message, type = 'info') => {
    setStatus({ ...status, message, type });
    setTimeout(() => setStatus({ ...status, message: '', type: '' }), 5000);
  };

  const handleSaveCredentials = async () => {
    try {
      const { error } = await supabase
        .from('clients')
        .update({
          google_ads_client_id: credentials.clientId,
          google_ads_client_secret: credentials.clientSecret,
          google_ads_developer_token: credentials.developerToken,
          google_ads_refresh_token: credentials.refreshToken,
          google_ads_customer_id: credentials.customerId,
          google_ads_login_customer_id: credentials.loginCustomerId,
        })
        .eq('id', client.id);

      if (error) throw error;

      showStatus('Credenciais salvas com sucesso!', 'success');
    } catch (error) {
      console.error('Erro ao salvar credenciais:', error);
      showStatus('Erro ao salvar credenciais: ' + error.message, 'error');
    }
  };

  const handleConnectOAuth = async () => {
    try {
      setStatus({ ...status, message: 'Abrindo autorização do Google...', type: 'info' });

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) throw sessionError;
      if (!session?.access_token) throw new Error('Sessão expirada. Faça login novamente.');

      const baseUrl = import.meta.env.VITE_GOOGLE_ADS_NODE_URL || 'http://localhost:3001';
      const response = await fetch(
        `${baseUrl}/api/google-ads/oauth/start?clientId=${encodeURIComponent(client.id)}`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.url) {
        throw new Error(payload?.error || `Falha ao iniciar OAuth (HTTP ${response.status})`);
      }

      // Redireciona a aba atual (mais confiável do que popup)
      window.location.assign(payload.url);
    } catch (error) {
      console.error('Erro ao iniciar OAuth:', error);
      showStatus('Erro ao iniciar OAuth: ' + error.message, 'error');
    }
  };

  const handleCollectData = async () => {
    try {
      setStatus({ ...status, collecting: true, message: 'Coletando dados do Google Ads...' });

      const result = await collectGoogleAdsData({
        clientId: client.id,
        days: 30,
      });

      setLastSync(new Date());
      showStatus(
        `Coleta concluída! ${result.campaigns || 0} campanhas e ${result.keywords || 0} keywords.`,
        'success'
      );
      
      loadStats();

    } catch (error) {
      console.error('Erro ao coletar dados:', error);
      showStatus('Erro na coleta: ' + error.message, 'error');
    } finally {
      setStatus({ ...status, collecting: false, message: '' });
    }
  };

  const handleTestConnection = async () => {
    try {
      setStatus({ ...status, message: 'Testando conexão com Google Ads...', type: 'info' });
      const result = await testGoogleAdsConnection({ clientId: client.id });
      showStatus(
        `Conectado: ${result.customer?.name || result.customer?.id || 'OK'}`,
        'success'
      );
    } catch (error) {
      console.error('Erro ao testar conexão:', error);
      showStatus('Falha no teste: ' + error.message, 'error');
    }
  };

  const handleRunAnalysis = async () => {
    try {
      setStatus({ ...status, analyzing: true, message: 'Executando análise completa...' });

      // Buscar dados coletados
      const { data: keywords } = await supabase
        .from('google_ads_keywords')
        .select('*')
        .eq('client_id', client.id)
        .order('cost', { ascending: false });

      const { data: campaigns } = await supabase
        .from('google_ads_metrics')
        .select('*')
        .eq('client_id', client.id)
        .order('cost', { ascending: false });

      if (!keywords || keywords.length === 0) {
        throw new Error('Nenhum dado disponível. Execute a coleta primeiro.');
      }

      // Executar análises
      const keywordAnalyzer = new KeywordAnalyzer(keywords);
      const keywordAnalysis = keywordAnalyzer.analyzeAll();

      const qsAnalyzer = new QualityScoreAnalyzer(keywords);
      const qsAnalysis = qsAnalyzer.analyzeAll();

      // Calcular totais
      const totals = campaigns.reduce((acc, c) => ({
        impressions: acc.impressions + c.impressions,
        clicks: acc.clicks + c.clicks,
        cost: acc.cost + c.cost,
        conversions: acc.conversions + c.conversions,
        conversion_value: acc.conversion_value + c.conversion_value,
      }), { impressions: 0, clicks: 0, cost: 0, conversions: 0, conversion_value: 0 });

      // Salvar análise
      const { data: analysisData, error: analysisError } = await supabase
        .from('google_ads_analysis')
        .insert({
          client_id: client.id,
          date_range_start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          date_range_end: new Date(),
          total_campaigns: campaigns.length,
          total_keywords: keywords.length,
          avg_quality_score: qsAnalysis.overview.averageScore,
          keywords_below_avg: qsAnalysis.overview.belowAverage,
          total_impressions: totals.impressions,
          total_clicks: totals.clicks,
          total_cost: totals.cost,
          total_conversions: totals.conversions,
          total_conversion_value: totals.conversion_value,
          avg_ctr: totals.impressions > 0 ? totals.clicks / totals.impressions : 0,
          avg_cpc: totals.clicks > 0 ? totals.cost / totals.clicks : 0,
          avg_cpa: totals.conversions > 0 ? totals.cost / totals.conversions : 0,
          avg_roas: totals.cost > 0 ? totals.conversion_value / totals.cost : 0,
          low_performance_keywords: keywordAnalysis.performance.lowPerformers.length,
          wasteful_keywords: keywordAnalysis.wasteful.length,
          opportunity_keywords: keywordAnalysis.opportunities.length,
          keywords_analysis: keywordAnalysis,
          quality_score_analysis: qsAnalysis,
        })
        .select()
        .single();

      if (analysisError) throw analysisError;

      // Gerar recomendações
      const recommendationEngine = new GoogleAdsRecommendationEngine(
        campaigns,
        keywords,
        { keywords: keywordAnalysis, qualityScore: qsAnalysis }
      );

      const recommendations = recommendationEngine.generateAll();
      await recommendationEngine.saveToSupabase(analysisData.id, client.id);

      showStatus(
        `Análise concluída! ${recommendations.summary.total} recomendações geradas.`,
        'success'
      );
      
      loadStats();

    } catch (error) {
      console.error('Erro ao executar análise:', error);
      showStatus('Erro na análise: ' + error.message, 'error');
    } finally {
      setStatus({ ...status, analyzing: false, message: '' });
    }
  };

  const loadStats = async () => {
    try {
      const { data: analysis } = await supabase
        .from('google_ads_analysis')
        .select('*')
        .eq('client_id', client.id)
        .order('analyzed_at', { ascending: false })
        .limit(1)
        .single();

      const { data: recommendations } = await supabase
        .from('google_ads_recommendations')
        .select('id, priority')
        .eq('client_id', client.id)
        .eq('status', 'pending');

      setStats({
        lastAnalysis: analysis,
        pendingRecommendations: recommendations?.length || 0,
        highPriority: recommendations?.filter(r => r.priority === 'alta').length || 0,
      });

    } catch (error) {
      console.error('Erro ao carregar stats:', error);
    }
  };

  React.useEffect(() => {
    loadStats();
  }, [client.id]);

  const hasCredentials = credentials.clientId && credentials.clientSecret && 
                        credentials.developerToken && credentials.refreshToken && 
                        credentials.customerId;

  return (
    <div className="space-y-6">
      {/* Status Banner */}
      {status.message && (
        <Alert variant={status.type === 'error' ? 'destructive' : 'default'}>
          {status.type === 'success' && <CheckCircle2 className="h-4 w-4" />}
          {status.type === 'error' && <AlertCircle className="h-4 w-4" />}
          <AlertDescription>{status.message}</AlertDescription>
        </Alert>
      )}

      {/* Dashboard de Status */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Última Análise</CardTitle>
              <RefreshCw className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.lastAnalysis ? 
                  new Date(stats.lastAnalysis.analyzed_at).toLocaleDateString('pt-BR') : 
                  'Nunca'
                }
              </div>
              <p className="text-xs text-muted-foreground">
                {stats.lastAnalysis?.total_keywords || 0} keywords analisadas
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Recomendações Pendentes</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pendingRecommendations}</div>
              <p className="text-xs text-muted-foreground">
                {stats.highPriority} de alta prioridade
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Quality Score Médio</CardTitle>
              <Download className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.lastAnalysis?.avg_quality_score?.toFixed(1) || '-'}/10
              </div>
              <p className="text-xs text-muted-foreground">
                {stats.lastAnalysis?.keywords_below_avg || 0} abaixo da média
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs principais */}
      <Tabs defaultValue="setup" className="space-y-4">
        <TabsList>
          <TabsTrigger value="setup">Configuração</TabsTrigger>
          <TabsTrigger value="analysis">Análise</TabsTrigger>
          <TabsTrigger value="recommendations">Recomendações</TabsTrigger>
        </TabsList>

        {/* Setup */}
        <TabsContent value="setup" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Credenciais Google Ads API</CardTitle>
              <CardDescription>
                Configure as credenciais para conectar com a API do Google Ads
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Client ID</Label>
                  <Input
                    type="text"
                    value={credentials.clientId}
                    onChange={(e) => setCredentials({...credentials, clientId: e.target.value})}
                    placeholder="123456789.apps.googleusercontent.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Client Secret</Label>
                  <Input
                    type="password"
                    value={credentials.clientSecret}
                    onChange={(e) => setCredentials({...credentials, clientSecret: e.target.value})}
                    placeholder="GOCSPX-..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Developer Token</Label>
                  <Input
                    type="password"
                    value={credentials.developerToken}
                    onChange={(e) => setCredentials({...credentials, developerToken: e.target.value})}
                    placeholder="abcd1234..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Refresh Token</Label>
                  <Input
                    type="password"
                    value={credentials.refreshToken}
                    onChange={(e) => setCredentials({...credentials, refreshToken: e.target.value})}
                    placeholder="1//..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Customer ID</Label>
                  <Input
                    type="text"
                    value={credentials.customerId}
                    onChange={(e) => setCredentials({...credentials, customerId: e.target.value})}
                    placeholder="123-456-7890"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Login Customer ID (MCC - opcional)</Label>
                  <Input
                    type="text"
                    value={credentials.loginCustomerId}
                    onChange={(e) => setCredentials({...credentials, loginCustomerId: e.target.value})}
                    placeholder="987-654-3210"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleSaveCredentials}>
                  Salvar Credenciais
                </Button>
                <Button onClick={handleConnectOAuth} variant="outline">
                  Conectar via OAuth
                </Button>
                <Button onClick={handleTestConnection} variant="outline">
                  Testar Conexão
                </Button>
                {hasCredentials && (
                  <>
                    <Button 
                      onClick={handleCollectData} 
                      disabled={status.collecting}
                      variant="outline"
                    >
                      {status.collecting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Coletar Dados
                    </Button>
                    <Button 
                      onClick={handleRunAnalysis} 
                      disabled={status.analyzing}
                      variant="outline"
                    >
                      {status.analyzing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Executar Análise
                    </Button>
                  </>
                )}
              </div>

              {lastSync && (
                <p className="text-sm text-muted-foreground">
                  Última sincronização: {lastSync.toLocaleString('pt-BR')}
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analysis */}
        <TabsContent value="analysis">
          <GoogleAdsAnalysisView clientId={client.id} />
        </TabsContent>

        {/* Recommendations */}
        <TabsContent value="recommendations">
          <GoogleAdsRecommendations clientId={client.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default GoogleAdsIntegration;
