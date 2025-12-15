-- =====================================================
-- TABELAS EXTRAS (Google Ads API) PARA EXPORT/RELATÓRIOS
-- Anúncios, Assets, Termos de Pesquisa, Públicos, Recomendações (API)
-- =====================================================

-- Anúncios (ad_group_ad)
CREATE TABLE IF NOT EXISTS google_ads_ads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,

  campaign_id TEXT,
  campaign_name TEXT,
  ad_group_id TEXT,
  ad_group_name TEXT,

  ad_id TEXT,
  ad_type TEXT,
  ad_status TEXT,

  date_range_start DATE,
  date_range_end DATE,

  impressions BIGINT DEFAULT 0,
  clicks BIGINT DEFAULT 0,
  cost DECIMAL(12, 2) DEFAULT 0,
  conversions DECIMAL(10, 2) DEFAULT 0,
  conversion_value DECIMAL(12, 2) DEFAULT 0,

  raw_json JSONB,

  collected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT unique_google_ads_ads UNIQUE (client_id, campaign_id, ad_group_id, ad_id, date_range_start, date_range_end)
);

CREATE INDEX IF NOT EXISTS idx_google_ads_ads_client ON google_ads_ads(client_id);
CREATE INDEX IF NOT EXISTS idx_google_ads_ads_campaign ON google_ads_ads(campaign_id);
CREATE INDEX IF NOT EXISTS idx_google_ads_ads_ad_group ON google_ads_ads(ad_group_id);

-- Assets / Asset Groups (asset_group_asset + asset)
CREATE TABLE IF NOT EXISTS google_ads_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,

  campaign_id TEXT,
  campaign_name TEXT,
  asset_group_id TEXT,
  asset_group_name TEXT,

  asset_id TEXT,
  asset_resource_name TEXT,
  asset_type TEXT,

  field_type TEXT,
  performance_label TEXT,

  date_range_start DATE,
  date_range_end DATE,

  impressions BIGINT DEFAULT 0,
  clicks BIGINT DEFAULT 0,
  cost DECIMAL(12, 2) DEFAULT 0,
  conversions DECIMAL(10, 2) DEFAULT 0,
  conversion_value DECIMAL(12, 2) DEFAULT 0,

  raw_json JSONB,

  collected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT unique_google_ads_assets UNIQUE (client_id, campaign_id, asset_group_id, asset_resource_name, field_type, date_range_start, date_range_end)
);

CREATE INDEX IF NOT EXISTS idx_google_ads_assets_client ON google_ads_assets(client_id);
CREATE INDEX IF NOT EXISTS idx_google_ads_assets_campaign ON google_ads_assets(campaign_id);
CREATE INDEX IF NOT EXISTS idx_google_ads_assets_asset_group ON google_ads_assets(asset_group_id);

-- Termos de pesquisa (search_term_view)
CREATE TABLE IF NOT EXISTS google_ads_search_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,

  campaign_id TEXT,
  campaign_name TEXT,
  ad_group_id TEXT,
  ad_group_name TEXT,

  search_term TEXT,

  date_range_start DATE,
  date_range_end DATE,

  impressions BIGINT DEFAULT 0,
  clicks BIGINT DEFAULT 0,
  cost DECIMAL(12, 2) DEFAULT 0,
  conversions DECIMAL(10, 2) DEFAULT 0,
  conversion_value DECIMAL(12, 2) DEFAULT 0,

  raw_json JSONB,

  collected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT unique_google_ads_search_terms UNIQUE (client_id, campaign_id, ad_group_id, search_term, date_range_start, date_range_end)
);

CREATE INDEX IF NOT EXISTS idx_google_ads_search_terms_client ON google_ads_search_terms(client_id);
CREATE INDEX IF NOT EXISTS idx_google_ads_search_terms_campaign ON google_ads_search_terms(campaign_id);

-- Públicos (simplificado: user_list)
CREATE TABLE IF NOT EXISTS google_ads_audiences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,

  user_list_id TEXT,
  user_list_name TEXT,
  user_list_description TEXT,
  user_list_status TEXT,

  raw_json JSONB,

  collected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT unique_google_ads_audiences UNIQUE (client_id, user_list_id)
);

CREATE INDEX IF NOT EXISTS idx_google_ads_audiences_client ON google_ads_audiences(client_id);

-- Recomendações da API (recommendation)
CREATE TABLE IF NOT EXISTS google_ads_api_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,

  recommendation_resource_name TEXT,
  recommendation_type TEXT,
  dismissed BOOLEAN,
  campaign_id TEXT,

  raw_json JSONB,

  collected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT unique_google_ads_api_recommendations UNIQUE (client_id, recommendation_resource_name)
);

CREATE INDEX IF NOT EXISTS idx_google_ads_api_recommendations_client ON google_ads_api_recommendations(client_id);
CREATE INDEX IF NOT EXISTS idx_google_ads_api_recommendations_campaign ON google_ads_api_recommendations(campaign_id);

-- RLS (mesma regra de owner via tabela clients)
ALTER TABLE google_ads_ads ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_ads_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_ads_search_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_ads_audiences ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_ads_api_recommendations ENABLE ROW LEVEL SECURITY;

-- OBS: Postgres/Supabase não suporta CREATE POLICY IF NOT EXISTS.
-- Para permitir reexecutar essa migration com segurança, fazemos DROP POLICY IF EXISTS e recriamos.

DROP POLICY IF EXISTS "Users can view their own Google Ads ads" ON google_ads_ads;
CREATE POLICY "Users can view their own Google Ads ads"
  ON google_ads_ads FOR SELECT
  USING (auth.uid() IN (SELECT owner_id FROM clients WHERE id = google_ads_ads.client_id));

DROP POLICY IF EXISTS "Users can insert their own Google Ads ads" ON google_ads_ads;
CREATE POLICY "Users can insert their own Google Ads ads"
  ON google_ads_ads FOR INSERT
  WITH CHECK (auth.uid() IN (SELECT owner_id FROM clients WHERE id = google_ads_ads.client_id));

DROP POLICY IF EXISTS "Users can view their own Google Ads assets" ON google_ads_assets;
CREATE POLICY "Users can view their own Google Ads assets"
  ON google_ads_assets FOR SELECT
  USING (auth.uid() IN (SELECT owner_id FROM clients WHERE id = google_ads_assets.client_id));

DROP POLICY IF EXISTS "Users can insert their own Google Ads assets" ON google_ads_assets;
CREATE POLICY "Users can insert their own Google Ads assets"
  ON google_ads_assets FOR INSERT
  WITH CHECK (auth.uid() IN (SELECT owner_id FROM clients WHERE id = google_ads_assets.client_id));

DROP POLICY IF EXISTS "Users can view their own Google Ads search terms" ON google_ads_search_terms;
CREATE POLICY "Users can view their own Google Ads search terms"
  ON google_ads_search_terms FOR SELECT
  USING (auth.uid() IN (SELECT owner_id FROM clients WHERE id = google_ads_search_terms.client_id));

DROP POLICY IF EXISTS "Users can insert their own Google Ads search terms" ON google_ads_search_terms;
CREATE POLICY "Users can insert their own Google Ads search terms"
  ON google_ads_search_terms FOR INSERT
  WITH CHECK (auth.uid() IN (SELECT owner_id FROM clients WHERE id = google_ads_search_terms.client_id));

DROP POLICY IF EXISTS "Users can view their own Google Ads audiences" ON google_ads_audiences;
CREATE POLICY "Users can view their own Google Ads audiences"
  ON google_ads_audiences FOR SELECT
  USING (auth.uid() IN (SELECT owner_id FROM clients WHERE id = google_ads_audiences.client_id));

DROP POLICY IF EXISTS "Users can insert their own Google Ads audiences" ON google_ads_audiences;
CREATE POLICY "Users can insert their own Google Ads audiences"
  ON google_ads_audiences FOR INSERT
  WITH CHECK (auth.uid() IN (SELECT owner_id FROM clients WHERE id = google_ads_audiences.client_id));

DROP POLICY IF EXISTS "Users can view their own Google Ads API recommendations" ON google_ads_api_recommendations;
CREATE POLICY "Users can view their own Google Ads API recommendations"
  ON google_ads_api_recommendations FOR SELECT
  USING (auth.uid() IN (SELECT owner_id FROM clients WHERE id = google_ads_api_recommendations.client_id));

DROP POLICY IF EXISTS "Users can insert their own Google Ads API recommendations" ON google_ads_api_recommendations;
CREATE POLICY "Users can insert their own Google Ads API recommendations"
  ON google_ads_api_recommendations FOR INSERT
  WITH CHECK (auth.uid() IN (SELECT owner_id FROM clients WHERE id = google_ads_api_recommendations.client_id));

-- Triggers updated_at (requer função update_updated_at_column já existente)
DROP TRIGGER IF EXISTS update_google_ads_ads_updated_at ON google_ads_ads;
CREATE TRIGGER update_google_ads_ads_updated_at
  BEFORE UPDATE ON google_ads_ads
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_google_ads_assets_updated_at ON google_ads_assets;
CREATE TRIGGER update_google_ads_assets_updated_at
  BEFORE UPDATE ON google_ads_assets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_google_ads_search_terms_updated_at ON google_ads_search_terms;
CREATE TRIGGER update_google_ads_search_terms_updated_at
  BEFORE UPDATE ON google_ads_search_terms
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_google_ads_audiences_updated_at ON google_ads_audiences;
CREATE TRIGGER update_google_ads_audiences_updated_at
  BEFORE UPDATE ON google_ads_audiences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_google_ads_api_recommendations_updated_at ON google_ads_api_recommendations;
CREATE TRIGGER update_google_ads_api_recommendations_updated_at
  BEFORE UPDATE ON google_ads_api_recommendations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
