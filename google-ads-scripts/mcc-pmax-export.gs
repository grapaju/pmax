/**
 * MCC → Gerenciador PMax (Render)
 * Envia:
 * - campaignsRows (metadados)
 * - metricsRows (métricas diárias)
 * - assetsRows (PMax assets/asset groups)
 * - adsRows (se existir no account)
 *
 * Requer no backend:
 * - GOOGLE_ADS_SCRIPT_IMPORT_KEY configurado no Render
 *
 * IMPORTANTE: este arquivo deve ser colado no editor do Google Ads Scripts.
 */

// =====================
// CONFIG
// =====================

var ENDPOINT_URL = 'https://pmax.onrender.com/api/google-ads/script-ingest/bulk';

// Cole aqui o mesmo valor do Render (GOOGLE_ADS_SCRIPT_IMPORT_KEY)
// ⚠️ Não commite chaves reais no GitHub.
var IMPORT_KEY = 'COLE_SEU_IMPORT_KEY_AQUI';

// UUID do cliente (tabela `clients` no Supabase)
var SUPABASE_CLIENT_ID = 'COLE_O_UUID_DO_CLIENTE_AQUI';

// Customer ID da conta (pode ser com hífens). Ex: 123-456-7890
var ACCOUNT_CUSTOMER_ID = '123-456-7890';

// Nome do script (vai para auditoria)
var SCRIPT_NAME = 'mcc-pmax-export';

// Data range
// Opções simples:
// - 'YESTERDAY'
// - 'LAST_7_DAYS'
// - 'LAST_30_DAYS'
// - 'CUSTOM' (usa START_DATE/END_DATE abaixo)
var DATE_MODE = 'LAST_30_DAYS';

// Usado apenas quando DATE_MODE = 'CUSTOM'
var START_DATE = '2025-11-15'; // YYYY-MM-DD
var END_DATE = '2025-12-14';   // YYYY-MM-DD

// Tamanho de lote por request (centenas → 200 é bem seguro)
var CHUNK_SIZE = 200;

// Se true, não envia para o endpoint (só loga contagens)
var DRY_RUN = false;

// Se true, loga o JSON de resposta do backend quando o POST for 2xx
// (útil para depurar se o backend realmente aplicou/upsertou nas tabelas).
var LOG_SUCCESS_RESPONSES = true;


// =====================
// MAIN
// =====================

function main() {
  validateConfig_();

  var account = selectAccount_(ACCOUNT_CUSTOMER_ID);
  Logger.log('Conta selecionada: ' + account.getCustomerId() + ' / ' + account.getName());

  var range = resolveDateRange_();
  Logger.log('Período: ' + range.start + ' → ' + range.end);

  var campaignsRows = fetchCampaigns_();
  Logger.log('campaignsRows=' + campaignsRows.length);
  logCampaignsDebug_(campaignsRows);

  var metricsRows = fetchPmaxMetrics_(range);
  Logger.log('metricsRows=' + metricsRows.length);

  var assetsRows = fetchPmaxAssets_(range);
  Logger.log('assetsRows=' + assetsRows.length);

  var searchTermInsightsRows = fetchPmaxSearchTermInsights_(range, campaignsRows);
  Logger.log('searchTermInsightsRows=' + searchTermInsightsRows.length);

  var shoppingRows = fetchPmaxShoppingPerformance_(range);
  Logger.log('shoppingRows=' + shoppingRows.length);

  var audienceSignalsRows = fetchPmaxAudienceSignals_(range);
  Logger.log('audienceSignalsRows=' + audienceSignalsRows.length);

  var adsRows = fetchAds_(range);
  Logger.log('adsRows=' + adsRows.length);

  if (DRY_RUN) {
    Logger.log('DRY_RUN=true; não enviando.');
    return;
  }

  // Envio em lotes: prioriza métricas e assets (PMax)
  postInChunks_(buildBasePayload_('PMax Campaigns', range, campaignsRows));

  postRowsChunked_('PMax Metrics', range, campaignsRows, 'metricsRows', metricsRows);
  postRowsChunked_('PMax Assets', range, campaignsRows, 'assetsRows', assetsRows);

  // Novos datasets (Visão Geral)
  postRowsChunked_('PMax Search Term Insights', range, campaignsRows, 'searchTermInsightsRows', searchTermInsightsRows);
  postRowsChunked_('PMax Shopping Performance', range, campaignsRows, 'shoppingRows', shoppingRows);
  postRowsChunked_('PMax Audience Signals', range, campaignsRows, 'audienceSignalsRows', audienceSignalsRows);

  postRowsChunked_('Ads (all)', range, campaignsRows, 'adsRows', adsRows);
}

function logCampaignsDebug_(campaignsRows) {
  if (!campaignsRows || campaignsRows.length === 0) return;

  var pmax = [];
  for (var i = 0; i < campaignsRows.length; i++) {
    var c = campaignsRows[i];
    if (String(c.advertising_channel_type || '') === 'PERFORMANCE_MAX') pmax.push(c);
  }

  Logger.log('Campanhas (amostra):');
  for (var j = 0; j < Math.min(10, campaignsRows.length); j++) {
    var cc = campaignsRows[j];
    Logger.log(' - ' + cc.campaign_id + ' | ' + cc.campaign_status + ' | ' + cc.advertising_channel_type + ' | ' + (cc.campaign_type || '') + ' | ' + cc.campaign_name);
  }
  Logger.log('PMax detectadas=' + pmax.length);
}

function buildBasePayload_(reportName, range, campaignsRows) {
  return {
    clientId: SUPABASE_CLIENT_ID,
    mccCustomerId: AdsManagerApp && AdsManagerApp.currentAccount && AdsManagerApp.currentAccount().getCustomerId ? String(AdsManagerApp.currentAccount().getCustomerId()) : null,
    accountCustomerId: AdsApp.currentAccount().getCustomerId ? String(AdsApp.currentAccount().getCustomerId()) : normalizeCustomerId_(ACCOUNT_CUSTOMER_ID),
    scriptName: SCRIPT_NAME,
    reportName: reportName,
    start: range.start,
    end: range.end,
    campaignsRows: campaignsRows || [],
    metricsRows: [],
    adsRows: [],
    assetsRows: [],
  };
}


// =====================
// SELECT ACCOUNT (MCC)
// =====================

function normalizeCustomerId_(s) {
  return String(s || '').replace(/\D/g, '');
}

function hyphenateCustomerId_(cid) {
  var s = normalizeCustomerId_(cid);
  if (s.length === 10) return s.slice(0, 3) + '-' + s.slice(3, 6) + '-' + s.slice(6);
  return s;
}

function uniq_(arr) {
  var seen = {};
  var out = [];
  for (var i = 0; i < arr.length; i++) {
    var v = String(arr[i] || '');
    if (!v) continue;
    if (seen[v]) continue;
    seen[v] = true;
    out.push(v);
  }
  return out;
}

function listAccessibleAccounts_(limit) {
  var out = [];
  var it = MccApp.accounts().get();
  while (it.hasNext()) {
    var a = it.next();
    var id;
    try {
      id = String(a.getCustomerId());
    } catch (e) {
      id = '';
    }

    out.push({ id: id, name: a.getName ? String(a.getName()) : '' });
    if (limit && out.length >= limit) break;
  }
  return out;
}

function selectAccount_(customerId) {
  if (typeof MccApp === 'undefined' || !MccApp.accounts) {
    throw new Error('MccApp não está disponível. Confirme que este script está sendo executado em uma conta de administrador (MCC).');
  }

  var cidNorm = normalizeCustomerId_(customerId);
  if (!cidNorm) throw new Error('ACCOUNT_CUSTOMER_ID inválido');

  // Alguns ambientes aceitam IDs com ou sem hífens; tenta ambos.
  var candidates = uniq_([cidNorm, hyphenateCustomerId_(cidNorm)]);
  for (var i = 0; i < candidates.length; i++) {
    var cid = candidates[i];
    var it = MccApp.accounts().withIds([cid]).get();
    if (it.hasNext()) {
      var direct = it.next();
      MccApp.select(direct);
      return direct;
    }
  }

  // Fallback: varre todas as contas acessíveis e compara por normalização.
  var allIt = MccApp.accounts().get();
  while (allIt.hasNext()) {
    var a = allIt.next();
    var aCid;
    try {
      aCid = String(a.getCustomerId());
    } catch (e) {
      aCid = '';
    }

    if (normalizeCustomerId_(aCid) === cidNorm) {
      MccApp.select(a);
      return a;
    }
  }

  var sample = listAccessibleAccounts_(30);
  var lines = [];
  for (var j = 0; j < sample.length; j++) {
    lines.push('- ' + (sample[j].id || '(sem id)') + ' | ' + (sample[j].name || ''));
  }

  throw new Error(
    'Não encontrei a conta no MCC com customerId=' + customerId +
    ' (normalizado=' + cidNorm + ').\n' +
    'Possíveis causas: (1) a conta não está vinculada a este MCC, (2) você está rodando o script em outro MCC/sub-MCC, (3) falta permissão.\n' +
    'Amostra de contas acessíveis neste MCC (até 30):\n' + lines.join('\n')
  );
}


// =====================
// DATE RANGE
// =====================

function formatDate_(d) {
  var yyyy = d.getFullYear();
  var mm = String(d.getMonth() + 1);
  var dd = String(d.getDate());
  if (mm.length < 2) mm = '0' + mm;
  if (dd.length < 2) dd = '0' + dd;
  return yyyy + '-' + mm + '-' + dd;
}

function addDays_(d, days) {
  var nd = new Date(d.getTime());
  nd.setDate(nd.getDate() + days);
  return nd;
}

function resolveDateRange_() {
  if (DATE_MODE === 'CUSTOM') {
    return { start: START_DATE, end: END_DATE };
  }

  var today = new Date();
  if (DATE_MODE === 'YESTERDAY') {
    var y = addDays_(today, -1);
    var s = formatDate_(y);
    return { start: s, end: s };
  }

  if (DATE_MODE === 'LAST_7_DAYS') {
    var end = addDays_(today, -1);
    var start = addDays_(today, -7);
    return { start: formatDate_(start), end: formatDate_(end) };
  }

  if (DATE_MODE === 'LAST_30_DAYS') {
    var end30 = addDays_(today, -1);
    var start30 = addDays_(today, -30);
    return { start: formatDate_(start30), end: formatDate_(end30) };
  }

  throw new Error('DATE_MODE inválido: ' + DATE_MODE);
}


// =====================
// FETCH (GAQL)
// =====================

function gaqlRows_(query) {
  var rows = [];
  var it = AdsApp.search(query);
  while (it.hasNext()) {
    rows.push(it.next());
  }
  return rows;
}

function tryGaqlQueries_(queries) {
  for (var i = 0; i < queries.length; i++) {
    var q = queries[i];
    try {
      var rows = gaqlRows_(q);
      return { ok: true, rows: rows, query: q };
    } catch (e) {
      Logger.log('GAQL falhou (tentativa ' + (i + 1) + '/' + queries.length + '): ' + e);
    }
  }
  return { ok: false, rows: [], query: null };
}

function fetchCampaigns_() {
  // Metadados de campanhas
  // Somente campanhas ativas
  var query = "SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type, campaign.advertising_channel_sub_type FROM campaign WHERE campaign.status = 'ENABLED'";
  var rows = gaqlRows_(query);

  var out = [];
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    out.push({
      campaign_id: String(r.campaign.id),
      campaign_name: String(r.campaign.name),
      campaign_status: String(r.campaign.status),
      campaign_type: r.campaign.advertisingChannelSubType ? String(r.campaign.advertisingChannelSubType) : null,
      advertising_channel_type: r.campaign.advertisingChannelType ? String(r.campaign.advertisingChannelType) : null,
    });
  }

  return out;
}

function fetchPmaxMetrics_(range) {
  var where = "campaign.advertising_channel_type = 'PERFORMANCE_MAX' AND campaign.status = 'ENABLED'";
  var dateFilter = "segments.date BETWEEN '" + range.start + "' AND '" + range.end + "'";

  var query = "SELECT campaign.id, campaign.name, segments.date, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.conversions_value FROM campaign WHERE " + where + " AND " + dateFilter;

  var rows = gaqlRows_(query);
  var out = [];

  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    out.push({
      campaign_id: String(r.campaign.id),
      campaign_name: String(r.campaign.name),
      date: String(r.segments.date),
      impressions: Number(r.metrics.impressions) || 0,
      clicks: Number(r.metrics.clicks) || 0,
      cost: (Number(r.metrics.costMicros) || 0) / 1000000,
      conversions: Number(r.metrics.conversions) || 0,
      conversion_value: Number(r.metrics.conversionsValue) || 0,
    });
  }

  return out;
}

function fetchAds_(range) {
  // Nem toda conta (principalmente PMax puro) terá dados relevantes aqui.
  var dateFilter = "segments.date BETWEEN '" + range.start + "' AND '" + range.end + "'";
  var query = "SELECT campaign.id, campaign.name, ad_group.id, ad_group.name, ad_group_ad.ad.id, ad_group_ad.ad.type, ad_group_ad.status, segments.date, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.conversions_value FROM ad_group_ad WHERE " + dateFilter + " AND campaign.status != 'REMOVED'";

  var rows;
  try {
    rows = gaqlRows_(query);
  } catch (e) {
    Logger.log('fetchAds_ falhou (ignorado): ' + e);
    return [];
  }

  var out = [];
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    out.push({
      campaign_id: String(r.campaign.id),
      campaign_name: String(r.campaign.name),
      ad_group_id: String(r.adGroup.id),
      ad_group_name: String(r.adGroup.name),
      ad_id: String(r.adGroupAd.ad.id),
      ad_type: r.adGroupAd.ad.type ? String(r.adGroupAd.ad.type) : null,
      ad_status: r.adGroupAd.status ? String(r.adGroupAd.status) : null,
      date: String(r.segments.date),
      impressions: Number(r.metrics.impressions) || 0,
      clicks: Number(r.metrics.clicks) || 0,
      cost: (Number(r.metrics.costMicros) || 0) / 1000000,
      conversions: Number(r.metrics.conversions) || 0,
      conversion_value: Number(r.metrics.conversionsValue) || 0,
    });
  }

  return out;
}

function fetchPmaxAssets_(range) {
  // Assets/Asset groups para PMax
  var dateFilter = "segments.date BETWEEN '" + range.start + "' AND '" + range.end + "'";
  var where = "campaign.advertising_channel_type = 'PERFORMANCE_MAX' AND campaign.status = 'ENABLED'";

  // Inclui detalhes para exibição (nem todos os campos existem em todos os ambientes do Google Ads Scripts).
  // Por isso, tentamos queries em degraus (fallback automático).

  var selectBase = "campaign.id, campaign.name, asset_group.id, asset_group.name, asset.id, asset.resource_name, asset.type, " +
    "asset.text_asset.text, asset.sitelink_asset.link_text, asset.callout_asset.callout_text, asset.call_asset.phone_number, " +
    "asset.image_asset.full_size.url, asset.youtube_video_asset.youtube_video_id, " +
    "asset_group_asset.field_type, asset_group_asset.performance_label";

  // Campos opcionais podem falhar dependendo da versão do Google Ads Scripts.
  // No seu ambiente, business_name_asset e sitelink_asset.final_urls não são reconhecidos.
  // Mantemos a query estável (sem esses campos) para evitar o log de erro.
  var selectOpt1 = selectBase;
  // Alguns ambientes suportam asset.final_urls (genérico); mantemos como tentativa opcional.
  var selectOpt2 = selectBase + ", asset.final_urls";

  var qWithMetrics = [
    "SELECT " + selectOpt1 + ", segments.date, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.conversions_value FROM asset_group_asset WHERE " + where + " AND " + dateFilter,
    "SELECT " + selectOpt2 + ", segments.date, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.conversions_value FROM asset_group_asset WHERE " + where + " AND " + dateFilter,
    "SELECT " + selectBase + ", segments.date, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.conversions_value FROM asset_group_asset WHERE " + where + " AND " + dateFilter,
  ];

  var r1 = tryGaqlQueries_(qWithMetrics);

  var rows = r1.rows;
  var hasMetrics = r1.ok;

  if (!hasMetrics) {
    // Fallback sem métricas (alguns ambientes não permitem métricas no asset_group_asset)
    Logger.log('fetchPmaxAssets_: queries com métricas falharam; tentando sem métricas.');
    var qNoMetrics = [
      "SELECT " + selectOpt1 + " FROM asset_group_asset WHERE " + where,
      "SELECT " + selectOpt2 + " FROM asset_group_asset WHERE " + where,
      "SELECT " + selectBase + " FROM asset_group_asset WHERE " + where,
    ];

    var r2 = tryGaqlQueries_(qNoMetrics);
    rows = r2.rows;
    if (!r2.ok) {
      Logger.log('fetchPmaxAssets_: todas as queries falharam; retornando 0 assets.');
      return [];
    }

    var out2 = [];
    for (var j = 0; j < rows.length; j++) {
      var rr = rows[j];

      var text = null;
      if (rr.asset && rr.asset.textAsset && rr.asset.textAsset.text) {
        text = String(rr.asset.textAsset.text);
      } else if (rr.asset && rr.asset.sitelinkAsset && rr.asset.sitelinkAsset.linkText) {
        text = String(rr.asset.sitelinkAsset.linkText);
      } else if (rr.asset && rr.asset.calloutAsset && rr.asset.calloutAsset.calloutText) {
        text = String(rr.asset.calloutAsset.calloutText);
      } else if (rr.asset && rr.asset.callAsset && rr.asset.callAsset.phoneNumber) {
        text = String(rr.asset.callAsset.phoneNumber);
      } else if (rr.asset && rr.asset.businessNameAsset && rr.asset.businessNameAsset.businessName) {
        text = String(rr.asset.businessNameAsset.businessName);
      }

      var url = null;
      if (rr.asset && rr.asset.imageAsset && rr.asset.imageAsset.fullSize && rr.asset.imageAsset.fullSize.url) {
        url = String(rr.asset.imageAsset.fullSize.url);
      } else if (rr.asset && rr.asset.sitelinkAsset && rr.asset.sitelinkAsset.finalUrls && rr.asset.sitelinkAsset.finalUrls.length > 0) {
        url = String(rr.asset.sitelinkAsset.finalUrls[0]);
      } else if (rr.asset && rr.asset.finalUrls && rr.asset.finalUrls.length > 0) {
        url = String(rr.asset.finalUrls[0]);
      }

      var yt = null;
      if (rr.asset && rr.asset.youtubeVideoAsset && rr.asset.youtubeVideoAsset.youtubeVideoId) {
        yt = String(rr.asset.youtubeVideoAsset.youtubeVideoId);
        // se não houver URL ainda, monta uma URL amigável
        if (!url) url = 'https://www.youtube.com/watch?v=' + yt;
      }

      out2.push({
        campaign_id: String(rr.campaign.id),
        campaign_name: String(rr.campaign.name),
        asset_group_id: String(rr.assetGroup.id),
        asset_group_name: String(rr.assetGroup.name),
        asset_id: rr.asset && rr.asset.id ? String(rr.asset.id) : null,
        asset_resource_name: String(rr.asset.resourceName),
        asset_type: rr.asset.type ? String(rr.asset.type) : null,
        asset_text: text,
        asset_url: url,
        youtube_video_id: yt,
        field_type: rr.assetGroupAsset.fieldType ? String(rr.assetGroupAsset.fieldType) : null,
        performance_label: rr.assetGroupAsset.performanceLabel ? String(rr.assetGroupAsset.performanceLabel) : null,
        date: range.start,
        impressions: 0,
        clicks: 0,
        cost: 0,
        conversions: 0,
        conversion_value: 0,
      });
    }

    return out2;
  }

  var out = [];
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];

    var text2 = null;
    if (r.asset && r.asset.textAsset && r.asset.textAsset.text) {
      text2 = String(r.asset.textAsset.text);
    } else if (r.asset && r.asset.sitelinkAsset && r.asset.sitelinkAsset.linkText) {
      text2 = String(r.asset.sitelinkAsset.linkText);
    } else if (r.asset && r.asset.calloutAsset && r.asset.calloutAsset.calloutText) {
      text2 = String(r.asset.calloutAsset.calloutText);
    } else if (r.asset && r.asset.callAsset && r.asset.callAsset.phoneNumber) {
      text2 = String(r.asset.callAsset.phoneNumber);
    } else if (r.asset && r.asset.businessNameAsset && r.asset.businessNameAsset.businessName) {
      text2 = String(r.asset.businessNameAsset.businessName);
    }

    var url2 = null;
    if (r.asset && r.asset.imageAsset && r.asset.imageAsset.fullSize && r.asset.imageAsset.fullSize.url) {
      url2 = String(r.asset.imageAsset.fullSize.url);
    } else if (r.asset && r.asset.sitelinkAsset && r.asset.sitelinkAsset.finalUrls && r.asset.sitelinkAsset.finalUrls.length > 0) {
      url2 = String(r.asset.sitelinkAsset.finalUrls[0]);
    } else if (r.asset && r.asset.finalUrls && r.asset.finalUrls.length > 0) {
      url2 = String(r.asset.finalUrls[0]);
    }

    var yt2 = null;
    if (r.asset && r.asset.youtubeVideoAsset && r.asset.youtubeVideoAsset.youtubeVideoId) {
      yt2 = String(r.asset.youtubeVideoAsset.youtubeVideoId);
      if (!url2) url2 = 'https://www.youtube.com/watch?v=' + yt2;
    }

    out.push({
      campaign_id: String(r.campaign.id),
      campaign_name: String(r.campaign.name),
      asset_group_id: String(r.assetGroup.id),
      asset_group_name: String(r.assetGroup.name),
      asset_id: r.asset && r.asset.id ? String(r.asset.id) : null,
      asset_resource_name: String(r.asset.resourceName),
      asset_type: r.asset.type ? String(r.asset.type) : null,
      asset_text: text2,
      asset_url: url2,
      youtube_video_id: yt2,
      field_type: r.assetGroupAsset.fieldType ? String(r.assetGroupAsset.fieldType) : null,
      performance_label: r.assetGroupAsset.performanceLabel ? String(r.assetGroupAsset.performanceLabel) : null,
      date: String(r.segments.date),
      impressions: Number(r.metrics.impressions) || 0,
      clicks: Number(r.metrics.clicks) || 0,
      cost: (Number(r.metrics.costMicros) || 0) / 1000000,
      conversions: Number(r.metrics.conversions) || 0,
      conversion_value: Number(r.metrics.conversionsValue) || 0,
    });
  }

  return out;
}

function fetchPmaxSearchTermInsights_(range, campaignsRows) {
  // PMax: não expõe termos reais; expõe categorias (Insights) quando disponível.
  // Como nem todo ambiente/conta suporta, usamos fallback automático.
  // IMPORTANTE: em alguns ambientes do Google Ads Scripts, qualquer uso de `segments.date`
  // neste resource dispara erro (mesmo sem selecionar no SELECT).
  // Então NÃO filtramos por data aqui; o período real continua sendo carregado no payload (start/end)
  // e salvo no banco como date_range_start/date_range_end.

  // Importante: em alguns ambientes, o GAQL exige filtrar por um ÚNICO
  // campaign_search_term_insight.campaign_id.
  // Então buscamos por campanha (loop), em vez de tentar um query global.

  var nameById = {};
  var pmaxIds = [];
  for (var i = 0; i < (campaignsRows || []).length; i++) {
    var c = campaignsRows[i];
    var cid = String(c.campaign_id || '').trim();
    if (!cid) continue;
    nameById[cid] = String(c.campaign_name || '').trim();
    if (String(c.advertising_channel_type || '') === 'PERFORMANCE_MAX') pmaxIds.push(cid);
  }

  if (pmaxIds.length === 0) return [];

  var out = [];
  var anyOk = false;

  for (var j = 0; j < pmaxIds.length; j++) {
    var campaignId = pmaxIds[j];

    var whereOne = "campaign_search_term_insight.campaign_id = " + campaignId;

    var queries = [
      // Sem filtro de data: evita o erro de `segments.date` neste resource.
      // LIMIT protege contra payloads grandes caso a conta tenha muitos insights.
      "SELECT campaign_search_term_insight.campaign_id, campaign_search_term_insight.category_label, metrics.impressions, metrics.clicks, metrics.conversions, metrics.conversions_value FROM campaign_search_term_insight WHERE " + whereOne + " LIMIT 1000",
      // Fallback mínimo (se métricas também forem restritas)
      "SELECT campaign_search_term_insight.campaign_id, campaign_search_term_insight.category_label FROM campaign_search_term_insight WHERE " + whereOne + " LIMIT 1000",
    ];

    var r = tryGaqlQueries_(queries);
    if (!r.ok) {
      continue;
    }

    anyOk = true;

    var rows = r.rows;
    for (var k = 0; k < rows.length; k++) {
      var rr = rows[k];
      var cid2 = rr.campaignSearchTermInsight && rr.campaignSearchTermInsight.campaignId
        ? String(rr.campaignSearchTermInsight.campaignId)
        : campaignId;

      out.push({
        campaign_id: cid2,
        campaign_name: nameById[cid2] || nameById[campaignId] || null,
        category_label: rr.campaignSearchTermInsight && rr.campaignSearchTermInsight.categoryLabel ? String(rr.campaignSearchTermInsight.categoryLabel) : null,
        // Como não selecionamos segments.date, usamos um dia fixo para o backend (o período real está em start/end do payload).
        date: range.start,
        impressions: rr.metrics && rr.metrics.impressions ? Number(rr.metrics.impressions) || 0 : 0,
        clicks: rr.metrics && rr.metrics.clicks ? Number(rr.metrics.clicks) || 0 : 0,
        cost: 0,
        conversions: rr.metrics && rr.metrics.conversions ? Number(rr.metrics.conversions) || 0 : 0,
        conversion_value: rr.metrics && rr.metrics.conversionsValue ? Number(rr.metrics.conversionsValue) || 0 : 0,
      });
    }

    // Backoff leve para evitar rate limit em contas com muitas campanhas
    Utilities.sleep(150);
  }

  if (!anyOk) {
    Logger.log('fetchPmaxSearchTermInsights_: recurso não suportado neste ambiente/conta.');
    return [];
  }

  return out;
}

function fetchPmaxShoppingPerformance_(range) {
  // Objetivo: dar um proxy prático de “grupo de listagem” (feed/itens/categorias) via shopping_performance_view.
  // Em algumas contas, certos campos/segments podem falhar — usamos fallback.
  var dateFilter = "segments.date BETWEEN '" + range.start + "' AND '" + range.end + "'";
  var where = "campaign.advertising_channel_type = 'PERFORMANCE_MAX' AND campaign.status = 'ENABLED'";

  // Alguns ambientes exigem que campos referenciados no WHERE estejam no SELECT.
  var base = "campaign.id, campaign.name, campaign.advertising_channel_type, campaign.status, segments.date, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.conversions_value";
  var dims1 = ", segments.product_item_id, segments.product_title, segments.product_brand, segments.product_type_l1";
  var dims2 = ", segments.product_item_id, segments.product_title";

  var queries = [
    "SELECT " + base + dims1 + " FROM shopping_performance_view WHERE " + where + " AND " + dateFilter,
    "SELECT " + base + dims2 + " FROM shopping_performance_view WHERE " + where + " AND " + dateFilter,
    "SELECT " + base + " FROM shopping_performance_view WHERE " + where + " AND " + dateFilter,
  ];

  var r = tryGaqlQueries_(queries);
  if (!r.ok) {
    Logger.log('fetchPmaxShoppingPerformance_: shopping_performance_view não suportado neste ambiente/conta.');
    return [];
  }

  var rows = r.rows;
  var out = [];
  for (var i = 0; i < rows.length; i++) {
    var rr = rows[i];
    out.push({
      campaign_id: String(rr.campaign.id),
      campaign_name: String(rr.campaign.name),
      date: rr.segments && rr.segments.date ? String(rr.segments.date) : range.start,
      product_item_id: rr.segments && rr.segments.productItemId ? String(rr.segments.productItemId) : null,
      product_title: rr.segments && rr.segments.productTitle ? String(rr.segments.productTitle) : null,
      product_brand: rr.segments && rr.segments.productBrand ? String(rr.segments.productBrand) : null,
      product_type_l1: rr.segments && rr.segments.productTypeL1 ? String(rr.segments.productTypeL1) : null,
      impressions: rr.metrics && rr.metrics.impressions ? Number(rr.metrics.impressions) || 0 : 0,
      clicks: rr.metrics && rr.metrics.clicks ? Number(rr.metrics.clicks) || 0 : 0,
      cost: rr.metrics && rr.metrics.costMicros ? (Number(rr.metrics.costMicros) || 0) / 1000000 : 0,
      conversions: rr.metrics && rr.metrics.conversions ? Number(rr.metrics.conversions) || 0 : 0,
      conversion_value: rr.metrics && rr.metrics.conversionsValue ? Number(rr.metrics.conversionsValue) || 0 : 0,
    });
  }

  return out;
}

function fetchPmaxAudienceSignals_(range) {
  // Audience signals por Asset Group (quando disponível).
  // OBS: nem todo ambiente do Google Ads Scripts suporta asset_group_signal.
  var where = "campaign.advertising_channel_type = 'PERFORMANCE_MAX' AND campaign.status = 'ENABLED'";

  var queries = [
    // Começa pela query mínima (evita logs de campos proibidos/indisponíveis).
    "SELECT campaign.id, campaign.name, campaign.advertising_channel_type, campaign.status, asset_group.id, asset_group.name FROM asset_group_signal WHERE " + where,
    // Tentativas opcionais (podem falhar dependendo do ambiente; ficam depois).
    "SELECT campaign.id, campaign.name, campaign.advertising_channel_type, campaign.status, asset_group.id, asset_group.name, asset_group_signal.audience FROM asset_group_signal WHERE " + where,
    "SELECT campaign.id, campaign.name, campaign.advertising_channel_type, campaign.status, asset_group.id, asset_group.name, asset_group_signal.user_list FROM asset_group_signal WHERE " + where,
  ];

  var r = tryGaqlQueries_(queries);
  if (!r.ok) {
    Logger.log('fetchPmaxAudienceSignals_: asset_group_signal não suportado neste ambiente/conta.');
    return [];
  }

  var rows = r.rows;
  var out = [];
  for (var i = 0; i < rows.length; i++) {
    var rr = rows[i];
    // Como o tipo de sinal varia (audience, user_list etc.), guardamos o que tiver disponível.
    var signalType = null;
    var signalValue = null;

    if (rr.assetGroupSignal && rr.assetGroupSignal.userList) {
      signalType = 'USER_LIST';
      signalValue = String(rr.assetGroupSignal.userList);
    } else if (rr.assetGroupSignal && rr.assetGroupSignal.audience) {
      signalType = 'AUDIENCE';
      signalValue = String(rr.assetGroupSignal.audience);
    }

    out.push({
      campaign_id: String(rr.campaign.id),
      campaign_name: String(rr.campaign.name),
      asset_group_id: String(rr.assetGroup.id),
      asset_group_name: rr.assetGroup.name ? String(rr.assetGroup.name) : null,
      signal_type: signalType,
      signal_value: signalValue,
      date: range.start,
    });
  }

  return out;
}


// =====================
// POST / BULK
// =====================

function postRowsChunked_(reportName, range, campaignsRows, fieldName, rows) {
  if (!rows || rows.length === 0) {
    Logger.log(reportName + ': 0 rows; skip');
    return;
  }

  var sent = 0;
  for (var offset = 0; offset < rows.length; offset += CHUNK_SIZE) {
    var chunk = rows.slice(offset, offset + CHUNK_SIZE);
    var payloadBase = buildBasePayload_(reportName, range, campaignsRows);

    // Envia com fallback automático em caso de 413 (Payload Too Large)
    var accepted = postChunkAdaptive_(payloadBase, fieldName, chunk);
    sent += accepted;
    Logger.log(reportName + ': enviado ' + sent + '/' + rows.length + ' (aceitos)');

    // backoff simples para evitar rate limits
    Utilities.sleep(400);
  }
}

function postChunkAdaptive_(payloadBase, fieldName, chunk) {
  // Estratégia: tenta enviar o chunk; se receber 413, divide ao meio e tenta novamente.
  // Retorna quantos itens foram aceitos (status 2xx).

  var accepted = 0;
  var stack = [chunk];

  while (stack.length > 0) {
    var part = stack.pop();
    if (!part || part.length === 0) continue;

    var payload = {};
    for (var k in payloadBase) payload[k] = payloadBase[k];
    payload[fieldName] = part;

    var res = postBulk_(payload);

    if (res.status >= 200 && res.status < 300) {
      accepted += part.length;
      continue;
    }

    if (res.status === 413 && part.length > 1) {
      var mid = Math.ceil(part.length / 2);
      var left = part.slice(0, mid);
      var right = part.slice(mid);
      // Empilha primeiro right para processar left antes (ordem estável aproximada)
      stack.push(right);
      stack.push(left);
      continue;
    }

    // Se falhar por outro motivo (ou 413 com 1 item), loga e segue.
    Logger.log('Falha ao enviar chunk (status=' + res.status + ', size=' + part.length + ').');
  }

  return accepted;
}

function postInChunks_(payload) {
  return postBulk_(payload);
}

function postBulk_(payload) {
  var options = {
    method: 'post',
    contentType: 'application/json',
    muteHttpExceptions: true,
    headers: {
      'x-import-key': IMPORT_KEY,
    },
    payload: JSON.stringify(payload),
  };

  var response = UrlFetchApp.fetch(ENDPOINT_URL, options);
  var code = response.getResponseCode();
  var text = response.getContentText();

  if (code < 200 || code >= 300) {
    Logger.log('Falha no POST (' + code + '): ' + text);
  } else if (LOG_SUCCESS_RESPONSES) {
    // Tenta logar um resumo do apply do backend (importId / upserts) sem quebrar caso não seja JSON.
    try {
      var parsed = JSON.parse(text);
      if (parsed && typeof parsed === 'object') {
        var apply = parsed.applySummary || null;
        var msg = 'POST OK (' + code + ') ' + (payload.reportName || '') +
          (parsed.importId ? ' importId=' + parsed.importId : '');
        Logger.log(msg);

        if (parsed.appliedTables && parsed.appliedTables.length) {
          Logger.log('appliedTables=' + parsed.appliedTables.join(', '));
        }

        if (apply) {
          if (apply.pmaxSearchTermInsights) Logger.log('apply.pmaxSearchTermInsights=' + JSON.stringify(apply.pmaxSearchTermInsights));
          if (apply.pmaxAudienceSignals) Logger.log('apply.pmaxAudienceSignals=' + JSON.stringify(apply.pmaxAudienceSignals));
          if (apply.pmaxShopping) Logger.log('apply.pmaxShopping=' + JSON.stringify(apply.pmaxShopping));
          if (apply.assets) Logger.log('apply.assets=' + JSON.stringify(apply.assets));
          if (apply.metrics) Logger.log('apply.metrics=' + JSON.stringify(apply.metrics));
        }
      }
    } catch (e) {
      Logger.log('POST OK (' + code + ') ' + (payload.reportName || '') + ' (resposta não-JSON)');
    }
  }

  return { status: code, body: text };
}


// =====================
// VALIDATION
// =====================

function validateConfig_() {
  if (!ENDPOINT_URL) throw new Error('ENDPOINT_URL obrigatório');
  if (!IMPORT_KEY || IMPORT_KEY === 'COLE_SEU_IMPORT_KEY_AQUI') throw new Error('Defina IMPORT_KEY');
  if (!SUPABASE_CLIENT_ID || SUPABASE_CLIENT_ID === 'COLE_O_UUID_DO_CLIENTE_AQUI') throw new Error('Defina SUPABASE_CLIENT_ID (UUID)');
  if (!ACCOUNT_CUSTOMER_ID || ACCOUNT_CUSTOMER_ID === '123-456-7890') throw new Error('Defina ACCOUNT_CUSTOMER_ID');
}
