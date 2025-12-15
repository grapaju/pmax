// Importa CSV exportado do Google Ads (UI) como DADOS BRUTOS no Supabase
// Uso:
//   node tools/import-google-ads-raw-csv.js --clientId <uuid> --file <caminho.csv>
//   node tools/import-google-ads-raw-csv.js --clientId <uuid> --file <caminho.csv> --reportName "Campanhas" --campaignId 123 --start 2025-12-01 --end 2025-12-31
//
// Requer no .env:
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//
// Notas:
// - Não tenta mapear colunas para as tabelas google_ads_*.
// - Preserva cabeçalhos e cada linha como JSON (header -> valor).

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs/promises';
import path from 'node:path';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = next;
      i++;
    }
  }
  return args;
}

function printHelp() {
  console.log(`\nUso:\n  node tools/import-google-ads-raw-csv.js --clientId <uuid> --file <caminho.csv> [--reportName <nome>] [--campaignId <id>] [--start YYYY-MM-DD] [--end YYYY-MM-DD]\n\nSincronização (opcional):\n  --applyTo auto|metrics|keywords|none\n    - auto: tenta inferir pelo cabeçalho (keyword -> keywords, senão metrics)\n    - metrics: alimenta google_ads_metrics\n    - keywords: alimenta google_ads_keywords\n\nRequer no .env:\n  SUPABASE_URL\n  SUPABASE_SERVICE_ROLE_KEY\n\nDica:\n  Exporte qualquer relatório do Google Ads em CSV e importe aqui.\n  Se quiser "como sincronização", passe --applyTo auto (ou metrics/keywords).\n`);
}

function decodeBuffer(buffer) {
  if (!buffer || buffer.length === 0) return { text: '', encoding: 'unknown' };

  // UTF-8 BOM
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return { text: buffer.slice(3).toString('utf8'), encoding: 'utf8-bom' };
  }

  // UTF-16 LE BOM
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return { text: buffer.slice(2).toString('utf16le'), encoding: 'utf16le-bom' };
  }

  // UTF-16 BE BOM
  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    const sliced = buffer.slice(2);
    const swapped = Buffer.allocUnsafe(sliced.length);
    for (let i = 0; i < sliced.length - 1; i += 2) {
      swapped[i] = sliced[i + 1];
      swapped[i + 1] = sliced[i];
    }
    // Se sobrar 1 byte, copia (arquivo malformado; melhor esforço)
    if (sliced.length % 2 === 1) swapped[sliced.length - 1] = sliced[sliced.length - 1];
    return { text: swapped.toString('utf16le'), encoding: 'utf16be-bom' };
  }

  // fallback
  return { text: buffer.toString('utf8'), encoding: 'utf8' };
}

function countDelimNotInQuotes(line, delim) {
  let inQuotes = false;
  let count = 0;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (!inQuotes && ch === delim) count++;
  }
  return count;
}

function detectDelimiter(text) {
  const lines = text.split(/\r\n|\n|\r/).filter((l) => l.trim().length > 0);
  const headerLine = lines[0] || '';
  const candidates = [',', ';', '\t'];

  let best = ',';
  let bestCount = -1;
  for (const c of candidates) {
    const count = countDelimNotInQuotes(headerLine, c);
    if (count > bestCount) {
      bestCount = count;
      best = c;
    }
  }

  return best;
}

function parseCsv(text, delimiter) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  function pushField() {
    row.push(field);
    field = '';
  }

  function pushRow() {
    // Evita adicionar linha vazia final
    const allEmpty = row.every((v) => String(v ?? '').trim() === '');
    if (!allEmpty) rows.push(row);
    row = [];
  }

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        field += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && ch === delimiter) {
      pushField();
      continue;
    }

    if (!inQuotes && (ch === '\n' || ch === '\r')) {
      pushField();
      pushRow();
      // pula \n depois de \r\n
      if (ch === '\r' && text[i + 1] === '\n') i++;
      continue;
    }

    field += ch;
  }

  // flush final
  pushField();
  pushRow();

  return rows;
}

function normalizeHeader(h) {
  return String(h ?? '').trim();
}

function normalizeKey(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9 ]/g, '');
}

function parseNumber(value) {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  // remove moeda, espaços e caracteres comuns
  let s = raw
    .replace(/\u00A0/g, ' ')
    .replace(/[%]/g, '')
    .replace(/\s/g, '')
    .replace(/[R$€£]/gi, '')
    .replace(/(BRL|USD|EUR|GBP)/gi, '');

  // mantém dígitos, sinal, ponto e vírgula
  s = s.replace(/[^0-9,\.\-]/g, '');
  if (!s) return null;

  const hasComma = s.includes(',');
  const hasDot = s.includes('.');

  if (hasComma && hasDot) {
    // Heurística pt-BR: 1.234,56
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(/,/g, '.');
    } else {
      // Heurística en-US: 1,234.56
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

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // DD/MM/YYYY ou DD-MM-YYYY
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) {
    const dd = m[1].padStart(2, '0');
    const mm = m[2].padStart(2, '0');
    const yyyy = m[3];
    return `${yyyy}-${mm}-${dd}`;
  }

  return null;
}

function pickFirst(row, keys) {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') return row[k];
  }
  return null;
}

function inferApplyTo(headers) {
  const normalized = headers.map((h) => normalizeKey(h));
  const hasKeyword = normalized.some((h) => h.includes('keyword') || h.includes('palavrachave'));
  return hasKeyword ? 'keywords' : 'metrics';
}

function buildHeaderIndex(headers) {
  const idx = new Map();
  for (const h of headers) {
    const nk = normalizeKey(h);
    if (!nk) continue;
    if (!idx.has(nk)) idx.set(nk, h);
  }
  return idx;
}

function findHeader(idx, candidates) {
  for (const c of candidates) {
    const nc = normalizeKey(c);
    if (idx.has(nc)) return idx.get(nc);
  }
  return null;
}

function mapRowToMetrics({ row, idx, fallbackCampaignId, fallbackCampaignName, fallbackStart, fallbackEnd }) {
  // Row keys são os headers originais
  const date = pickFirst(row, [
    idx.day,
    idx.date,
    idx.data,
  ].filter(Boolean));
  const parsedDate = parseDate(date);

  const campaignId = String(pickFirst(row, [idx.campaignId, idx.idCampanha].filter(Boolean)) || fallbackCampaignId || '').trim();
  const campaignName = String(pickFirst(row, [idx.campaign, idx.campanha].filter(Boolean)) || fallbackCampaignName || '').trim();
  const resolvedCampaignId = campaignId || campaignName;

  const start = parsedDate || fallbackStart;
  const end = parsedDate || fallbackEnd;

  if (!resolvedCampaignId || !campaignName || !start || !end) {
    return { ok: false, reason: 'missing_required_fields' };
  }

  const impressions = parseNumber(pickFirst(row, [idx.impressions, idx.impressoes].filter(Boolean))) ?? 0;
  const clicks = parseNumber(pickFirst(row, [idx.clicks, idx.cliques].filter(Boolean))) ?? 0;
  const cost = parseNumber(pickFirst(row, [idx.cost, idx.custo].filter(Boolean))) ?? 0;
  const conversions = parseNumber(pickFirst(row, [idx.conversions, idx.conversoes].filter(Boolean))) ?? 0;
  const conversionValue = parseNumber(pickFirst(row, [idx.conversionValue, idx.valorConversao].filter(Boolean))) ?? 0;

  const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
  const avgCpc = clicks > 0 ? cost / clicks : 0;
  const conversionRate = clicks > 0 ? (conversions / clicks) * 100 : 0;
  const cpa = conversions > 0 ? cost / conversions : 0;
  const roas = cost > 0 ? conversionValue / cost : 0;

  return {
    ok: true,
    value: {
      campaign_id: resolvedCampaignId,
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

function mapRowToKeyword({ row, idx, fallbackCampaignId, fallbackCampaignName, fallbackStart, fallbackEnd }) {
  const date = pickFirst(row, [idx.day, idx.date, idx.data].filter(Boolean));
  const parsedDate = parseDate(date);

  const campaignId = String(pickFirst(row, [idx.campaignId, idx.idCampanha].filter(Boolean)) || fallbackCampaignId || '').trim();
  const campaignName = String(pickFirst(row, [idx.campaign, idx.campanha].filter(Boolean)) || fallbackCampaignName || '').trim();
  const resolvedCampaignId = campaignId || campaignName;

  const adGroupId = String(pickFirst(row, [idx.adGroupId, idx.idGrupoAnuncios].filter(Boolean)) || '').trim();
  const adGroupName = String(pickFirst(row, [idx.adGroup, idx.grupoAnuncios].filter(Boolean)) || '').trim();

  const keywordText = String(pickFirst(row, [idx.keyword, idx.palavraChave].filter(Boolean)) || '').trim();
  const matchType = pickFirst(row, [idx.matchType, idx.tipoCorresp].filter(Boolean));
  const status = pickFirst(row, [idx.status].filter(Boolean));

  const start = parsedDate || fallbackStart;
  const end = parsedDate || fallbackEnd;

  if (!resolvedCampaignId || !adGroupId || !keywordText || !start || !end) {
    return { ok: false, reason: 'missing_required_fields' };
  }

  const impressions = parseNumber(pickFirst(row, [idx.impressions, idx.impressoes].filter(Boolean))) ?? 0;
  const clicks = parseNumber(pickFirst(row, [idx.clicks, idx.cliques].filter(Boolean))) ?? 0;
  const cost = parseNumber(pickFirst(row, [idx.cost, idx.custo].filter(Boolean))) ?? 0;
  const conversions = parseNumber(pickFirst(row, [idx.conversions, idx.conversoes].filter(Boolean))) ?? 0;
  const conversionValue = parseNumber(pickFirst(row, [idx.conversionValue, idx.valorConversao].filter(Boolean))) ?? 0;
  const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
  const avgCpc = clicks > 0 ? cost / clicks : 0;
  const costPerConversion = conversions > 0 ? cost / conversions : 0;

  return {
    ok: true,
    value: {
      campaign_id: resolvedCampaignId,
      campaign_name: campaignName || null,
      ad_group_id: adGroupId,
      ad_group_name: adGroupName || null,
      keyword_text: keywordText,
      match_type: matchType ? String(matchType).trim() : null,
      status: status ? String(status).trim() : null,
      date_range_start: start,
      date_range_end: end,
      impressions: Math.round(impressions),
      clicks: Math.round(clicks),
      cost,
      conversions,
      conversion_value: conversionValue,
      ctr,
      avg_cpc: avgCpc,
      cost_per_conversion: costPerConversion,
    },
  };
}

function buildRowJson(headers, fields) {
  const obj = {};
  for (let i = 0; i < headers.length; i++) {
    const key = headers[i] || `col_${i + 1}`;
    obj[key] = fields[i] !== undefined ? String(fields[i]) : '';
  }
  return obj;
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  printHelp();
  process.exit(0);
}

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env');
  process.exit(1);
}

const clientId = String(args.clientId || '').trim();
const file = String(args.file || '').trim();
if (!clientId || !file) {
  printHelp();
  process.exit(1);
}

const reportName = args.reportName ? String(args.reportName).trim() : null;
const campaignId = args.campaignId ? String(args.campaignId).trim() : null;
const start = args.start ? String(args.start).trim() : null;
const end = args.end ? String(args.end).trim() : null;
const applyToArg = args.applyTo ? String(args.applyTo).trim().toLowerCase() : 'none';
const applyTo = ['auto', 'metrics', 'keywords', 'none'].includes(applyToArg) ? applyToArg : 'none';

const filePath = path.resolve(file);
const fileName = path.basename(filePath);

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let buffer;
try {
  buffer = await fs.readFile(filePath);
} catch (err) {
  console.error('❌ Não foi possível ler o arquivo:', err?.message || err);
  process.exit(1);
}

const { text, encoding } = decodeBuffer(buffer);
const delimiter = detectDelimiter(text);
const rows = parseCsv(text, delimiter);

if (!rows.length) {
  console.error('❌ CSV vazio ou inválido.');
  process.exit(1);
}

const headers = rows[0].map(normalizeHeader);
const dataRows = rows.slice(1);

if (!headers.some((h) => h.length > 0)) {
  console.error('❌ Não encontrei cabeçalhos no CSV (primeira linha vazia?).');
  process.exit(1);
}

// Cria registro de import
const importRecord = {
  client_id: clientId,
  source: 'google_ads_ui',
  report_name: reportName,
  file_name: fileName,
  campaign_id: campaignId,
  date_range_start: start,
  date_range_end: end,
  encoding,
  delimiter: delimiter === '\t' ? 'TAB' : delimiter,
  headers,
  row_count: dataRows.length,
};

const { data: importInserted, error: importError } = await supabase
  .from('google_ads_raw_imports')
  .insert([importRecord])
  .select('id')
  .single();

if (importError) {
  console.error('❌ Falha ao criar import:', importError.message || importError);
  console.error('   Dica: rode o SQL em database/google-ads-raw-imports.sql no Supabase SQL Editor.');
  process.exit(1);
}

const importId = importInserted.id;

// Aplica para tabelas do sistema (sync por CSV)
let applied = null;
if (applyTo !== 'none') {
  const nowIso = new Date().toISOString();
  const headerIndex = buildHeaderIndex(headers);

  // resolve headers usados (originais) para pegar do row_json
  const resolved = {
    campaignId: findHeader(headerIndex, ['Campaign ID', 'ID da campanha', 'Id da campanha', 'CampaignId', 'campaign id']),
    idCampanha: findHeader(headerIndex, ['ID da campanha', 'Id da campanha']),
    campaign: findHeader(headerIndex, ['Campaign', 'Campanha', 'Nome da campanha']),
    campanha: findHeader(headerIndex, ['Campanha', 'Nome da campanha']),
    adGroupId: findHeader(headerIndex, ['Ad group ID', 'ID do grupo de anúncios', 'Id do grupo de anuncios', 'Grupo de anúncios ID', 'AdGroup ID']),
    idGrupoAnuncios: findHeader(headerIndex, ['ID do grupo de anúncios', 'Id do grupo de anuncios', 'Grupo de anúncios ID']),
    adGroup: findHeader(headerIndex, ['Ad group', 'Grupo de anúncios', 'Grupo de anuncios']),
    grupoAnuncios: findHeader(headerIndex, ['Grupo de anúncios', 'Grupo de anuncios']),
    keyword: findHeader(headerIndex, ['Keyword', 'Palavra-chave', 'Palavra chave', 'Search keyword']),
    palavraChave: findHeader(headerIndex, ['Palavra-chave', 'Palavra chave']),
    matchType: findHeader(headerIndex, ['Match type', 'Tipo de correspondência', 'Tipo de correspondencia']),
    tipoCorresp: findHeader(headerIndex, ['Tipo de correspondência', 'Tipo de correspondencia']),
    status: findHeader(headerIndex, ['Status']),
    impressions: findHeader(headerIndex, ['Impressions', 'Impressões', 'Impressoes']),
    impressoes: findHeader(headerIndex, ['Impressões', 'Impressoes']),
    clicks: findHeader(headerIndex, ['Clicks', 'Cliques']),
    cliques: findHeader(headerIndex, ['Cliques']),
    cost: findHeader(headerIndex, ['Cost', 'Custo', 'Spend', 'Gasto']),
    custo: findHeader(headerIndex, ['Custo', 'Gasto']),
    conversions: findHeader(headerIndex, ['Conversions', 'Conversões', 'Conversoes']),
    conversoes: findHeader(headerIndex, ['Conversões', 'Conversoes']),
    conversionValue: findHeader(headerIndex, ['Conv. value', 'Conversion value', 'Valor de conversão', 'Valor de conversao']),
    valorConversao: findHeader(headerIndex, ['Valor de conversão', 'Valor de conversao']),
    day: findHeader(headerIndex, ['Day', 'Dia']),
    date: findHeader(headerIndex, ['Date', 'Data']),
    data: findHeader(headerIndex, ['Data']),
  };

  const chosen = applyTo === 'auto' ? inferApplyTo(headers) : applyTo;

  const warnings = [];
  if (!start || !end) {
    const hasAnyDate = Boolean(resolved.day || resolved.date || resolved.data);
    if (!hasAnyDate) {
      warnings.push('Sem --start/--end e sem coluna de Data/Dia; algumas linhas serão ignoradas.');
    }
  }

  const table = chosen === 'keywords' ? 'google_ads_keywords' : 'google_ads_metrics';
  const mapped = [];
  let skipped = 0;

  for (const fields of dataRows) {
    const rowJson = buildRowJson(headers, fields);
    const r = chosen === 'keywords'
      ? mapRowToKeyword({ row: rowJson, idx: resolved, fallbackCampaignId: campaignId, fallbackCampaignName: null, fallbackStart: start, fallbackEnd: end })
      : mapRowToMetrics({ row: rowJson, idx: resolved, fallbackCampaignId: campaignId, fallbackCampaignName: null, fallbackStart: start, fallbackEnd: end });

    if (!r.ok) {
      skipped++;
      continue;
    }

    mapped.push({ ...r.value, client_id: clientId, collected_at: nowIso });
  }

  let upserted = 0;
  let applyStatus = 'success';
  let applyError = null;

  try {
    if (mapped.length > 0) {
      const chunkSize = 500;
      for (let offset = 0; offset < mapped.length; offset += chunkSize) {
        const chunk = mapped.slice(offset, offset + chunkSize);
        const onConflict = chosen === 'keywords'
          ? 'campaign_id,ad_group_id,keyword_text,match_type,date_range_start,date_range_end,client_id'
          : 'campaign_id,date_range_start,date_range_end,client_id';

        const { error } = await supabase.from(table).upsert(chunk, { onConflict });
        if (error) throw error;
        upserted += chunk.length;
      }
    }
  } catch (err) {
    applyStatus = 'error';
    applyError = err?.message || String(err);
  }

  const summary = {
    applyTo: chosen,
    targetTable: table,
    importedRows: dataRows.length,
    mappedRows: mapped.length,
    upsertedRows: upserted,
    skippedRows: skipped,
    warnings,
  };

  // Auditoria no import
  await supabase
    .from('google_ads_raw_imports')
    .update({
      applied_at: nowIso,
      applied_tables: [table],
      applied_status: applyStatus,
      applied_summary: summary,
      applied_error: applyError,
    })
    .eq('id', importId);

  // Log central
  await supabase.from('google_ads_activity_log').insert([
    {
      client_id: clientId,
      action: 'csv_sync',
      entity_type: chosen,
      entity_id: importId,
      status: applyStatus,
      message: applyStatus === 'success'
        ? `CSV sync aplicado em ${table} (rows=${upserted}, skipped=${skipped})`
        : `CSV sync falhou em ${table}: ${applyError}`,
      error_details: applyError ? { error: applyError, summary } : { summary },
      records_affected: upserted,
    },
  ]);

  applied = { status: applyStatus, summary, error: applyError };
}

// Insere linhas em lotes
const chunkSize = 500;
let inserted = 0;

for (let offset = 0; offset < dataRows.length; offset += chunkSize) {
  const chunk = dataRows.slice(offset, offset + chunkSize);
  const payload = chunk.map((fields, idx) => ({
    import_id: importId,
    client_id: clientId,
    row_index: offset + idx + 1,
    row_json: buildRowJson(headers, fields),
  }));

  const { error } = await supabase.from('google_ads_raw_import_rows').insert(payload);
  if (error) {
    console.error('❌ Falha ao inserir linhas:', error.message || error);
    console.error('   Import criado, mas parte das linhas pode não ter sido inserida.');
    console.error({ importId, inserted, total: dataRows.length });
    process.exit(1);
  }

  inserted += payload.length;
}

console.log('✅ Import bruto concluído!');
console.log({
  importId,
  clientId,
  fileName,
  reportName,
  campaignId,
  start,
  end,
  encoding,
  delimiter: delimiter === '\t' ? 'TAB' : delimiter,
  headers: headers.length,
  rows: inserted,
  applied,
});
