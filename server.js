import express from 'express';
import cors from 'cors';
import { GoogleAdsApi } from 'google-ads-api';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import crypto from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import archiver from 'archiver';
import { createGoogleAdsScriptIngestRouter } from './server/routes/googleAdsScriptIngest.js';

// No Windows, variáveis de ambiente definidas como string vazia (" ") podem impedir
// o dotenv de aplicar os valores do arquivo .env. Limpamos apenas as vazias.
for (const key of [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_ANON_KEY',
  'GOOGLE_ADS_OAUTH_CLIENT_ID',
  'GOOGLE_ADS_OAUTH_CLIENT_SECRET',
  'GOOGLE_ADS_OAUTH_REDIRECT_URI',
  'GOOGLE_ADS_DEVELOPER_TOKEN',
  'PUBLIC_BASE_URL',
  'CORS_ORIGIN',
  'OAUTH_STATE_SECRET',
  'GOOGLE_ADS_SCRIPT_IMPORT_KEY',
]) {
  if (process.env[key] === '') delete process.env[key];
}

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3001);

function parseCorsAllowlist(value) {
  const s = String(value || '').trim();
  if (!s) return null;
  return s
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
    .map((v) => v.replace(/\/$/, ''));
}

const corsAllowlist = parseCorsAllowlist(process.env.CORS_ORIGIN);

app.use(
  cors({
    origin(origin, cb) {
      // Requests sem Origin (ex.: curl, server-to-server, Google Ads Script)
      if (!origin) return cb(null, true);

      if (!corsAllowlist) return cb(null, true);

      const normalized = String(origin).replace(/\/$/, '');
      if (corsAllowlist.includes(normalized)) return cb(null, true);

      return cb(new Error(`CORS bloqueado para origem: ${origin}`), false);
    },
  })
);
// O Google Ads Script pode enviar payloads grandes (assetsRows etc.).
// Se o limite ficar no padrão (100kb), o Express retorna 413 antes de chegar nas rotas.
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ limit: '25mb', extended: true }));

// Inicializar Supabase (Service Role Key para bypass RLS)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
  throw new Error(
    'Defina SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e SUPABASE_ANON_KEY no .env para iniciar o server.js'
  );
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

function maskSecret(value) {
  if (!value) return null;
  const s = String(value);
  if (s.length <= 8) return '***';
  return `${s.slice(0, 4)}***${s.slice(-4)}`;
}

function toBool(value) {
  return value === true || value === 'true' || value === '1';
}

function serializeError(error) {
  const dev = toBool(process.env.DEBUG);
  const base = {
    name: error?.name,
    message: error?.message || String(error),
  };

  // google-ads-api / google-gax costuma anexar detalhes
  const extra = {
    code: error?.code,
    status: error?.status,
    request_id: error?.request_id,
    errors: error?.errors,
    details: error?.details,
    failure: error?.failure,
    response: error?.response
      ? {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data,
        }
      : undefined,
  };

  if (dev) {
    extra.stack = error?.stack;
  }

  return { ...base, ...extra };
}

function logConfigSummary() {
  const summary = {
    PORT,
    CORS_ORIGIN: process.env.CORS_ORIGIN || '(any)',
    PUBLIC_BASE_URL: process.env.PUBLIC_BASE_URL || '(auto)',
    GOOGLE_ADS_OAUTH_CLIENT_ID: maskSecret(process.env.GOOGLE_ADS_OAUTH_CLIENT_ID),
    GOOGLE_ADS_OAUTH_CLIENT_SECRET: maskSecret(process.env.GOOGLE_ADS_OAUTH_CLIENT_SECRET),
    GOOGLE_ADS_OAUTH_REDIRECT_URI: process.env.GOOGLE_ADS_OAUTH_REDIRECT_URI || '(auto)',
    GOOGLE_ADS_DEVELOPER_TOKEN: maskSecret(process.env.GOOGLE_ADS_DEVELOPER_TOKEN),
    OAUTH_STATE_SECRET: process.env.OAUTH_STATE_SECRET ? 'set' : 'missing',
    DEBUG: process.env.DEBUG || 'false',
  };

  console.log('⚙️  Config (masked):', summary);
}

function getPublicBaseUrl(req) {
  const configured = process.env.PUBLIC_BASE_URL;
  if (configured) return configured.replace(/\/$/, '');

  // fallback para dev
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`.replace(/\/$/, '');
}

function base64UrlEncode(buffer) {
  return Buffer.from(buffer)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlDecode(str) {
  const normalized = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = normalized.length % 4;
  const padded = pad ? normalized + '='.repeat(4 - pad) : normalized;
  return Buffer.from(padded, 'base64');
}

function signState(payload, secret) {
  const json = JSON.stringify(payload);
  const data = base64UrlEncode(json);
  const sig = crypto.createHmac('sha256', secret).update(data).digest();
  return `${data}.${base64UrlEncode(sig)}`;
}

function verifyState(state, secret) {
  const [data, sig] = (state || '').split('.');
  if (!data || !sig) return null;

  const expected = crypto.createHmac('sha256', secret).update(data).digest();
  const provided = base64UrlDecode(sig);
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
    return null;
  }

  const payload = JSON.parse(base64UrlDecode(data).toString('utf8'));
  return payload;
}

async function requireSupabaseUser(req) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;

  if (!token) {
    const err = new Error('Authorization Bearer token é obrigatório');
    err.status = 401;
    throw err;
  }

  const { data, error } = await supabaseAuth.auth.getUser(token);
  if (error || !data?.user) {
    const err = new Error('Token inválido ou expirado');
    err.status = 401;
    throw err;
  }

  return data.user;
}

async function requireClientOwnership(clientId, userId) {
  const { data: clientRow, error } = await supabase
    .from('clients')
    .select('id, owner_id')
    .eq('id', clientId)
    .single();

  if (error || !clientRow) {
    const err = new Error('Cliente não encontrado');
    err.status = 404;
    throw err;
  }

  if (clientRow.owner_id !== userId) {
    const err = new Error('Sem permissão para este cliente');
    err.status = 403;
    throw err;
  }

  return clientRow;
}

function buildOAuthClient({ clientId, clientSecret, redirectUri }) {
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Configuração OAuth incompleta (clientId/clientSecret/redirectUri)');
  }
  return new OAuth2Client(clientId, clientSecret, redirectUri);
}

// Rota de health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Ingest via Google Ads Scripts (UrlFetchApp)
app.use(
  '/api/google-ads/script-ingest',
  createGoogleAdsScriptIngestRouter({ supabase })
);

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[\n\r\,"]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(rows, columns) {
  const header = columns.join(',');
  const lines = (rows || []).map((row) => columns.map((c) => csvEscape(row?.[c])).join(','));
  return [header, ...lines].join('\n') + '\n';
}

function isMissingTableError(error) {
  const code = error?.code || error?.details?.code;
  const message = String(error?.message || '');
  return code === '42P01' || message.includes('relation') && message.includes('does not exist');
}

async function fetchAllRows({ table, clientId, campaignId, start, end }) {
  const pageSize = 1000;
  let offset = 0;
  const all = [];

  for (;;) {
    let q = supabase.from(table).select('*').eq('client_id', clientId);
    if (campaignId) q = q.eq('campaign_id', campaignId);
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

function getCsvSpecForTable(table) {
  switch (table) {
    case 'google_ads_metrics':
      return {
        filenamePrefix: 'google_ads_metrics',
        columns: [
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
        ],
      };
    case 'google_ads_keywords':
      return {
        filenamePrefix: 'google_ads_keywords',
        columns: [
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
        ],
      };
    case 'google_ads_ads':
      return {
        filenamePrefix: 'google_ads_ads',
        columns: [
          'campaign_id',
          'campaign_name',
          'ad_group_id',
          'ad_group_name',
          'ad_id',
          'ad_type',
          'ad_status',
          'date_range_start',
          'date_range_end',
          'impressions',
          'clicks',
          'cost',
          'conversions',
          'conversion_value',
          'client_id',
          'collected_at',
        ],
      };
    case 'google_ads_assets':
      return {
        filenamePrefix: 'google_ads_assets',
        columns: [
          'campaign_id',
          'campaign_name',
          'asset_group_id',
          'asset_group_name',
          'asset_id',
          'asset_resource_name',
          'asset_type',
          'field_type',
          'performance_label',
          'date_range_start',
          'date_range_end',
          'impressions',
          'clicks',
          'cost',
          'conversions',
          'conversion_value',
          'client_id',
          'collected_at',
        ],
      };
    case 'google_ads_search_terms':
      return {
        filenamePrefix: 'google_ads_search_terms',
        columns: [
          'campaign_id',
          'campaign_name',
          'ad_group_id',
          'ad_group_name',
          'search_term',
          'date_range_start',
          'date_range_end',
          'impressions',
          'clicks',
          'cost',
          'conversions',
          'conversion_value',
          'client_id',
          'collected_at',
        ],
      };
    case 'google_ads_audiences':
      return {
        filenamePrefix: 'google_ads_audiences',
        columns: [
          'user_list_id',
          'user_list_name',
          'user_list_description',
          'user_list_status',
          'client_id',
          'collected_at',
        ],
      };
    case 'google_ads_api_recommendations':
      return {
        filenamePrefix: 'google_ads_api_recommendations',
        columns: [
          'recommendation_resource_name',
          'recommendation_type',
          'dismissed',
          'campaign_id',
          'client_id',
          'collected_at',
        ],
      };
    case 'google_ads_recommendations':
      return {
        filenamePrefix: 'google_ads_recommendations',
        columns: [
          'type',
          'priority',
          'category',
          'title',
          'description',
          'impact',
          'estimated_impact_value',
          'action',
          'action_type',
          'campaign_id',
          'ad_group_id',
          'keyword_text',
          'status',
          'created_at',
          'client_id',
        ],
      };
    default:
      return null;
  }
}

// Exporta dados coletados em CSV (usa Service Role, mas valida ownership)
app.get('/api/google-ads/export-csv', async (req, res) => {
  try {
    const user = await requireSupabaseUser(req);
    const clientId = String(req.query.clientId || '').trim();
    const tableParam = String(req.query.table || 'metrics').toLowerCase();
    const campaignId = req.query.campaignId ? String(req.query.campaignId).trim() : null;
    const start = req.query.start ? String(req.query.start).trim() : null;
    const end = req.query.end ? String(req.query.end).trim() : null;

    if (!clientId) return res.status(400).json({ success: false, error: 'clientId é obrigatório' });
    await requireClientOwnership(clientId, user.id);

    const filenameBaseParts = [clientId];
    if (campaignId) filenameBaseParts.push(`campaign-${campaignId}`);
    const filenameBase = filenameBaseParts.join('_');

    // table=all retorna 2 CSVs em JSON (base64) para o frontend disparar downloads
    if (tableParam === 'all') {
      const [metricsRows, keywordsRows] = await Promise.all([
        fetchAllRows({ table: 'google_ads_metrics', clientId, campaignId, start, end }),
        fetchAllRows({ table: 'google_ads_keywords', clientId, campaignId, start, end }),
      ]);

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

      const stamp = new Date().toISOString().slice(0, 10);
      const metricsFilename = `google_ads_metrics_${filenameBase}_${stamp}.csv`;
      const keywordsFilename = `google_ads_keywords_${filenameBase}_${stamp}.csv`;

      const metricsCsv = toCsv(metricsRows, metricsColumns);
      const keywordsCsv = toCsv(keywordsRows, keywordsColumns);

      return res.json({
        success: true,
        files: [
          {
            table: 'metrics',
            filename: metricsFilename,
            contentBase64: Buffer.from(metricsCsv, 'utf8').toString('base64'),
            rows: metricsRows.length,
          },
          {
            table: 'keywords',
            filename: keywordsFilename,
            contentBase64: Buffer.from(keywordsCsv, 'utf8').toString('base64'),
            rows: keywordsRows.length,
          },
        ],
      });
    }

    const table =
      tableParam === 'keywords'
        ? 'google_ads_keywords'
        : tableParam === 'metrics'
          ? 'google_ads_metrics'
          : tableParam === 'ads'
            ? 'google_ads_ads'
            : tableParam === 'assets'
              ? 'google_ads_assets'
              : tableParam === 'search_terms'
                ? 'google_ads_search_terms'
                : tableParam === 'audiences'
                  ? 'google_ads_audiences'
                  : tableParam === 'api_recommendations'
                    ? 'google_ads_api_recommendations'
                    : tableParam === 'recommendations'
                      ? 'google_ads_recommendations'
                      : null;

    if (!table) {
      return res.status(400).json({
        success: false,
        error:
          'Parâmetro table inválido. Use metrics, keywords, ads, assets, search_terms, audiences, recommendations, api_recommendations.',
      });
    }

    const spec = getCsvSpecForTable(table);
    if (!spec) {
      return res.status(400).json({ success: false, error: 'Tabela sem spec de export CSV' });
    }

    let rows = [];
    try {
      rows = await fetchAllRows({ table, clientId, campaignId, start, end });
    } catch (err) {
      if (isMissingTableError(err)) {
        return res.status(409).json({
          success: false,
          code: 'SUPABASE_TABLE_MISSING',
          error: `Tabela ${table} não existe no Supabase. Rode o SQL de migração (database/google-ads-extra-tables.sql).`,
        });
      }
      throw err;
    }

    const columns = spec.columns;

    const csv = toCsv(rows, columns);

    const stamp = new Date().toISOString().slice(0, 10);
    const filename = `${spec.filenamePrefix}_${filenameBase}_${stamp}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(csv);
  } catch (error) {
    console.error('❌ export-csv error:', error);
    res
      .status(error.status || 500)
      .json({ success: false, error: error.message, details: serializeError(error) });
  }
});

// Exporta um ZIP com TODOS os CSVs relevantes de uma campanha (um clique)
app.get('/api/google-ads/export-zip', async (req, res) => {
  try {
    const user = await requireSupabaseUser(req);
    const clientId = String(req.query.clientId || '').trim();
    const campaignId = req.query.campaignId ? String(req.query.campaignId).trim() : null;
    const start = req.query.start ? String(req.query.start).trim() : null;
    const end = req.query.end ? String(req.query.end).trim() : null;

    if (!clientId) return res.status(400).json({ success: false, error: 'clientId é obrigatório' });
    await requireClientOwnership(clientId, user.id);

    const stamp = new Date().toISOString().slice(0, 10);
    const baseParts = [clientId];
    if (campaignId) baseParts.push(`campaign-${campaignId}`);
    const base = baseParts.join('_');
    const zipName = `google_ads_export_${base}_${stamp}.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', (err) => {
      throw err;
    });

    archive.pipe(res);

    const tables = [
      'google_ads_metrics',
      'google_ads_keywords',
      'google_ads_ads',
      'google_ads_assets',
      'google_ads_search_terms',
      'google_ads_audiences',
      'google_ads_recommendations',
      'google_ads_api_recommendations',
    ];

    for (const table of tables) {
      const spec = getCsvSpecForTable(table);
      if (!spec) continue;

      try {
        const rows = await fetchAllRows({ table, clientId, campaignId, start, end });
        const csv = toCsv(rows, spec.columns);
        const filename = `${spec.filenamePrefix}_${base}_${stamp}.csv`;
        archive.append(csv, { name: filename });
      } catch (err) {
        if (isMissingTableError(err)) {
          const msg = `Tabela ausente no Supabase: ${table}. Rode database/google-ads-extra-tables.sql para habilitar.\n`;
          archive.append(msg, { name: `MISSING_${table}.txt` });
          continue;
        }

        const msg = `Falha exportando ${table}: ${err?.message || err}\n`;
        archive.append(msg, { name: `ERROR_${table}.txt` });
      }
    }

    await archive.finalize();
  } catch (error) {
    console.error('❌ export-zip error:', error);
    if (!res.headersSent) {
      res.status(error.status || 500).json({ success: false, error: error.message, details: serializeError(error) });
    }
  }
});

// Diagnóstico rápido (não vaza segredos)
app.get('/api/google-ads/doctor', async (req, res) => {
  try {
    const env = {
      hasSupabaseUrl: Boolean(process.env.SUPABASE_URL),
      hasServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      hasAnonKey: Boolean(process.env.SUPABASE_ANON_KEY),
      hasOAuthClientId: Boolean(process.env.GOOGLE_ADS_OAUTH_CLIENT_ID),
      hasOAuthClientSecret: Boolean(process.env.GOOGLE_ADS_OAUTH_CLIENT_SECRET),
      hasStateSecret: Boolean(process.env.OAUTH_STATE_SECRET),
      publicBaseUrl: process.env.PUBLIC_BASE_URL || null,
      redirectUri: process.env.GOOGLE_ADS_OAUTH_REDIRECT_URI || null,
      collectModeDefault: 'node',
    };

    // ping supabase com service role
    const { error: pingError } = await supabase.from('clients').select('id').limit(1);

    res.json({
      ok: true,
      env,
      supabase: {
        serviceRoleCanReadClients: !pingError,
        pingError: pingError ? serializeError(pingError) : null,
      },
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: serializeError(error) });
  }
});

// ===== OAuth2 Oficial (Node) =====
// 1) Frontend chama /api/google-ads/oauth/start (com Authorization Bearer do Supabase)
// 2) Server retorna URL do Google
// 3) Callback /api/google-ads/oauth/callback troca code->tokens e salva refresh_token no cliente

app.get('/api/google-ads/oauth/start', async (req, res) => {
  try {
    const user = await requireSupabaseUser(req);
    const clientIdParam = String(req.query.clientId || '');
    if (!clientIdParam) return res.status(400).json({ error: 'clientId é obrigatório' });

    await requireClientOwnership(clientIdParam, user.id);

    const stateSecret = process.env.OAUTH_STATE_SECRET;
    if (!stateSecret) {
      return res.status(500).json({ error: 'Defina OAUTH_STATE_SECRET no .env' });
    }

    // Preferir credenciais OAuth via env; fallback para colunas do cliente
    const { data: clientCreds } = await supabase
      .from('clients')
      .select('google_ads_client_id, google_ads_client_secret')
      .eq('id', clientIdParam)
      .single();

    const oauthClientId = process.env.GOOGLE_ADS_OAUTH_CLIENT_ID || clientCreds?.google_ads_client_id;
    const oauthClientSecret = process.env.GOOGLE_ADS_OAUTH_CLIENT_SECRET || clientCreds?.google_ads_client_secret;

    const redirectUri =
      process.env.GOOGLE_ADS_OAUTH_REDIRECT_URI ||
      `${getPublicBaseUrl(req)}/api/google-ads/oauth/callback`;

    const oauth2Client = buildOAuthClient({
      clientId: oauthClientId,
      clientSecret: oauthClientSecret,
      redirectUri,
    });

    const state = signState(
      { clientId: clientIdParam, userId: user.id, ts: Date.now() },
      stateSecret
    );

    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: ['https://www.googleapis.com/auth/adwords'],
      state,
    });

    res.json({ url, redirectUri });
  } catch (error) {
    console.error('❌ OAuth start error:', error);
    res.status(error.status || 500).json({ error: error.message || 'Erro no OAuth start', details: serializeError(error) });
  }
});

app.get('/api/google-ads/oauth/callback', async (req, res) => {
  try {
    const code = String(req.query.code || '');
    const state = String(req.query.state || '');

    if (!code) {
      return res.status(400).send('Erro: código OAuth não recebido');
    }

    const stateSecret = process.env.OAUTH_STATE_SECRET;
    if (!stateSecret) {
      return res.status(500).send('Erro: OAUTH_STATE_SECRET não configurado');
    }

    const payload = verifyState(state, stateSecret);
    if (!payload?.clientId || !payload?.userId || !payload?.ts) {
      return res.status(400).send('Erro: state inválido');
    }

    // Expira state em 10 minutos
    if (Date.now() - Number(payload.ts) > 10 * 60 * 1000) {
      return res.status(400).send('Erro: state expirado. Inicie o OAuth novamente.');
    }

    // Revalidar ownership
    await requireClientOwnership(payload.clientId, payload.userId);

    const { data: clientCreds } = await supabase
      .from('clients')
      .select('google_ads_client_id, google_ads_client_secret')
      .eq('id', payload.clientId)
      .single();

    const oauthClientId = process.env.GOOGLE_ADS_OAUTH_CLIENT_ID || clientCreds?.google_ads_client_id;
    const oauthClientSecret = process.env.GOOGLE_ADS_OAUTH_CLIENT_SECRET || clientCreds?.google_ads_client_secret;

    const redirectUri =
      process.env.GOOGLE_ADS_OAUTH_REDIRECT_URI ||
      `${getPublicBaseUrl(req)}/api/google-ads/oauth/callback`;

    const oauth2Client = buildOAuthClient({
      clientId: oauthClientId,
      clientSecret: oauthClientSecret,
      redirectUri,
    });

    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      return res
        .status(400)
        .send(
          'Erro: refresh_token não retornou. Garanta access_type=offline e prompt=consent e tente novamente.'
        );
    }

    const { error: updateError } = await supabase
      .from('clients')
      .update({ google_ads_refresh_token: tokens.refresh_token })
      .eq('id', payload.clientId);

    if (updateError) throw updateError;

    const successRedirect =
      (process.env.OAUTH_SUCCESS_REDIRECT || 'http://localhost:3000/manager').replace(/\/$/, '') +
      `?googleAdsConnected=1&clientId=${encodeURIComponent(payload.clientId)}`;

    res.redirect(successRedirect);
  } catch (error) {
    console.error('❌ OAuth callback error:', error);
    const errorRedirectBase = (process.env.OAUTH_ERROR_REDIRECT || 'http://localhost:3000/manager').replace(
      /\/$/,
      ''
    );
    const msg = encodeURIComponent(error.message || 'Erro no OAuth callback');
    res.redirect(`${errorRedirectBase}?googleAdsConnected=0&error=${msg}`);
  }
});

// Teste rápido: valida se refresh_token e customer_id funcionam (faz uma query mínima)
app.post('/api/google-ads/test-connection', async (req, res) => {
  try {
    const { clientId } = req.body;
    if (!clientId) return res.status(400).json({ success: false, error: 'clientId é obrigatório' });

    const user = await requireSupabaseUser(req);
    await requireClientOwnership(clientId, user.id);

    const { data: client, error: clientError } = await supabase.from('clients').select('*').eq('id', clientId).single();
    if (clientError || !client) throw clientError || new Error('Cliente não encontrado');

    if (!client.google_ads_customer_id || !client.google_ads_refresh_token) {
      return res.status(400).json({
        success: false,
        error: 'Credenciais do Google Ads não configuradas (customer_id/refresh_token).',
      });
    }

    const oauthClientId = process.env.GOOGLE_ADS_OAUTH_CLIENT_ID || client.google_ads_client_id;
    const oauthClientSecret = process.env.GOOGLE_ADS_OAUTH_CLIENT_SECRET || client.google_ads_client_secret;
    const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN || client.google_ads_developer_token;

    if (!oauthClientId || !oauthClientSecret || !developerToken) {
      return res.status(400).json({
        success: false,
        error: 'Faltam GOOGLE_ADS_OAUTH_CLIENT_ID/SECRET e/ou Developer Token.',
      });
    }

    const googleAdsClient = new GoogleAdsApi({
      client_id: oauthClientId,
      client_secret: oauthClientSecret,
      developer_token: developerToken,
    });

    const customerConfig = {
      customer_id: String(client.google_ads_customer_id || '').replace(/-/g, ''),
      refresh_token: client.google_ads_refresh_token,
    };
    if (client.google_ads_login_customer_id) {
      customerConfig.login_customer_id = String(client.google_ads_login_customer_id).replace(/-/g, '');
    }

    const customer = googleAdsClient.Customer(customerConfig);
    const query = `
      SELECT
        customer.id,
        customer.descriptive_name,
        customer.currency_code,
        customer.time_zone
      FROM customer
      LIMIT 1
    `;

    const [row] = await customer.query(query);
    res.json({
      success: true,
      customer: {
        id: row.customer.id,
        name: row.customer.descriptive_name,
        currency: row.customer.currency_code,
        timeZone: row.customer.time_zone,
      },
    });
  } catch (error) {
    console.error('❌ test-connection error:', error);
    res
      .status(error.status || 500)
      .json({ success: false, error: error.message, details: serializeError(error) });
  }
});

// Rota para coletar dados do Google Ads
app.post('/api/google-ads/collect', async (req, res) => {
  try {
    const { clientId, days } = req.body;
    if (!clientId) {
      return res.status(400).json({ error: 'clientId é obrigatório' });
    }

    const user = await requireSupabaseUser(req);
    await requireClientOwnership(clientId, user.id);

    console.log(`📡 Coletando dados para cliente: ${clientId}`);

    // Buscar credenciais do cliente
    const { data: clients, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId);

    console.log('Resultado da busca:', { clients, error: clientError });

    if (clientError) throw clientError;

    if (!clients || clients.length === 0) {
      throw new Error('Cliente não encontrado');
    }

    const client = clients[0];

    if (!client.google_ads_customer_id) {
      return res.status(400).json({
        success: false,
        code: 'GOOGLE_ADS_CUSTOMER_ID_MISSING',
        error: 'Google Ads Customer ID não configurado para este cliente.',
        hint: 'Preencha clients.google_ads_customer_id (ex: 477-857-0213).',
      });
    }

    if (!client.google_ads_refresh_token) {
      const publicBaseUrl = getPublicBaseUrl(req);
      return res.status(409).json({
        success: false,
        code: 'GOOGLE_ADS_OAUTH_REQUIRED',
        error: 'Google Ads ainda não conectado para este cliente (refresh_token ausente).',
        oauthStartEndpoint: `${publicBaseUrl}/api/google-ads/oauth/start?clientId=${encodeURIComponent(
          clientId
        )}`,
        redirectUri:
          process.env.GOOGLE_ADS_OAUTH_REDIRECT_URI ||
          `${publicBaseUrl}/api/google-ads/oauth/callback`,
      });
    }

    const oauthClientId = process.env.GOOGLE_ADS_OAUTH_CLIENT_ID || client.google_ads_client_id;
    const oauthClientSecret = process.env.GOOGLE_ADS_OAUTH_CLIENT_SECRET || client.google_ads_client_secret;
    const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN || client.google_ads_developer_token;

    if (!oauthClientId || !oauthClientSecret || !developerToken) {
      return res.status(400).json({
        success: false,
        code: 'GOOGLE_ADS_ENV_INCOMPLETE',
        error: 'Credenciais OAuth/Developer Token do Google Ads estão incompletas.',
        missing: {
          hasOAuthClientId: Boolean(oauthClientId),
          hasOAuthClientSecret: Boolean(oauthClientSecret),
          hasDeveloperToken: Boolean(developerToken),
        },
        hint:
          'Defina GOOGLE_ADS_OAUTH_CLIENT_ID/GOOGLE_ADS_OAUTH_CLIENT_SECRET e GOOGLE_ADS_DEVELOPER_TOKEN no .env (ou preencha as colunas google_ads_* do cliente).',
      });
    }

    // Inicializar cliente Google Ads
    const googleAdsClient = new GoogleAdsApi({
      client_id: oauthClientId,
      client_secret: oauthClientSecret,
      developer_token: developerToken,
    });

    const customerConfig = {
      customer_id: String(client.google_ads_customer_id || '').replace(/-/g, ''),
      refresh_token: client.google_ads_refresh_token,
    };

    if (client.google_ads_login_customer_id) {
      customerConfig.login_customer_id = String(client.google_ads_login_customer_id).replace(/-/g, '');
    }

    const customer = googleAdsClient.Customer(customerConfig);

    // Coletar campanhas dos últimos N dias
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (Number(days) || 30));

    const query = `
      SELECT
        campaign.id,
        campaign.name,
        campaign.status,
        campaign.advertising_channel_type,
        campaign.bidding_strategy_type,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions,
        metrics.conversions_value
      FROM campaign
      WHERE segments.date BETWEEN '${formatDate(startDate)}' AND '${formatDate(endDate)}'
        AND campaign.status != 'REMOVED'
    `;

    console.log('🔍 Executando query...');
    const campaigns = await customer.query(query);
    console.log(`✅ ${campaigns.length} campanhas encontradas`);

    // Processar campanhas
    const campaignsToSave = [];
    for (const row of campaigns) {
      const campaign = row.campaign;
      const metrics = row.metrics;

      const impressions = Number(metrics.impressions) || 0;
      const clicks = Number(metrics.clicks) || 0;
      const costMicros = Number(metrics.cost_micros) || 0;
      const conversions = Number(metrics.conversions) || 0;
      const conversionsValue = Number(metrics.conversions_value) || 0;

      const cost = costMicros / 1000000;
      const ctr = impressions > 0 ? clicks / impressions : 0;
      const avgCpc = clicks > 0 ? cost / clicks : 0;
      const conversionRate = clicks > 0 ? conversions / clicks : 0;
      const cpa = conversions > 0 ? cost / conversions : 0;
      const roas = cost > 0 ? conversionsValue / cost : 0;

      campaignsToSave.push({
        campaign_id: campaign.id.toString(),
        campaign_name: campaign.name,
        campaign_type: campaign.advertising_channel_type,
        campaign_status: campaign.status,
        bidding_strategy: campaign.bidding_strategy_type,
        date_range_start: formatDate(startDate),
        date_range_end: formatDate(endDate),
        impressions,
        clicks,
        cost,
        conversions,
        conversion_value: conversionsValue,
        ctr,
        avg_cpc: avgCpc,
        avg_cost: avgCpc,
        conversion_rate: conversionRate,
        cpa,
        roas,
        client_id: clientId,
      });
    }

    // Salvar no Supabase
    if (campaignsToSave.length > 0) {
      console.log('💾 Salvando no Supabase...');
      const { error: insertError } = await supabase
        .from('google_ads_metrics')
        .upsert(campaignsToSave, {
          onConflict: 'campaign_id,date_range_start,date_range_end,client_id'
        });

      if (insertError) throw insertError;
      console.log(`✅ ${campaignsToSave.length} campanhas salvas`);
    }

    // Coletar keywords
    const keywordsQuery = `
      SELECT
        campaign.id,
        campaign.name,
        ad_group.id,
        ad_group.name,
        ad_group_criterion.keyword.text,
        ad_group_criterion.keyword.match_type,
        ad_group_criterion.status,
        ad_group_criterion.effective_cpc_bid_micros,
        ad_group_criterion.quality_info.quality_score,
        ad_group_criterion.quality_info.creative_quality_score,
        ad_group_criterion.quality_info.post_click_quality_score,
        ad_group_criterion.quality_info.search_predicted_ctr,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions,
        metrics.conversions_value
      FROM keyword_view
      WHERE segments.date BETWEEN '${formatDate(startDate)}' AND '${formatDate(endDate)}'
        AND ad_group_criterion.status != 'REMOVED'
    `;

    console.log('🔍 Coletando keywords...');
    const keywords = await customer.query(keywordsQuery);
    console.log(`✅ ${keywords.length} keywords encontradas`);

    // Processar keywords
    const keywordsToSave = [];
    for (const row of keywords) {
      const campaign = row.campaign;
      const adGroup = row.ad_group;
      const criterion = row.ad_group_criterion;
      const metrics = row.metrics;

      const impressions = Number(metrics.impressions) || 0;
      const clicks = Number(metrics.clicks) || 0;
      const costMicros = Number(metrics.cost_micros) || 0;
      const conversions = Number(metrics.conversions) || 0;
      const conversionsValue = Number(metrics.conversions_value) || 0;

      const cost = costMicros / 1000000;
      const ctr = impressions > 0 ? clicks / impressions : 0;
      const avgCpc = clicks > 0 ? cost / clicks : 0;
      const costPerConversion = conversions > 0 ? cost / conversions : 0;

      keywordsToSave.push({
        campaign_id: campaign.id.toString(),
        campaign_name: campaign.name,
        ad_group_id: adGroup.id.toString(),
        ad_group_name: adGroup.name,
        keyword_text: criterion.keyword.text,
        match_type: criterion.keyword.match_type,
        status: criterion.status,
        cpc_bid: criterion.effective_cpc_bid_micros ? criterion.effective_cpc_bid_micros / 1000000 : 0,
        quality_score: criterion.quality_info?.quality_score || null,
        ad_relevance: criterion.quality_info?.creative_quality_score || null,
        landing_page_experience: criterion.quality_info?.post_click_quality_score || null,
        expected_ctr: criterion.quality_info?.search_predicted_ctr || null,
        date_range_start: formatDate(startDate),
        date_range_end: formatDate(endDate),
        impressions,
        clicks,
        cost,
        conversions,
        conversion_value: conversionsValue,
        ctr,
        avg_cpc: avgCpc,
        cost_per_conversion: costPerConversion,
        client_id: clientId,
      });
    }

    // Salvar keywords no Supabase
    if (keywordsToSave.length > 0) {
      console.log('💾 Salvando keywords no Supabase...');
      const { error: insertError } = await supabase
        .from('google_ads_keywords')
        .upsert(keywordsToSave, {
          onConflict: 'campaign_id,ad_group_id,keyword_text,match_type,date_range_start,date_range_end,client_id'
        });

      if (insertError) throw insertError;
      console.log(`✅ ${keywordsToSave.length} keywords salvas`);
    }

    const extraCounts = {
      ads: 0,
      assets: 0,
      searchTerms: 0,
      audiences: 0,
      apiRecommendations: 0,
    };

    const warnings = [];

    async function safeUpsert(table, rows, onConflict, label) {
      if (!rows || rows.length === 0) return;
      try {
        const { error } = await supabase.from(table).upsert(rows, { onConflict });
        if (error) throw error;
      } catch (err) {
        if (isMissingTableError(err)) {
          warnings.push(`Tabela ausente no Supabase: ${table}. Rode database/google-ads-extra-tables.sql`);
          return;
        }
        warnings.push(`${label || table}: ${err?.message || err}`);
      }
    }

    // ===== Extras: anúncios =====
    try {
      const adsQuery = `
        SELECT
          campaign.id,
          campaign.name,
          ad_group.id,
          ad_group.name,
          ad_group_ad.ad.id,
          ad_group_ad.ad.type,
          ad_group_ad.status,
          metrics.impressions,
          metrics.clicks,
          metrics.cost_micros,
          metrics.conversions,
          metrics.conversions_value
        FROM ad_group_ad
        WHERE segments.date BETWEEN '${formatDate(startDate)}' AND '${formatDate(endDate)}'
          AND ad_group_ad.status != 'REMOVED'
      `;

      const adsRows = await customer.query(adsQuery);
      const adsToSave = adsRows.map((row) => {
        const m = row.metrics || {};
        const cost = (Number(m.cost_micros) || 0) / 1000000;
        return {
          client_id: clientId,
          campaign_id: row.campaign?.id?.toString?.() || String(row.campaign?.id || ''),
          campaign_name: row.campaign?.name || null,
          ad_group_id: row.ad_group?.id?.toString?.() || String(row.ad_group?.id || ''),
          ad_group_name: row.ad_group?.name || null,
          ad_id: row.ad_group_ad?.ad?.id?.toString?.() || String(row.ad_group_ad?.ad?.id || ''),
          ad_type: row.ad_group_ad?.ad?.type || null,
          ad_status: row.ad_group_ad?.status || null,
          date_range_start: formatDate(startDate),
          date_range_end: formatDate(endDate),
          impressions: Number(m.impressions) || 0,
          clicks: Number(m.clicks) || 0,
          cost,
          conversions: Number(m.conversions) || 0,
          conversion_value: Number(m.conversions_value) || 0,
          raw_json: row,
          collected_at: new Date().toISOString(),
        };
      });

      await safeUpsert(
        'google_ads_ads',
        adsToSave,
        'client_id,campaign_id,ad_group_id,ad_id,date_range_start,date_range_end',
        'ads'
      );
      extraCounts.ads = adsToSave.length;
    } catch (err) {
      warnings.push(`ads query: ${err?.message || err}`);
    }

    // ===== Extras: assets (PMax / asset groups) =====
    try {
      const assetsQuery = `
        SELECT
          campaign.id,
          campaign.name,
          asset_group.id,
          asset_group.name,
          asset_group_asset.field_type,
          asset_group_asset.performance_label,
          asset.resource_name,
          asset.id,
          asset.type
        FROM asset_group_asset
      `;

      const assetsRows = await customer.query(assetsQuery);
      const assetsToSave = assetsRows.map((row) => {
        const asset = row.asset || {};
        const assetGroup = row.asset_group || {};
        const aga = row.asset_group_asset || {};
        return {
          client_id: clientId,
          campaign_id: row.campaign?.id?.toString?.() || String(row.campaign?.id || ''),
          campaign_name: row.campaign?.name || null,
          asset_group_id: assetGroup.id?.toString?.() || String(assetGroup.id || ''),
          asset_group_name: assetGroup.name || null,
          asset_id: asset.id?.toString?.() || String(asset.id || ''),
          asset_resource_name: asset.resource_name || null,
          asset_type: asset.type || null,
          field_type: aga.field_type || null,
          performance_label: aga.performance_label || null,
          date_range_start: formatDate(startDate),
          date_range_end: formatDate(endDate),
          impressions: 0,
          clicks: 0,
          cost: 0,
          conversions: 0,
          conversion_value: 0,
          raw_json: row,
          collected_at: new Date().toISOString(),
        };
      });

      await safeUpsert(
        'google_ads_assets',
        assetsToSave,
        'client_id,campaign_id,asset_group_id,asset_resource_name,field_type,date_range_start,date_range_end',
        'assets'
      );
      extraCounts.assets = assetsToSave.length;
    } catch (err) {
      warnings.push(`assets query: ${err?.message || err}`);
    }

    // ===== Extras: termos de pesquisa =====
    try {
      const stQuery = `
        SELECT
          campaign.id,
          campaign.name,
          ad_group.id,
          ad_group.name,
          search_term_view.search_term,
          metrics.impressions,
          metrics.clicks,
          metrics.cost_micros,
          metrics.conversions,
          metrics.conversions_value
        FROM search_term_view
        WHERE segments.date BETWEEN '${formatDate(startDate)}' AND '${formatDate(endDate)}'
      `;

      const stRows = await customer.query(stQuery);
      const stToSave = stRows
        .filter((row) => row.search_term_view?.search_term)
        .map((row) => {
          const m = row.metrics || {};
          const cost = (Number(m.cost_micros) || 0) / 1000000;
          return {
            client_id: clientId,
            campaign_id: row.campaign?.id?.toString?.() || String(row.campaign?.id || ''),
            campaign_name: row.campaign?.name || null,
            ad_group_id: row.ad_group?.id?.toString?.() || String(row.ad_group?.id || ''),
            ad_group_name: row.ad_group?.name || null,
            search_term: row.search_term_view.search_term,
            date_range_start: formatDate(startDate),
            date_range_end: formatDate(endDate),
            impressions: Number(m.impressions) || 0,
            clicks: Number(m.clicks) || 0,
            cost,
            conversions: Number(m.conversions) || 0,
            conversion_value: Number(m.conversions_value) || 0,
            raw_json: row,
            collected_at: new Date().toISOString(),
          };
        });

      await safeUpsert(
        'google_ads_search_terms',
        stToSave,
        'client_id,campaign_id,ad_group_id,search_term,date_range_start,date_range_end',
        'search_terms'
      );
      extraCounts.searchTerms = stToSave.length;
    } catch (err) {
      warnings.push(`search terms query: ${err?.message || err}`);
    }

    // ===== Extras: públicos (user lists) =====
    try {
      const audiencesQuery = `
        SELECT
          user_list.id,
          user_list.name,
          user_list.description,
          user_list.status
        FROM user_list
      `;

      const audRows = await customer.query(audiencesQuery);
      const audToSave = audRows.map((row) => ({
        client_id: clientId,
        user_list_id: row.user_list?.id?.toString?.() || String(row.user_list?.id || ''),
        user_list_name: row.user_list?.name || null,
        user_list_description: row.user_list?.description || null,
        user_list_status: row.user_list?.status || null,
        raw_json: row,
        collected_at: new Date().toISOString(),
      }));

      await safeUpsert('google_ads_audiences', audToSave, 'client_id,user_list_id', 'audiences');
      extraCounts.audiences = audToSave.length;
    } catch (err) {
      warnings.push(`audiences query: ${err?.message || err}`);
    }

    // ===== Extras: recomendações da API =====
    try {
      const recQuery = `
        SELECT
          recommendation.resource_name,
          recommendation.type,
          recommendation.dismissed,
          recommendation.campaign
        FROM recommendation
      `;

      const recRows = await customer.query(recQuery);
      const recToSave = recRows.map((row) => {
        const campaignResource = row.recommendation?.campaign || null;
        const match = campaignResource ? String(campaignResource).match(/campaigns\/(\d+)/) : null;
        const campaign_id = match ? match[1] : null;

        return {
          client_id: clientId,
          recommendation_resource_name: row.recommendation?.resource_name || null,
          recommendation_type: row.recommendation?.type || null,
          dismissed: Boolean(row.recommendation?.dismissed),
          campaign_id,
          raw_json: row,
          collected_at: new Date().toISOString(),
        };
      });

      await safeUpsert(
        'google_ads_api_recommendations',
        recToSave,
        'client_id,recommendation_resource_name',
        'api_recommendations'
      );
      extraCounts.apiRecommendations = recToSave.length;
    } catch (err) {
      warnings.push(`api recommendations query: ${err?.message || err}`);
    }

    res.json({
      success: true,
      campaigns: campaignsToSave.length,
      keywords: keywordsToSave.length,
      ...extraCounts,
      warnings,
      data: campaignsToSave,
    });

  } catch (error) {
    console.error('❌ Erro:', error);
    res.status(error.status || 500).json({
      success: false,
      error: error.message,
      details: serializeError(error),
    });
  }
});

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

app.listen(PORT, () => {
  console.log(`🚀 Servidor Google Ads rodando em http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  logConfigSummary();
});

process.on('unhandledRejection', (reason) => {
  console.error('❌ UnhandledRejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('❌ UncaughtException:', err);
});
