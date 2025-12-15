-- =====================================================
-- TABELAS PARA INTEGRAÇÃO GOOGLE ADS API
-- =====================================================

-- Tabela para armazenar métricas de campanhas coletadas da API
CREATE TABLE IF NOT EXISTS google_ads_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id TEXT NOT NULL,
  campaign_name TEXT NOT NULL,
  campaign_type TEXT,
  campaign_status TEXT,
  bidding_strategy TEXT,
  
  -- Período de coleta
  date_range_start DATE NOT NULL,
  date_range_end DATE NOT NULL,
  
  -- Métricas principais
  impressions BIGINT DEFAULT 0,
  clicks BIGINT DEFAULT 0,
  cost DECIMAL(12, 2) DEFAULT 0,
  conversions DECIMAL(10, 2) DEFAULT 0,
  conversion_value DECIMAL(12, 2) DEFAULT 0,
  
  -- Métricas calculadas
  ctr DECIMAL(5, 4) DEFAULT 0,
  avg_cpc DECIMAL(10, 2) DEFAULT 0,
  avg_cost DECIMAL(10, 2) DEFAULT 0,
  conversion_rate DECIMAL(5, 4) DEFAULT 0,
  cpa DECIMAL(10, 2) DEFAULT 0,
  roas DECIMAL(10, 2) DEFAULT 0,
  
  -- Metadados
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  collected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Índices para busca rápida
  CONSTRAINT unique_campaign_date_range UNIQUE (campaign_id, date_range_start, date_range_end, client_id)
);

CREATE INDEX idx_google_ads_metrics_campaign ON google_ads_metrics(campaign_id);
CREATE INDEX idx_google_ads_metrics_client ON google_ads_metrics(client_id);
CREATE INDEX idx_google_ads_metrics_date ON google_ads_metrics(date_range_start, date_range_end);
CREATE INDEX idx_google_ads_metrics_collected ON google_ads_metrics(collected_at DESC);

-- Tabela para armazenar palavras-chave e seus quality scores
CREATE TABLE IF NOT EXISTS google_ads_keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id TEXT NOT NULL,
  campaign_name TEXT,
  ad_group_id TEXT NOT NULL,
  ad_group_name TEXT,
  
  -- Dados da keyword
  keyword_text TEXT NOT NULL,
  match_type TEXT,
  status TEXT,
  cpc_bid DECIMAL(10, 2),
  
  -- Quality Score
  quality_score INTEGER,
  ad_relevance TEXT, -- ABOVE_AVERAGE, AVERAGE, BELOW_AVERAGE
  landing_page_experience TEXT,
  expected_ctr TEXT,
  
  -- Período de coleta
  date_range_start DATE NOT NULL,
  date_range_end DATE NOT NULL,
  
  -- Métricas
  impressions BIGINT DEFAULT 0,
  clicks BIGINT DEFAULT 0,
  cost DECIMAL(12, 2) DEFAULT 0,
  conversions DECIMAL(10, 2) DEFAULT 0,
  conversion_value DECIMAL(12, 2) DEFAULT 0,
  ctr DECIMAL(5, 4) DEFAULT 0,
  avg_cpc DECIMAL(10, 2) DEFAULT 0,
  cost_per_conversion DECIMAL(10, 2) DEFAULT 0,
  
  -- Metadados
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  collected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT unique_keyword_date_range UNIQUE (campaign_id, ad_group_id, keyword_text, match_type, date_range_start, date_range_end, client_id)
);

CREATE INDEX idx_google_ads_keywords_campaign ON google_ads_keywords(campaign_id);
CREATE INDEX idx_google_ads_keywords_ad_group ON google_ads_keywords(ad_group_id);
CREATE INDEX idx_google_ads_keywords_client ON google_ads_keywords(client_id);
CREATE INDEX idx_google_ads_keywords_quality ON google_ads_keywords(quality_score);
CREATE INDEX idx_google_ads_keywords_text ON google_ads_keywords(keyword_text);

-- Tabela para armazenar análises completas
CREATE TABLE IF NOT EXISTS google_ads_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  
  -- Período analisado
  date_range_start DATE NOT NULL,
  date_range_end DATE NOT NULL,
  
  -- Resumo da análise
  total_campaigns INTEGER DEFAULT 0,
  total_ad_groups INTEGER DEFAULT 0,
  total_keywords INTEGER DEFAULT 0,
  total_ads INTEGER DEFAULT 0,
  
  -- Quality Score médio
  avg_quality_score DECIMAL(3, 1),
  keywords_below_avg INTEGER DEFAULT 0,
  
  -- Performance geral
  total_impressions BIGINT DEFAULT 0,
  total_clicks BIGINT DEFAULT 0,
  total_cost DECIMAL(12, 2) DEFAULT 0,
  total_conversions DECIMAL(10, 2) DEFAULT 0,
  total_conversion_value DECIMAL(12, 2) DEFAULT 0,
  
  -- Métricas calculadas
  avg_ctr DECIMAL(5, 4) DEFAULT 0,
  avg_cpc DECIMAL(10, 2) DEFAULT 0,
  avg_cpa DECIMAL(10, 2) DEFAULT 0,
  avg_roas DECIMAL(10, 2) DEFAULT 0,
  
  -- Keywords com problemas
  low_performance_keywords INTEGER DEFAULT 0,
  wasteful_keywords INTEGER DEFAULT 0,
  opportunity_keywords INTEGER DEFAULT 0,
  
  -- Dados completos em JSON
  campaigns_data JSONB,
  keywords_analysis JSONB,
  quality_score_analysis JSONB,
  
  -- Metadados
  analyzed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_google_ads_analysis_client ON google_ads_analysis(client_id);
CREATE INDEX idx_google_ads_analysis_date ON google_ads_analysis(date_range_start, date_range_end);
CREATE INDEX idx_google_ads_analysis_analyzed ON google_ads_analysis(analyzed_at DESC);

-- Tabela para armazenar recomendações geradas
CREATE TABLE IF NOT EXISTS google_ads_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID REFERENCES google_ads_analysis(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  
  -- Tipo e prioridade
  type TEXT NOT NULL, -- otimizacao, correcao, prevencao, budget, keyword, ad, quality_score
  priority TEXT NOT NULL, -- alta, media, baixa
  category TEXT, -- keyword_performance, quality_score, budget_waste, etc
  
  -- Conteúdo da recomendação
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  impact TEXT, -- alto, medio, baixo
  estimated_impact_value DECIMAL(10, 2), -- estimativa em R$
  
  -- Ação recomendada
  action TEXT NOT NULL,
  action_type TEXT, -- pause_keyword, adjust_bid, add_negative, improve_ad, etc
  
  -- Dados relacionados
  campaign_id TEXT,
  ad_group_id TEXT,
  keyword_text TEXT,
  related_data JSONB,
  
  -- Status
  status TEXT DEFAULT 'pending', -- pending, in_progress, completed, dismissed
  completed_at TIMESTAMP WITH TIME ZONE,
  dismissed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  
  -- Metadados
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_google_ads_recommendations_analysis ON google_ads_recommendations(analysis_id);
CREATE INDEX idx_google_ads_recommendations_client ON google_ads_recommendations(client_id);
CREATE INDEX idx_google_ads_recommendations_priority ON google_ads_recommendations(priority);
CREATE INDEX idx_google_ads_recommendations_status ON google_ads_recommendations(status);
CREATE INDEX idx_google_ads_recommendations_type ON google_ads_recommendations(type);
CREATE INDEX idx_google_ads_recommendations_created ON google_ads_recommendations(created_at DESC);

-- Tabela para logs de atividades da API
CREATE TABLE IF NOT EXISTS google_ads_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  
  action TEXT NOT NULL, -- collect_metrics, run_analysis, generate_report, etc
  entity_type TEXT, -- campaign, keyword, ad_group, etc
  entity_id TEXT,
  
  status TEXT NOT NULL, -- success, error, warning
  message TEXT,
  error_details JSONB,
  
  duration_ms INTEGER,
  records_affected INTEGER,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_google_ads_activity_log_client ON google_ads_activity_log(client_id);
CREATE INDEX idx_google_ads_activity_log_action ON google_ads_activity_log(action);
CREATE INDEX idx_google_ads_activity_log_status ON google_ads_activity_log(status);
CREATE INDEX idx_google_ads_activity_log_created ON google_ads_activity_log(created_at DESC);

-- Triggers para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_google_ads_metrics_updated_at
  BEFORE UPDATE ON google_ads_metrics
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_google_ads_keywords_updated_at
  BEFORE UPDATE ON google_ads_keywords
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_google_ads_analysis_updated_at
  BEFORE UPDATE ON google_ads_analysis
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_google_ads_recommendations_updated_at
  BEFORE UPDATE ON google_ads_recommendations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Políticas RLS (Row Level Security)
ALTER TABLE google_ads_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_ads_keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_ads_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_ads_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_ads_activity_log ENABLE ROW LEVEL SECURITY;

-- Política para google_ads_metrics
CREATE POLICY "Users can view their own Google Ads metrics"
  ON google_ads_metrics FOR SELECT
  USING (auth.uid() IN (SELECT owner_id FROM clients WHERE id = google_ads_metrics.client_id));

CREATE POLICY "Users can insert their own Google Ads metrics"
  ON google_ads_metrics FOR INSERT
  WITH CHECK (auth.uid() IN (SELECT owner_id FROM clients WHERE id = google_ads_metrics.client_id));

-- Política para google_ads_keywords
CREATE POLICY "Users can view their own Google Ads keywords"
  ON google_ads_keywords FOR SELECT
  USING (auth.uid() IN (SELECT owner_id FROM clients WHERE id = google_ads_keywords.client_id));

CREATE POLICY "Users can insert their own Google Ads keywords"
  ON google_ads_keywords FOR INSERT
  WITH CHECK (auth.uid() IN (SELECT owner_id FROM clients WHERE id = google_ads_keywords.client_id));

-- Política para google_ads_analysis
CREATE POLICY "Users can view their own Google Ads analysis"
  ON google_ads_analysis FOR SELECT
  USING (auth.uid() IN (SELECT owner_id FROM clients WHERE id = google_ads_analysis.client_id));

CREATE POLICY "Users can insert their own Google Ads analysis"
  ON google_ads_analysis FOR INSERT
  WITH CHECK (auth.uid() IN (SELECT owner_id FROM clients WHERE id = google_ads_analysis.client_id));

-- Política para google_ads_recommendations
CREATE POLICY "Users can view their own Google Ads recommendations"
  ON google_ads_recommendations FOR SELECT
  USING (auth.uid() IN (SELECT owner_id FROM clients WHERE id = google_ads_recommendations.client_id));

CREATE POLICY "Users can manage their own Google Ads recommendations"
  ON google_ads_recommendations FOR ALL
  USING (auth.uid() IN (SELECT owner_id FROM clients WHERE id = google_ads_recommendations.client_id));

-- Política para google_ads_activity_log
CREATE POLICY "Users can view their own Google Ads activity log"
  ON google_ads_activity_log FOR SELECT
  USING (auth.uid() IN (SELECT owner_id FROM clients WHERE id = google_ads_activity_log.client_id));

CREATE POLICY "Users can insert their own Google Ads activity log"
  ON google_ads_activity_log FOR INSERT
  WITH CHECK (auth.uid() IN (SELECT owner_id FROM clients WHERE id = google_ads_activity_log.client_id));

-- Comentários nas tabelas
COMMENT ON TABLE google_ads_metrics IS 'Armazena métricas de campanhas coletadas da Google Ads API';
COMMENT ON TABLE google_ads_keywords IS 'Armazena palavras-chave com Quality Score e métricas da Google Ads API';
COMMENT ON TABLE google_ads_analysis IS 'Armazena análises completas de campanhas Google Ads';
COMMENT ON TABLE google_ads_recommendations IS 'Armazena recomendações automáticas de otimização';
COMMENT ON TABLE google_ads_activity_log IS 'Logs de atividades da integração com Google Ads API';
