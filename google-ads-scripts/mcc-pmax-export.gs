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
var IMPORT_KEY = 'ed3f6917e6b5f87003ed77e91a1b47ba9677269f867aa4c321238e85272f6620';

// UUID do cliente (tabela `clients` no Supabase)
var SUPABASE_CLIENT_ID = '2562673e-574e-4bba-9bc8-cfb1ace00d1e';

// Customer ID da conta (pode ser com hífens). Ex: 123-456-7890
var ACCOUNT_CUSTOMER_ID = '477-857-0213';

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

  var query = "SELECT campaign.id, campaign.name, asset_group.id, asset_group.name, asset.id, asset.resource_name, asset.type, asset_group_asset.field_type, asset_group_asset.performance_label, segments.date, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.conversions_value FROM asset_group_asset WHERE " + where + " AND " + dateFilter;

  var rows;
  try {
    rows = gaqlRows_(query);
  } catch (e) {
    // Algumas contas podem não permitir métricas neste recurso; fallback sem métricas.
    Logger.log('fetchPmaxAssets_ (com métricas) falhou; tentando fallback sem métricas. Erro: ' + e);

    var query2 = "SELECT campaign.id, campaign.name, asset_group.id, asset_group.name, asset.id, asset.resource_name, asset.type, asset_group_asset.field_type, asset_group_asset.performance_label FROM asset_group_asset WHERE " + where;
    try {
      rows = gaqlRows_(query2);
    } catch (e2) {
      Logger.log('fetchPmaxAssets_ fallback também falhou (ignorado): ' + e2);
      return [];
    }

    var out2 = [];
    for (var j = 0; j < rows.length; j++) {
      var rr = rows[j];
      out2.push({
        campaign_id: String(rr.campaign.id),
        campaign_name: String(rr.campaign.name),
        asset_group_id: String(rr.assetGroup.id),
        asset_group_name: String(rr.assetGroup.name),
        asset_id: rr.asset && rr.asset.id ? String(rr.asset.id) : null,
        asset_resource_name: String(rr.asset.resourceName),
        asset_type: rr.asset.type ? String(rr.asset.type) : null,
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
    out.push({
      campaign_id: String(r.campaign.id),
      campaign_name: String(r.campaign.name),
      asset_group_id: String(r.assetGroup.id),
      asset_group_name: String(r.assetGroup.name),
      asset_id: r.asset && r.asset.id ? String(r.asset.id) : null,
      asset_resource_name: String(r.asset.resourceName),
      asset_type: r.asset.type ? String(r.asset.type) : null,
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

    var payload = buildBasePayload_(reportName, range, campaignsRows);

    payload[fieldName] = chunk;

    var res = postBulk_(payload);
    sent += chunk.length;
    Logger.log(reportName + ': enviado ' + sent + '/' + rows.length + ' (status=' + res.status + ')');

    // backoff simples para evitar rate limits
    Utilities.sleep(400);
  }
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
