import express from 'express';
import { requireImportKey } from '../middleware/requireImportKey.js';

function toIsoNow() {
  return new Date().toISOString();
}

function isUuid(v) {
  return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function parseNumber(value) {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  let s = raw
    .replace(/\u00A0/g, ' ')
    .replace(/[%]/g, '')
    .replace(/\s/g, '')
    .replace(/[R$€£]/gi, '')
    .replace(/(BRL|USD|EUR|GBP)/gi, '')
    .replace(/[^0-9,\.\-]/g, '');

  if (!s) return null;

  const hasComma = s.includes(',');
  const hasDot = s.includes('.');

  if (hasComma && hasDot) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(/,/g, '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (hasComma && !hasDot) {
    s = s.replace(/,/g, '.');
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function parseDate(value) {
  if (!value) return null;
  const s = String(value).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) {
    const dd = m[1].padStart(2, '0');
    const mm = m[2].padStart(2, '0');
    const yyyy = m[3];
    return `${yyyy}-${mm}-${dd}`;
  }
  return null;
}

function getHeadersFromRows(rows) {
  const set = new Set();
  for (const r of rows) {
    if (!r || typeof r !== 'object') continue;
    for (const k of Object.keys(r)) set.add(k);
  }
  return Array.from(set);
}

function pick(obj, keys) {
  for (const k of keys) {
    if (obj?.[k] !== undefined && obj?.[k] !== null && String(obj[k]).trim() !== '') return obj[k];
  }
  return null;
}

function mapMetricsRow(row, { fallbackStart, fallbackEnd, fallbackCampaignId }) {
  const date = parseDate(pick(row, ['date', 'day', 'data', 'dia']));
  const start = date || fallbackStart;
  const end = date || fallbackEnd;

  const campaignId = String(pick(row, ['campaign_id', 'campaignId', 'id_campanha', 'campaign']) || fallbackCampaignId || '').trim();
  const campaignName = String(pick(row, ['campaign_name', 'campaignName', 'campanha', 'campaign']) || '').trim();

  if (!campaignId || !campaignName || !start || !end) {
    return { ok: false, reason: 'missing_required_fields' };
  }

  const impressions = parseNumber(pick(row, ['impressions', 'impressoes', 'impressões'])) ?? 0;
  const clicks = parseNumber(pick(row, ['clicks', 'cliques'])) ?? 0;
  const cost = parseNumber(pick(row, ['cost', 'custo', 'spend', 'gasto'])) ?? 0;
  const conversions = parseNumber(pick(row, ['conversions', 'conversoes', 'conversões'])) ?? 0;
  const conversionValue = parseNumber(pick(row, ['conversion_value', 'conversionValue', 'valor_conversao', 'valor de conversao', 'valor de conversão'])) ?? 0;

  // No schema (DECIMAL(5,4)), CTR e conversion_rate são armazenados como fração (0..1), não em % (0..100).
  const ctr = impressions > 0 ? clicks / impressions : 0;
  const avgCpc = clicks > 0 ? cost / clicks : 0;
  const conversionRate = clicks > 0 ? conversions / clicks : 0;
  const cpa = conversions > 0 ? cost / conversions : 0;
  const roas = cost > 0 ? conversionValue / cost : 0;

  return {
    ok: true,
    value: {
      campaign_id: campaignId,
      campaign_name: campaignName,
      date_range_start: start,
      date_range_end: end,
      impressions: Math.round(impressions),
      clicks: Math.round(clicks),
      cost,
      conversions,
      conversion_value: conversionValue,
      ctr,
      avg_cpc: avgCpc,
      conversion_rate: conversionRate,
      cpa,
      roas,
    },
  };
}

function mapAdsRow(row, { fallbackStart, fallbackEnd, fallbackCampaignId, fallbackCampaignName }) {
  const date = parseDate(pick(row, ['date', 'day', 'data', 'dia']));
  const start = date || fallbackStart;
  const end = date || fallbackEnd;

  const campaignId = String(pick(row, ['campaign_id', 'campaignId', 'campaign']) || fallbackCampaignId || '').trim();
  const campaignName = String(pick(row, ['campaign_name', 'campaignName', 'campanha', 'campaign']) || fallbackCampaignName || '').trim();

  const adGroupId = String(pick(row, ['ad_group_id', 'adGroupId', 'ad_group']) || '').trim();
  const adGroupName = String(pick(row, ['ad_group_name', 'adGroupName', 'ad_group']) || '').trim();

  const adId = String(pick(row, ['ad_id', 'adId', 'id_anuncio', 'anuncio_id']) || '').trim();
  const adType = pick(row, ['ad_type', 'adType', 'tipo_anuncio', 'tipo de anuncio']);
  const adStatus = pick(row, ['ad_status', 'adStatus', 'status']);

  if (!campaignId || !campaignName || !adGroupId || !adId || !start || !end) {
    return { ok: false, reason: 'missing_required_fields' };
  }

  const impressions = parseNumber(pick(row, ['impressions', 'impressoes', 'impressões'])) ?? 0;
  const clicks = parseNumber(pick(row, ['clicks', 'cliques'])) ?? 0;
  const cost = parseNumber(pick(row, ['cost', 'custo', 'spend', 'gasto'])) ?? 0;
  const conversions = parseNumber(pick(row, ['conversions', 'conversoes', 'conversões'])) ?? 0;
  const conversionValue = parseNumber(pick(row, ['conversion_value', 'conversionValue', 'valor_conversao', 'valor de conversao', 'valor de conversão'])) ?? 0;

  return {
    ok: true,
    value: {
      campaign_id: campaignId,
      campaign_name: campaignName,
      ad_group_id: adGroupId,
      ad_group_name: adGroupName || null,
      ad_id: adId,
      ad_type: adType ? String(adType).trim() : null,
      ad_status: adStatus ? String(adStatus).trim() : null,
      date_range_start: start,
      date_range_end: end,
      impressions: Math.round(impressions),
      clicks: Math.round(clicks),
      cost,
      conversions,
      conversion_value: conversionValue,
      raw_json: row,
    },
  };
}

function mapCampaignRow(row) {
  const campaignId = String(pick(row, ['campaign_id', 'campaignId', 'id_campanha', 'id da campanha', 'campaign']) || '').trim();
  const campaignName = String(pick(row, ['campaign_name', 'campaignName', 'nome_campanha', 'nome da campanha', 'campanha', 'campaign']) || '').trim();
  const campaignType = pick(row, ['campaign_type', 'campaignType', 'tipo_campanha', 'tipo da campanha', 'type']);
  const campaignStatus = pick(row, ['campaign_status', 'campaignStatus', 'status_campanha', 'status da campanha', 'status']);
  const channelType = pick(row, ['advertising_channel_type', 'advertisingChannelType', 'channel_type', 'canal', 'channel']);

  if (!campaignId || !campaignName) {
    return { ok: false, reason: 'missing_required_fields' };
  }

  return {
    ok: true,
    value: {
      campaign_id: campaignId,
      campaign_name: campaignName,
      campaign_type: campaignType ? String(campaignType).trim() : null,
      campaign_status: campaignStatus ? String(campaignStatus).trim() : null,
      advertising_channel_type: channelType ? String(channelType).trim() : null,
      raw_json: row,
    },
  };
}

function mapAssetsRow(row, { fallbackStart, fallbackEnd, fallbackCampaignId, fallbackCampaignName }) {
  const date = parseDate(pick(row, ['date', 'day', 'data', 'dia']));
  const start = date || fallbackStart;
  const end = date || fallbackEnd;

  const campaignId = String(pick(row, ['campaign_id', 'campaignId', 'campaign']) || fallbackCampaignId || '').trim();
  const campaignName = String(pick(row, ['campaign_name', 'campaignName', 'campanha', 'campaign']) || fallbackCampaignName || '').trim();

  const assetGroupId = String(pick(row, ['asset_group_id', 'assetGroupId', 'id_asset_group', 'asset group id', 'asset_group']) || '').trim();
  const assetGroupName = pick(row, ['asset_group_name', 'assetGroupName', 'nome_asset_group', 'asset group']);

  const assetResourceName = String(pick(row, ['asset_resource_name', 'assetResourceName', 'asset', 'asset resource name']) || '').trim();
  const assetId = pick(row, ['asset_id', 'assetId']);
  const assetType = pick(row, ['asset_type', 'assetType', 'tipo_asset', 'type']);
  const fieldType = pick(row, ['field_type', 'fieldType', 'campo', 'field']);
  const performanceLabel = pick(row, ['performance_label', 'performanceLabel', 'performance']);

  if (!campaignId || !campaignName || !assetGroupId || !assetResourceName || !start || !end) {
    return { ok: false, reason: 'missing_required_fields' };
  }

  const impressions = parseNumber(pick(row, ['impressions', 'impressoes', 'impressões'])) ?? 0;
  const clicks = parseNumber(pick(row, ['clicks', 'cliques'])) ?? 0;
  const cost = parseNumber(pick(row, ['cost', 'custo', 'spend', 'gasto'])) ?? 0;
  const conversions = parseNumber(pick(row, ['conversions', 'conversoes', 'conversões'])) ?? 0;
  const conversionValue = parseNumber(pick(row, ['conversion_value', 'conversionValue', 'valor_conversao', 'valor de conversao', 'valor de conversão'])) ?? 0;

  return {
    ok: true,
    value: {
      campaign_id: campaignId,
      campaign_name: campaignName,
      asset_group_id: assetGroupId,
      asset_group_name: assetGroupName ? String(assetGroupName).trim() : null,
      asset_id: assetId ? String(assetId).trim() : null,
      asset_resource_name: assetResourceName,
      asset_type: assetType ? String(assetType).trim() : null,
      field_type: fieldType ? String(fieldType).trim() : null,
      performance_label: performanceLabel ? String(performanceLabel).trim() : null,
      date_range_start: start,
      date_range_end: end,
      impressions: Math.round(impressions),
      clicks: Math.round(clicks),
      cost,
      conversions,
      conversion_value: conversionValue,
      raw_json: row,
    },
  };
}

function mapPmaxSearchTermInsightRow(row, { fallbackStart, fallbackEnd, fallbackCampaignId, fallbackCampaignName }) {
  const date = parseDate(pick(row, ['date', 'day', 'data', 'dia']));
  const start = date || fallbackStart;
  const end = date || fallbackEnd;

  const campaignId = String(pick(row, ['campaign_id', 'campaignId', 'campaign']) || fallbackCampaignId || '').trim();
  const campaignName = String(pick(row, ['campaign_name', 'campaignName', 'campanha', 'campaign']) || fallbackCampaignName || '').trim();
  const categoryLabel = pick(row, ['category_label', 'categoryLabel', 'categoria', 'category']);

  if (!campaignId || !campaignName || !categoryLabel || !start || !end) {
    return { ok: false, reason: 'missing_required_fields' };
  }

  const impressions = parseNumber(pick(row, ['impressions', 'impressoes', 'impressões'])) ?? 0;
  const clicks = parseNumber(pick(row, ['clicks', 'cliques'])) ?? 0;
  const cost = parseNumber(pick(row, ['cost', 'custo', 'spend', 'gasto'])) ?? 0;
  const conversions = parseNumber(pick(row, ['conversions', 'conversoes', 'conversões'])) ?? 0;
  const conversionValue = parseNumber(pick(row, ['conversion_value', 'conversionValue', 'valor_conversao', 'valor de conversao', 'valor de conversão'])) ?? 0;

  return {
    ok: true,
    value: {
      campaign_id: campaignId,
      campaign_name: campaignName,
      category_label: String(categoryLabel).trim(),
      date_range_start: start,
      date_range_end: end,
      impressions: Math.round(impressions),
      clicks: Math.round(clicks),
      cost,
      conversions,
      conversion_value: conversionValue,
      raw_json: row,
    },
  };
}

function mapPmaxShoppingRow(row, { fallbackStart, fallbackEnd, fallbackCampaignId, fallbackCampaignName }) {
  const date = parseDate(pick(row, ['date', 'day', 'data', 'dia']));
  const start = date || fallbackStart;
  const end = date || fallbackEnd;

  const campaignId = String(pick(row, ['campaign_id', 'campaignId', 'campaign']) || fallbackCampaignId || '').trim();
  const campaignName = String(pick(row, ['campaign_name', 'campaignName', 'campanha', 'campaign']) || fallbackCampaignName || '').trim();

  const productItemId = pick(row, ['product_item_id', 'productItemId', 'item_id', 'offer_id', 'offerId']);
  const productTitle = pick(row, ['product_title', 'productTitle', 'title']);
  const productBrand = pick(row, ['product_brand', 'productBrand', 'brand']);
  const productTypeL1 = pick(row, ['product_type_l1', 'productTypeL1', 'product_type', 'productType']);

  // Pelo menos uma dimensão do feed precisa existir, senão não tem utilidade.
  const hasDim = Boolean(
    (productItemId && String(productItemId).trim()) ||
    (productTitle && String(productTitle).trim()) ||
    (productBrand && String(productBrand).trim()) ||
    (productTypeL1 && String(productTypeL1).trim())
  );

  if (!campaignId || !campaignName || !hasDim || !start || !end) {
    return { ok: false, reason: 'missing_required_fields' };
  }

  const impressions = parseNumber(pick(row, ['impressions', 'impressoes', 'impressões'])) ?? 0;
  const clicks = parseNumber(pick(row, ['clicks', 'cliques'])) ?? 0;
  const cost = parseNumber(pick(row, ['cost', 'custo', 'spend', 'gasto'])) ?? 0;
  const conversions = parseNumber(pick(row, ['conversions', 'conversoes', 'conversões'])) ?? 0;
  const conversionValue = parseNumber(pick(row, ['conversion_value', 'conversionValue', 'valor_conversao', 'valor de conversao', 'valor de conversão'])) ?? 0;

  return {
    ok: true,
    value: {
      campaign_id: campaignId,
      campaign_name: campaignName,
      product_item_id: productItemId ? String(productItemId).trim() : null,
      product_title: productTitle ? String(productTitle).trim() : null,
      product_brand: productBrand ? String(productBrand).trim() : null,
      product_type_l1: productTypeL1 ? String(productTypeL1).trim() : null,
      date_range_start: start,
      date_range_end: end,
      impressions: Math.round(impressions),
      clicks: Math.round(clicks),
      cost,
      conversions,
      conversion_value: conversionValue,
      raw_json: row,
    },
  };
}

function mapPmaxAudienceSignalRow(row, { fallbackStart, fallbackEnd, fallbackCampaignId, fallbackCampaignName }) {
  const date = parseDate(pick(row, ['date', 'day', 'data', 'dia']));
  const start = date || fallbackStart;
  const end = date || fallbackEnd;

  const campaignId = String(pick(row, ['campaign_id', 'campaignId', 'campaign']) || fallbackCampaignId || '').trim();
  const campaignName = String(pick(row, ['campaign_name', 'campaignName', 'campanha', 'campaign']) || fallbackCampaignName || '').trim();
  const assetGroupId = String(pick(row, ['asset_group_id', 'assetGroupId', 'asset_group']) || '').trim();
  const assetGroupName = pick(row, ['asset_group_name', 'assetGroupName', 'asset_group_name']);
  const signalType = pick(row, ['signal_type', 'signalType', 'type']);
  const signalValue = pick(row, ['signal_value', 'signalValue', 'value']);

  if (!campaignId || !campaignName || !assetGroupId || !start || !end) {
    return { ok: false, reason: 'missing_required_fields' };
  }

  return {
    ok: true,
    value: {
      campaign_id: campaignId,
      campaign_name: campaignName,
      asset_group_id: assetGroupId,
      asset_group_name: assetGroupName ? String(assetGroupName).trim() : null,
      signal_type: signalType ? String(signalType).trim() : null,
      signal_value: signalValue ? String(signalValue).trim() : null,
      date_range_start: start,
      date_range_end: end,
      raw_json: row,
    },
  };
}

export function createGoogleAdsScriptIngestRouter({ supabase }) {
  const router = express.Router();

  // Scripts podem mandar payload grande
  router.use(express.json({ limit: '25mb' }));
  router.use(requireImportKey);

  // POST /api/google-ads/script-ingest/bulk
  // Body (JSON):
  // {
  //   clientId: "uuid",
  //   mccCustomerId?: "123-456-7890",
  //   accountCustomerId?: "123-456-7890",
  //   scriptName?: "PMax Bulk Export",
  //   reportName?: "PMax - Metrics",
  //   start?: "YYYY-MM-DD",
  //   end?: "YYYY-MM-DD",
  //   campaignId?: "...",
  //   campaignName?: "...",
  //   campaignsRows?: Array<object>,
  //   metricsRows?: Array<object>,
  //   adsRows?: Array<object>,
  //   assetsRows?: Array<object>
  // }
  router.post('/bulk', async (req, res) => {
    const startedAt = Date.now();

    try {
      const clientId = String(req.body?.clientId || '').trim();
      if (!isUuid(clientId)) {
        return res.status(400).json({ error: 'clientId (UUID) é obrigatório', code: 'CLIENT_ID_REQUIRED' });
      }

      const reportName = req.body?.reportName ? String(req.body.reportName).trim() : null;
      const mccCustomerId = req.body?.mccCustomerId ? String(req.body.mccCustomerId).trim() : null;
      const accountCustomerId = req.body?.accountCustomerId ? String(req.body.accountCustomerId).trim() : null;
      const scriptName = req.body?.scriptName ? String(req.body.scriptName).trim() : null;
      const start = req.body?.start ? parseDate(req.body.start) : null;
      const end = req.body?.end ? parseDate(req.body.end) : null;
      const campaignId = req.body?.campaignId ? String(req.body.campaignId).trim() : null;
      const campaignName = req.body?.campaignName ? String(req.body.campaignName).trim() : null;

      const campaignsRows = Array.isArray(req.body?.campaignsRows) ? req.body.campaignsRows : [];
      const metricsRows = Array.isArray(req.body?.metricsRows) ? req.body.metricsRows : [];
      const adsRows = Array.isArray(req.body?.adsRows) ? req.body.adsRows : [];
      const assetsRows = Array.isArray(req.body?.assetsRows) ? req.body.assetsRows : [];
      const searchTermInsightsRows = Array.isArray(req.body?.searchTermInsightsRows) ? req.body.searchTermInsightsRows : [];
      const shoppingRows = Array.isArray(req.body?.shoppingRows) ? req.body.shoppingRows : [];
      const audienceSignalsRows = Array.isArray(req.body?.audienceSignalsRows) ? req.body.audienceSignalsRows : [];

      if (
        campaignsRows.length === 0 &&
        metricsRows.length === 0 &&
        adsRows.length === 0 &&
        assetsRows.length === 0 &&
        searchTermInsightsRows.length === 0 &&
        shoppingRows.length === 0 &&
        audienceSignalsRows.length === 0
      ) {
        return res.status(400).json({
          error: 'Envie campaignsRows, metricsRows, adsRows, assetsRows e/ou novos datasets (searchTermInsightsRows, shoppingRows, audienceSignalsRows)',
          code: 'NO_ROWS',
        });
      }

      const nowIso = toIsoNow();

      // 1) Salva bruto (rastreamento/auditoria)
      const rawRows = [
        ...campaignsRows.map((r) => ({ ...r, __kind: 'campaigns' })),
        ...metricsRows.map((r) => ({ ...r, __kind: 'metrics' })),
        ...adsRows.map((r) => ({ ...r, __kind: 'ads' })),
        ...assetsRows.map((r) => ({ ...r, __kind: 'assets' })),
        ...searchTermInsightsRows.map((r) => ({ ...r, __kind: 'pmax_search_term_insights' })),
        ...shoppingRows.map((r) => ({ ...r, __kind: 'pmax_shopping' })),
        ...audienceSignalsRows.map((r) => ({ ...r, __kind: 'pmax_audience_signals' })),
      ];
      const headers = getHeadersFromRows(rawRows);

      const { data: importInserted, error: importError } = await supabase
        .from('google_ads_raw_imports')
        .insert([
          {
            client_id: clientId,
            source: 'google_ads_script',
            report_name: reportName || scriptName,
            file_name: null,
            campaign_id: campaignId,
            date_range_start: start,
            date_range_end: end,
            encoding: 'json',
            delimiter: null,
            headers,
            row_count: rawRows.length,
            applied_summary: {
              meta: {
                mccCustomerId,
                accountCustomerId,
                scriptName,
              },
            },
          },
        ])
        .select('id')
        .single();

      if (importError) {
        return res.status(409).json({
          error: 'Tabela de import bruto não existe ou sem permissão. Rode a migration google-ads-raw-imports.sql',
          code: 'RAW_IMPORT_TABLE_MISSING',
          details: importError.message || importError,
        });
      }

      const importId = importInserted.id;

      // rows
      const chunkSize = 500;
      for (let offset = 0; offset < rawRows.length; offset += chunkSize) {
        const chunk = rawRows.slice(offset, offset + chunkSize);
        const payload = chunk.map((row, idx) => ({
          import_id: importId,
          client_id: clientId,
          row_index: offset + idx + 1,
          row_json: row,
        }));

        const { error } = await supabase.from('google_ads_raw_import_rows').insert(payload);
        if (error) {
          await supabase
            .from('google_ads_raw_imports')
            .update({ applied_at: nowIso, applied_status: 'error', applied_error: error.message || String(error) })
            .eq('id', importId);

          return res.status(500).json({
            error: 'Falha ao salvar linhas brutas',
            code: 'RAW_ROWS_INSERT_FAILED',
            details: error.message || error,
            importId,
          });
        }
      }

      // 2) Aplica (sync) para tabelas
      const applySummary = {
        campaigns: { received: campaignsRows.length, mapped: 0, upserted: 0, skipped: 0 },
        metrics: { received: metricsRows.length, mapped: 0, upserted: 0, skipped: 0 },
        ads: { received: adsRows.length, mapped: 0, upserted: 0, skipped: 0 },
        assets: { received: assetsRows.length, mapped: 0, upserted: 0, skipped: 0 },
        pmaxSearchTermInsights: { received: searchTermInsightsRows.length, mapped: 0, upserted: 0, skipped: 0 },
        pmaxShopping: { received: shoppingRows.length, mapped: 0, upserted: 0, skipped: 0 },
        pmaxAudienceSignals: { received: audienceSignalsRows.length, mapped: 0, upserted: 0, skipped: 0 },
        warnings: [],
      };

      if (!start || !end) {
        applySummary.warnings.push('Sem start/end. Se linhas não tiverem date/dia, algumas serão ignoradas.');
      }

      // campaigns
      const campaignsUpserts = [];
      for (const r of campaignsRows) {
        const mapped = mapCampaignRow(r);
        if (!mapped.ok) {
          applySummary.campaigns.skipped++;
          continue;
        }
        applySummary.campaigns.mapped++;
        campaignsUpserts.push({ ...mapped.value, client_id: clientId, collected_at: nowIso });
      }

      // metrics
      const metricsUpserts = [];
      for (const r of metricsRows) {
        const mapped = mapMetricsRow(r, { fallbackStart: start, fallbackEnd: end, fallbackCampaignId: campaignId });
        if (!mapped.ok) {
          applySummary.metrics.skipped++;
          continue;
        }
        applySummary.metrics.mapped++;
        metricsUpserts.push({ ...mapped.value, client_id: clientId, collected_at: nowIso });
      }

      // ads
      const adsUpserts = [];
      for (const r of adsRows) {
        const mapped = mapAdsRow(r, {
          fallbackStart: start,
          fallbackEnd: end,
          fallbackCampaignId: campaignId,
          fallbackCampaignName: campaignName,
        });
        if (!mapped.ok) {
          applySummary.ads.skipped++;
          continue;
        }
        applySummary.ads.mapped++;
        adsUpserts.push({ ...mapped.value, client_id: clientId, collected_at: nowIso });
      }

      // assets (PMax)
      const assetsUpserts = [];
      for (const r of assetsRows) {
        const mapped = mapAssetsRow(r, {
          fallbackStart: start,
          fallbackEnd: end,
          fallbackCampaignId: campaignId,
          fallbackCampaignName: campaignName,
        });
        if (!mapped.ok) {
          applySummary.assets.skipped++;
          continue;
        }
        applySummary.assets.mapped++;
        assetsUpserts.push({ ...mapped.value, client_id: clientId, collected_at: nowIso });
      }

      // search term insights (PMax)
      const pmaxSearchTermInsightsUpserts = [];
      for (const r of searchTermInsightsRows) {
        const mapped = mapPmaxSearchTermInsightRow(r, {
          fallbackStart: start,
          fallbackEnd: end,
          fallbackCampaignId: campaignId,
          fallbackCampaignName: campaignName,
        });
        if (!mapped.ok) {
          applySummary.pmaxSearchTermInsights.skipped++;
          continue;
        }
        applySummary.pmaxSearchTermInsights.mapped++;
        pmaxSearchTermInsightsUpserts.push({ ...mapped.value, client_id: clientId, collected_at: nowIso });
      }

      // shopping performance (PMax)
      const pmaxShoppingUpserts = [];
      for (const r of shoppingRows) {
        const mapped = mapPmaxShoppingRow(r, {
          fallbackStart: start,
          fallbackEnd: end,
          fallbackCampaignId: campaignId,
          fallbackCampaignName: campaignName,
        });
        if (!mapped.ok) {
          applySummary.pmaxShopping.skipped++;
          continue;
        }
        applySummary.pmaxShopping.mapped++;
        pmaxShoppingUpserts.push({ ...mapped.value, client_id: clientId, collected_at: nowIso });
      }

      // audience signals (PMax)
      const pmaxAudienceSignalsUpserts = [];
      for (const r of audienceSignalsRows) {
        const mapped = mapPmaxAudienceSignalRow(r, {
          fallbackStart: start,
          fallbackEnd: end,
          fallbackCampaignId: campaignId,
          fallbackCampaignName: campaignName,
        });
        if (!mapped.ok) {
          applySummary.pmaxAudienceSignals.skipped++;
          continue;
        }
        applySummary.pmaxAudienceSignals.mapped++;
        pmaxAudienceSignalsUpserts.push({ ...mapped.value, client_id: clientId, collected_at: nowIso });
      }

      let status = 'success';
      let errorMessage = null;
      const appliedTables = [];

      try {
        if (campaignsUpserts.length > 0) {
          const chunkSize2 = 500;
          for (let offset = 0; offset < campaignsUpserts.length; offset += chunkSize2) {
            const chunk = campaignsUpserts.slice(offset, offset + chunkSize2);
            const { error } = await supabase
              .from('google_ads_campaigns')
              .upsert(chunk, { onConflict: 'client_id,campaign_id' });
            if (error) throw error;
            applySummary.campaigns.upserted += chunk.length;
          }
          appliedTables.push('google_ads_campaigns');
        }

        if (metricsUpserts.length > 0) {
          const chunkSize2 = 500;
          for (let offset = 0; offset < metricsUpserts.length; offset += chunkSize2) {
            const chunk = metricsUpserts.slice(offset, offset + chunkSize2);
            const { error } = await supabase
              .from('google_ads_metrics')
              .upsert(chunk, { onConflict: 'campaign_id,date_range_start,date_range_end,client_id' });
            if (error) throw error;
            applySummary.metrics.upserted += chunk.length;
          }
          appliedTables.push('google_ads_metrics');
        }

        if (adsUpserts.length > 0) {
          const chunkSize2 = 500;
          for (let offset = 0; offset < adsUpserts.length; offset += chunkSize2) {
            const chunk = adsUpserts.slice(offset, offset + chunkSize2);
            const { error } = await supabase
              .from('google_ads_ads')
              .upsert(chunk, { onConflict: 'client_id,campaign_id,ad_group_id,ad_id,date_range_start,date_range_end' });
            if (error) throw error;
            applySummary.ads.upserted += chunk.length;
          }
          appliedTables.push('google_ads_ads');
        }

        if (assetsUpserts.length > 0) {
          const chunkSize2 = 500;
          for (let offset = 0; offset < assetsUpserts.length; offset += chunkSize2) {
            const chunk = assetsUpserts.slice(offset, offset + chunkSize2);
            const { error } = await supabase
              .from('google_ads_assets')
              .upsert(chunk, { onConflict: 'client_id,campaign_id,asset_group_id,asset_resource_name,field_type,date_range_start,date_range_end' });
            if (error) throw error;
            applySummary.assets.upserted += chunk.length;
          }
          appliedTables.push('google_ads_assets');
        }

        if (pmaxSearchTermInsightsUpserts.length > 0) {
          const chunkSize2 = 500;
          for (let offset = 0; offset < pmaxSearchTermInsightsUpserts.length; offset += chunkSize2) {
            const chunk = pmaxSearchTermInsightsUpserts.slice(offset, offset + chunkSize2);
            const { error } = await supabase
              .from('google_ads_pmax_search_term_insights')
              .upsert(chunk, { onConflict: 'client_id,campaign_id,category_label,date_range_start,date_range_end' });
            if (error) throw error;
            applySummary.pmaxSearchTermInsights.upserted += chunk.length;
          }
          appliedTables.push('google_ads_pmax_search_term_insights');
        }

        if (pmaxShoppingUpserts.length > 0) {
          const chunkSize2 = 500;
          for (let offset = 0; offset < pmaxShoppingUpserts.length; offset += chunkSize2) {
            const chunk = pmaxShoppingUpserts.slice(offset, offset + chunkSize2);
            const { error } = await supabase
              .from('google_ads_pmax_shopping_performance')
              .upsert(chunk, { onConflict: 'client_id,campaign_id,product_item_id,product_title,product_brand,product_type_l1,date_range_start,date_range_end' });
            if (error) throw error;
            applySummary.pmaxShopping.upserted += chunk.length;
          }
          appliedTables.push('google_ads_pmax_shopping_performance');
        }

        if (pmaxAudienceSignalsUpserts.length > 0) {
          const chunkSize2 = 500;
          for (let offset = 0; offset < pmaxAudienceSignalsUpserts.length; offset += chunkSize2) {
            const chunk = pmaxAudienceSignalsUpserts.slice(offset, offset + chunkSize2);
            const { error } = await supabase
              .from('google_ads_pmax_audience_signals')
              .upsert(chunk, { onConflict: 'client_id,campaign_id,asset_group_id,signal_type,signal_value,date_range_start,date_range_end' });
            if (error) throw error;
            applySummary.pmaxAudienceSignals.upserted += chunk.length;
          }
          appliedTables.push('google_ads_pmax_audience_signals');
        }
      } catch (err) {
        status = 'error';
        errorMessage = err?.message || String(err);
      }

      await supabase
        .from('google_ads_raw_imports')
        .update({
          applied_at: nowIso,
          applied_tables: appliedTables,
          applied_status: status,
          applied_summary: applySummary,
          applied_error: errorMessage,
        })
        .eq('id', importId);

      await supabase.from('google_ads_activity_log').insert([
        {
          client_id: clientId,
          action: 'script_ingest',
          entity_type: 'bulk',
          entity_id: importId,
          status,
          message: status === 'success'
            ? `Script ingest OK (campaigns=${applySummary.campaigns.upserted}, metrics=${applySummary.metrics.upserted}, ads=${applySummary.ads.upserted}, assets=${applySummary.assets.upserted})`
            : `Script ingest falhou: ${errorMessage}`,
          error_details: errorMessage ? { error: errorMessage, applySummary } : { applySummary },
          duration_ms: Date.now() - startedAt,
          records_affected:
            (applySummary.campaigns.upserted || 0) +
            (applySummary.metrics.upserted || 0) +
            (applySummary.ads.upserted || 0) +
            (applySummary.assets.upserted || 0) +
            (applySummary.pmaxSearchTermInsights.upserted || 0) +
            (applySummary.pmaxShopping.upserted || 0) +
            (applySummary.pmaxAudienceSignals.upserted || 0),
        },
      ]);

      if (status !== 'success') {
        return res.status(500).json({
          error: 'Ingest recebido, mas falhou ao aplicar em tabelas',
          code: 'APPLY_FAILED',
          importId,
          applySummary,
          details: errorMessage,
        });
      }

      return res.json({
        ok: true,
        importId,
        appliedAt: nowIso,
        appliedTables,
        applySummary,
      });
    } catch (err) {
      return res.status(500).json({
        error: 'Erro inesperado no ingest',
        code: 'SCRIPT_INGEST_ERROR',
        details: err?.message || String(err),
      });
    }
  });

  return router;
}
