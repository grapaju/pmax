-- =====================================================
-- Permitir que o CLIENTE (login por email) também veja dados Google Ads
--
-- As tabelas google_ads_* usam client_id -> clients.id.
-- Hoje, as policies em muitos arquivos permitem apenas owner_id = auth.uid().
-- Este patch amplia SELECT para: owner_id = auth.uid() OR clients.email = auth.jwt()->>'email'
--
-- Rode este SQL no Supabase (SQL Editor) após as migrations.
-- =====================================================

-- google_ads_campaigns
DROP POLICY IF EXISTS "Users can view their own Google Ads campaigns" ON google_ads_campaigns;
CREATE POLICY "Users can view their own Google Ads campaigns"
  ON google_ads_campaigns FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM clients c
      WHERE c.id = google_ads_campaigns.client_id
        AND (c.owner_id = auth.uid() OR c.email = (auth.jwt() ->> 'email'))
    )
  );

-- google_ads_metrics
DROP POLICY IF EXISTS "Users can view their own Google Ads metrics" ON google_ads_metrics;
CREATE POLICY "Users can view their own Google Ads metrics"
  ON google_ads_metrics FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM clients c
      WHERE c.id = google_ads_metrics.client_id
        AND (c.owner_id = auth.uid() OR c.email = (auth.jwt() ->> 'email'))
    )
  );

-- google_ads_keywords
DROP POLICY IF EXISTS "Users can view their own Google Ads keywords" ON google_ads_keywords;
CREATE POLICY "Users can view their own Google Ads keywords"
  ON google_ads_keywords FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM clients c
      WHERE c.id = google_ads_keywords.client_id
        AND (c.owner_id = auth.uid() OR c.email = (auth.jwt() ->> 'email'))
    )
  );

-- google_ads_analysis
DROP POLICY IF EXISTS "Users can view their own Google Ads analysis" ON google_ads_analysis;
CREATE POLICY "Users can view their own Google Ads analysis"
  ON google_ads_analysis FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM clients c
      WHERE c.id = google_ads_analysis.client_id
        AND (c.owner_id = auth.uid() OR c.email = (auth.jwt() ->> 'email'))
    )
  );

-- google_ads_recommendations
DROP POLICY IF EXISTS "Users can view their own Google Ads recommendations" ON google_ads_recommendations;
CREATE POLICY "Users can view their own Google Ads recommendations"
  ON google_ads_recommendations FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM clients c
      WHERE c.id = google_ads_recommendations.client_id
        AND (c.owner_id = auth.uid() OR c.email = (auth.jwt() ->> 'email'))
    )
  );

-- google_ads_activity_log
DROP POLICY IF EXISTS "Users can view their own Google Ads activity log" ON google_ads_activity_log;
CREATE POLICY "Users can view their own Google Ads activity log"
  ON google_ads_activity_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM clients c
      WHERE c.id = google_ads_activity_log.client_id
        AND (c.owner_id = auth.uid() OR c.email = (auth.jwt() ->> 'email'))
    )
  );

-- Extras (se existirem): google_ads_assets / google_ads_ads
-- (Essas tabelas podem ter sido criadas em google-ads-extra-tables.sql)
DO $do$
BEGIN
  IF to_regclass('public.google_ads_assets') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Users can view their own Google Ads assets" ON google_ads_assets';
    EXECUTE $policy$
      CREATE POLICY "Users can view their own Google Ads assets"
        ON google_ads_assets FOR SELECT
        USING (
          EXISTS (
            SELECT 1 FROM clients c
            WHERE c.id = google_ads_assets.client_id
              AND (c.owner_id = auth.uid() OR c.email = (auth.jwt() ->> 'email'))
          )
        )
    $policy$;
  END IF;

  IF to_regclass('public.google_ads_ads') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Users can view their own Google Ads ads" ON google_ads_ads';
    EXECUTE $policy$
      CREATE POLICY "Users can view their own Google Ads ads"
        ON google_ads_ads FOR SELECT
        USING (
          EXISTS (
            SELECT 1 FROM clients c
            WHERE c.id = google_ads_ads.client_id
              AND (c.owner_id = auth.uid() OR c.email = (auth.jwt() ->> 'email'))
          )
        )
    $policy$;
  END IF;
END $do$;
