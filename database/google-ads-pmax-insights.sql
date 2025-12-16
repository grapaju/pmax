-- =====================================================
-- PMax (via Google Ads Scripts) - Insights adicionais
-- - Search Term Insights (categorias)
-- - Shopping Performance (proxy de listing groups / feed)
-- - Audience Signals (quando disponível)
-- =====================================================

-- Search Term Insights (PMax): categorias (não são termos exatos)
CREATE TABLE IF NOT EXISTS google_ads_pmax_search_term_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,

  campaign_id TEXT NOT NULL,
  campaign_name TEXT NOT NULL,

  category_label TEXT NOT NULL,

  date_range_start DATE NOT NULL,
  date_range_end DATE NOT NULL,

  impressions BIGINT DEFAULT 0,
  clicks BIGINT DEFAULT 0,
  cost DECIMAL(12, 2) DEFAULT 0,
  conversions DECIMAL(10, 2) DEFAULT 0,
  conversion_value DECIMAL(12, 2) DEFAULT 0,

  raw_json JSONB,

  collected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT unique_google_ads_pmax_search_term_insights UNIQUE (
    client_id,
    campaign_id,
    category_label,
    date_range_start,
    date_range_end
  )
);

CREATE INDEX IF NOT EXISTS idx_google_ads_pmax_sti_client ON google_ads_pmax_search_term_insights(client_id);
CREATE INDEX IF NOT EXISTS idx_google_ads_pmax_sti_campaign ON google_ads_pmax_search_term_insights(campaign_id);

-- Shopping performance (PMax): dimensões do feed/itens (quando disponível)
CREATE TABLE IF NOT EXISTS google_ads_pmax_shopping_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,

  campaign_id TEXT NOT NULL,
  campaign_name TEXT NOT NULL,

  product_item_id TEXT,
  product_title TEXT,
  product_brand TEXT,
  product_type_l1 TEXT,

  date_range_start DATE NOT NULL,
  date_range_end DATE NOT NULL,

  impressions BIGINT DEFAULT 0,
  clicks BIGINT DEFAULT 0,
  cost DECIMAL(12, 2) DEFAULT 0,
  conversions DECIMAL(10, 2) DEFAULT 0,
  conversion_value DECIMAL(12, 2) DEFAULT 0,

  raw_json JSONB,

  collected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT unique_google_ads_pmax_shopping_performance UNIQUE (
    client_id,
    campaign_id,
    product_item_id,
    product_title,
    product_brand,
    product_type_l1,
    date_range_start,
    date_range_end
  )
);

CREATE INDEX IF NOT EXISTS idx_google_ads_pmax_shop_client ON google_ads_pmax_shopping_performance(client_id);
CREATE INDEX IF NOT EXISTS idx_google_ads_pmax_shop_campaign ON google_ads_pmax_shopping_performance(campaign_id);

-- Audience signals por Asset Group (quando o GAQL expõe)
CREATE TABLE IF NOT EXISTS google_ads_pmax_audience_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,

  campaign_id TEXT NOT NULL,
  campaign_name TEXT NOT NULL,

  asset_group_id TEXT NOT NULL,
  asset_group_name TEXT,

  signal_type TEXT,
  signal_value TEXT,

  date_range_start DATE NOT NULL,
  date_range_end DATE NOT NULL,

  raw_json JSONB,

  collected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT unique_google_ads_pmax_audience_signals UNIQUE (
    client_id,
    campaign_id,
    asset_group_id,
    signal_type,
    signal_value,
    date_range_start,
    date_range_end
  )
);

CREATE INDEX IF NOT EXISTS idx_google_ads_pmax_signals_client ON google_ads_pmax_audience_signals(client_id);
CREATE INDEX IF NOT EXISTS idx_google_ads_pmax_signals_campaign ON google_ads_pmax_audience_signals(campaign_id);
CREATE INDEX IF NOT EXISTS idx_google_ads_pmax_signals_asset_group ON google_ads_pmax_audience_signals(asset_group_id);

-- RLS
ALTER TABLE google_ads_pmax_search_term_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_ads_pmax_shopping_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_ads_pmax_audience_signals ENABLE ROW LEVEL SECURITY;

-- Policies (mesma regra de owner via clients)
DROP POLICY IF EXISTS "Users can view their own Google Ads PMax search term insights" ON google_ads_pmax_search_term_insights;
CREATE POLICY "Users can view their own Google Ads PMax search term insights"
  ON google_ads_pmax_search_term_insights FOR SELECT
  USING (auth.uid() IN (SELECT owner_id FROM clients WHERE id = google_ads_pmax_search_term_insights.client_id));

DROP POLICY IF EXISTS "Users can insert their own Google Ads PMax search term insights" ON google_ads_pmax_search_term_insights;
CREATE POLICY "Users can insert their own Google Ads PMax search term insights"
  ON google_ads_pmax_search_term_insights FOR INSERT
  WITH CHECK (auth.uid() IN (SELECT owner_id FROM clients WHERE id = google_ads_pmax_search_term_insights.client_id));

DROP POLICY IF EXISTS "Users can view their own Google Ads PMax shopping performance" ON google_ads_pmax_shopping_performance;
CREATE POLICY "Users can view their own Google Ads PMax shopping performance"
  ON google_ads_pmax_shopping_performance FOR SELECT
  USING (auth.uid() IN (SELECT owner_id FROM clients WHERE id = google_ads_pmax_shopping_performance.client_id));

DROP POLICY IF EXISTS "Users can insert their own Google Ads PMax shopping performance" ON google_ads_pmax_shopping_performance;
CREATE POLICY "Users can insert their own Google Ads PMax shopping performance"
  ON google_ads_pmax_shopping_performance FOR INSERT
  WITH CHECK (auth.uid() IN (SELECT owner_id FROM clients WHERE id = google_ads_pmax_shopping_performance.client_id));

DROP POLICY IF EXISTS "Users can view their own Google Ads PMax audience signals" ON google_ads_pmax_audience_signals;
CREATE POLICY "Users can view their own Google Ads PMax audience signals"
  ON google_ads_pmax_audience_signals FOR SELECT
  USING (auth.uid() IN (SELECT owner_id FROM clients WHERE id = google_ads_pmax_audience_signals.client_id));

DROP POLICY IF EXISTS "Users can insert their own Google Ads PMax audience signals" ON google_ads_pmax_audience_signals;
CREATE POLICY "Users can insert their own Google Ads PMax audience signals"
  ON google_ads_pmax_audience_signals FOR INSERT
  WITH CHECK (auth.uid() IN (SELECT owner_id FROM clients WHERE id = google_ads_pmax_audience_signals.client_id));

-- Triggers updated_at (requer função update_updated_at_column já existente)
DROP TRIGGER IF EXISTS update_google_ads_pmax_sti_updated_at ON google_ads_pmax_search_term_insights;
CREATE TRIGGER update_google_ads_pmax_sti_updated_at
  BEFORE UPDATE ON google_ads_pmax_search_term_insights
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_google_ads_pmax_shop_updated_at ON google_ads_pmax_shopping_performance;
CREATE TRIGGER update_google_ads_pmax_shop_updated_at
  BEFORE UPDATE ON google_ads_pmax_shopping_performance
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_google_ads_pmax_signals_updated_at ON google_ads_pmax_audience_signals;
CREATE TRIGGER update_google_ads_pmax_signals_updated_at
  BEFORE UPDATE ON google_ads_pmax_audience_signals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
