-- =====================================================
-- CAMPANHAS (metadados) - útil para ingestão via Scripts/UI
-- =====================================================

CREATE TABLE IF NOT EXISTS google_ads_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,

  campaign_id TEXT NOT NULL,
  campaign_name TEXT NOT NULL,
  campaign_type TEXT,
  campaign_status TEXT,
  advertising_channel_type TEXT,

  raw_json JSONB,

  collected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT unique_google_ads_campaigns UNIQUE (client_id, campaign_id)
);

CREATE INDEX IF NOT EXISTS idx_google_ads_campaigns_client ON google_ads_campaigns(client_id);
CREATE INDEX IF NOT EXISTS idx_google_ads_campaigns_campaign ON google_ads_campaigns(campaign_id);
CREATE INDEX IF NOT EXISTS idx_google_ads_campaigns_collected ON google_ads_campaigns(collected_at DESC);

-- RLS (mesma regra de owner via tabela clients)
ALTER TABLE google_ads_campaigns ENABLE ROW LEVEL SECURITY;

-- OBS: Postgres/Supabase não suporta CREATE POLICY IF NOT EXISTS.
-- Para permitir reexecutar essa migration com segurança, fazemos DROP POLICY IF EXISTS e recriamos.

DROP POLICY IF EXISTS "Users can view their own Google Ads campaigns" ON google_ads_campaigns;
CREATE POLICY "Users can view their own Google Ads campaigns"
  ON google_ads_campaigns FOR SELECT
  USING (auth.uid() IN (SELECT owner_id FROM clients WHERE id = google_ads_campaigns.client_id));

DROP POLICY IF EXISTS "Users can insert their own Google Ads campaigns" ON google_ads_campaigns;
CREATE POLICY "Users can insert their own Google Ads campaigns"
  ON google_ads_campaigns FOR INSERT
  WITH CHECK (auth.uid() IN (SELECT owner_id FROM clients WHERE id = google_ads_campaigns.client_id));

DROP POLICY IF EXISTS "Users can update their own Google Ads campaigns" ON google_ads_campaigns;
CREATE POLICY "Users can update their own Google Ads campaigns"
  ON google_ads_campaigns FOR UPDATE
  USING (auth.uid() IN (SELECT owner_id FROM clients WHERE id = google_ads_campaigns.client_id))
  WITH CHECK (auth.uid() IN (SELECT owner_id FROM clients WHERE id = google_ads_campaigns.client_id));

-- Triggers updated_at (requer função update_updated_at_column já existente)
DROP TRIGGER IF EXISTS update_google_ads_campaigns_updated_at ON google_ads_campaigns;
CREATE TRIGGER update_google_ads_campaigns_updated_at
  BEFORE UPDATE ON google_ads_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
