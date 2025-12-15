// Exporta dados coletados (Supabase) para CSV
// Uso:
//   node tools/export-google-ads-csv.js --clientId <uuid>
//   node tools/export-google-ads-csv.js --clientId <uuid> --outDir exports --start 2025-12-01 --end 2025-12-31
//
// Requer no .env:
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY

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
  console.log(`\nUso:\n  node tools/export-google-ads-csv.js --clientId <uuid> [--outDir <pasta>] [--start YYYY-MM-DD] [--end YYYY-MM-DD]\n\nExporta tabelas:\n  - google_ads_metrics\n  - google_ads_keywords\n\nNotas:\n  - Isso exporta os dados JÁ COLETADOS E SALVOS no Supabase (não baixa direto do Google Ads UI).\n  - Para baixar direto do Google Ads, use a exportação de relatórios do próprio Google Ads.\n`);
}

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[\n\r\,"]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(rows, columns) {
  const header = columns.join(',');
  const lines = rows.map((row) => columns.map((c) => csvEscape(row?.[c])).join(','));
  return [header, ...lines].join('\n') + '\n';
}

async function fetchAll({ supabase, table, clientId, start, end }) {
  const pageSize = 1000;
  let offset = 0;
  const all = [];

  for (;;) {
    let q = supabase.from(table).select('*').eq('client_id', clientId).order('collected_at', { ascending: false });

    if (start) q = q.gte('date_range_start', start);
    if (end) q = q.lte('date_range_end', end);

    const { data, error } = await q.range(offset, offset + pageSize - 1);
    if (error) throw error;

    all.push(...(data || []));
    if (!data || data.length < pageSize) break;
    offset += pageSize;
  }

  return all;
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
if (!clientId) {
  printHelp();
  process.exit(1);
}

const outDir = path.resolve(String(args.outDir || 'exports'));
const start = args.start ? String(args.start).trim() : null;
const end = args.end ? String(args.end).trim() : null;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

await fs.mkdir(outDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');

try {
  const metrics = await fetchAll({ supabase, table: 'google_ads_metrics', clientId, start, end });
  const keywords = await fetchAll({ supabase, table: 'google_ads_keywords', clientId, start, end });

  const metricsColumns = [
    'campaign_id',
    'campaign_name',
    'campaign_type',
    'campaign_status',
    'bidding_strategy',
    'date_range_start',
    'date_range_end',
    'impressions',
    'clicks',
    'cost',
    'conversions',
    'conversion_value',
    'ctr',
    'avg_cpc',
    'conversion_rate',
    'cpa',
    'roas',
    'client_id',
    'collected_at',
  ];

  const keywordsColumns = [
    'campaign_id',
    'campaign_name',
    'ad_group_id',
    'ad_group_name',
    'keyword_text',
    'match_type',
    'status',
    'cpc_bid',
    'quality_score',
    'ad_relevance',
    'landing_page_experience',
    'expected_ctr',
    'date_range_start',
    'date_range_end',
    'impressions',
    'clicks',
    'cost',
    'conversions',
    'conversion_value',
    'ctr',
    'avg_cpc',
    'cost_per_conversion',
    'client_id',
    'collected_at',
  ];

  const metricsCsv = toCsv(metrics, metricsColumns);
  const keywordsCsv = toCsv(keywords, keywordsColumns);

  const metricsPath = path.join(outDir, `google_ads_metrics_${clientId}_${stamp}.csv`);
  const keywordsPath = path.join(outDir, `google_ads_keywords_${clientId}_${stamp}.csv`);

  await fs.writeFile(metricsPath, metricsCsv, 'utf8');
  await fs.writeFile(keywordsPath, keywordsCsv, 'utf8');

  console.log('✅ CSV exportado:');
  console.log(`- metrics:  ${metricsPath}  (rows=${metrics.length})`);
  console.log(`- keywords: ${keywordsPath} (rows=${keywords.length})`);
} catch (err) {
  console.error('❌ Falha ao exportar CSV:', err?.message || err);
  process.exit(1);
}
