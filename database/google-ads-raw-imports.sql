-- =====================================================
-- IMPORTAÇÃO MANUAL (DADOS BRUTOS) DO GOOGLE ADS (CSV)
-- Objetivo: permitir importar CSVs exportados do UI do Google Ads
-- sem depender da API, preservando colunas/linhas como vierem.
-- =====================================================

CREATE TABLE IF NOT EXISTS google_ads_raw_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,

  source TEXT NOT NULL DEFAULT 'google_ads_ui',
  report_name TEXT,
  file_name TEXT,

  campaign_id TEXT,
  date_range_start DATE,
  date_range_end DATE,

  encoding TEXT,
  delimiter TEXT,

  headers TEXT[] NOT NULL,
  row_count INTEGER NOT NULL DEFAULT 0,

  applied_at TIMESTAMP WITH TIME ZONE,
  applied_tables TEXT[] DEFAULT '{}'::TEXT[],
  applied_status TEXT,
  applied_summary JSONB,
  applied_error TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_google_ads_raw_imports_client ON google_ads_raw_imports(client_id);
CREATE INDEX IF NOT EXISTS idx_google_ads_raw_imports_created ON google_ads_raw_imports(created_at DESC);

CREATE TABLE IF NOT EXISTS google_ads_raw_import_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id UUID REFERENCES google_ads_raw_imports(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,

  row_index INTEGER NOT NULL,
  row_json JSONB NOT NULL,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT unique_google_ads_raw_import_row UNIQUE (import_id, row_index)
);

CREATE INDEX IF NOT EXISTS idx_google_ads_raw_import_rows_import ON google_ads_raw_import_rows(import_id);
CREATE INDEX IF NOT EXISTS idx_google_ads_raw_import_rows_client ON google_ads_raw_import_rows(client_id);

-- RLS (mesma regra de owner via tabela clients)
ALTER TABLE google_ads_raw_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_ads_raw_import_rows ENABLE ROW LEVEL SECURITY;

-- OBS: Postgres/Supabase não suporta CREATE POLICY IF NOT EXISTS.
-- Para permitir reexecutar essa migration com segurança, fazemos DROP POLICY IF EXISTS e recriamos.

DROP POLICY IF EXISTS "Users can view their own Google Ads raw imports" ON google_ads_raw_imports;
CREATE POLICY "Users can view their own Google Ads raw imports"
  ON google_ads_raw_imports FOR SELECT
  USING (auth.uid() IN (SELECT owner_id FROM clients WHERE id = google_ads_raw_imports.client_id));

DROP POLICY IF EXISTS "Users can insert their own Google Ads raw imports" ON google_ads_raw_imports;
CREATE POLICY "Users can insert their own Google Ads raw imports"
  ON google_ads_raw_imports FOR INSERT
  WITH CHECK (auth.uid() IN (SELECT owner_id FROM clients WHERE id = google_ads_raw_imports.client_id));

DROP POLICY IF EXISTS "Users can view their own Google Ads raw import rows" ON google_ads_raw_import_rows;
CREATE POLICY "Users can view their own Google Ads raw import rows"
  ON google_ads_raw_import_rows FOR SELECT
  USING (auth.uid() IN (SELECT owner_id FROM clients WHERE id = google_ads_raw_import_rows.client_id));

DROP POLICY IF EXISTS "Users can insert their own Google Ads raw import rows" ON google_ads_raw_import_rows;
CREATE POLICY "Users can insert their own Google Ads raw import rows"
  ON google_ads_raw_import_rows FOR INSERT
  WITH CHECK (auth.uid() IN (SELECT owner_id FROM clients WHERE id = google_ads_raw_import_rows.client_id));

-- Trigger updated_at (requer função update_updated_at_column já existente)
DROP TRIGGER IF EXISTS update_google_ads_raw_imports_updated_at ON google_ads_raw_imports;
CREATE TRIGGER update_google_ads_raw_imports_updated_at
  BEFORE UPDATE ON google_ads_raw_imports
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Backfill seguro (caso a tabela já exista sem as colunas acima)
ALTER TABLE google_ads_raw_imports
  ADD COLUMN IF NOT EXISTS applied_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE google_ads_raw_imports
  ADD COLUMN IF NOT EXISTS applied_tables TEXT[] DEFAULT '{}'::TEXT[];

ALTER TABLE google_ads_raw_imports
  ADD COLUMN IF NOT EXISTS applied_status TEXT;

ALTER TABLE google_ads_raw_imports
  ADD COLUMN IF NOT EXISTS applied_summary JSONB;

ALTER TABLE google_ads_raw_imports
  ADD COLUMN IF NOT EXISTS applied_error TEXT;
