import { supabase } from '@/lib/customSupabaseClient';
import { fetchWithSupabaseAuth } from '@/lib/nodeAuthFetch';

function normalizeBaseUrl(url) {
  return String(url || '').trim().replace(/\/+$/g, '');
}

function getNodeBaseUrl() {
  // Preferência: VITE_GOOGLE_ADS_NODE_URL
  // Compat: VITE_API_BASE_URL (se você já usa esse nome no Render)
  const raw =
    import.meta.env.VITE_GOOGLE_ADS_NODE_URL ||
    import.meta.env.VITE_API_BASE_URL ||
    'http://localhost:3001';
  return normalizeBaseUrl(raw);
}

export function getGoogleAdsNodeBaseUrl() {
  return getNodeBaseUrl();
}

/**
 * Coleta dados do Google Ads e salva no Supabase.
 * Preferência:
 * - Modo padrão: Supabase Edge Function `google-ads-collect`
 * - Opcional (dev): Node server local (VITE_GOOGLE_ADS_COLLECT_MODE=node)
 */
export async function collectGoogleAdsData({ clientId, days = 30 }) {
  if (!clientId) throw new Error('clientId é obrigatório');

  const mode = (import.meta.env.VITE_GOOGLE_ADS_COLLECT_MODE || 'node').toLowerCase();

  if (mode !== 'edge') {
    const url = `${getNodeBaseUrl()}/api/google-ads/collect`;
    const res = await fetchWithSupabaseAuth(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, days }),
    });

    const payload = await res.json().catch(() => ({}));
    if (!res.ok || payload?.success === false) {
      throw new Error(payload?.error || `Erro ao coletar (HTTP ${res.status})`);
    }

    return payload;
  }

  const { data, error } = await supabase.functions.invoke('google-ads-collect', {
    body: { clientId, days },
  });

  if (error) {
    throw new Error(error.message || 'Erro ao chamar Edge Function google-ads-collect');
  }

  if (!data?.success) {
    throw new Error(data?.error || 'Erro desconhecido na coleta');
  }

  return data;
}

export async function testGoogleAdsConnection({ clientId }) {
  if (!clientId) throw new Error('clientId é obrigatório');
  const url = `${getNodeBaseUrl()}/api/google-ads/test-connection`;
  const res = await fetchWithSupabaseAuth(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId }),
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok || payload?.success === false) {
    throw new Error(payload?.error || `Falha no teste (HTTP ${res.status})`);
  }
  return payload;
}

export async function downloadGoogleAdsCsv({ clientId, table = 'metrics', campaignId = null, start = null, end = null }) {
  if (!clientId) throw new Error('clientId é obrigatório');

  const url = new URL(`${getNodeBaseUrl()}/api/google-ads/export-csv`);
  url.searchParams.set('clientId', clientId);
  url.searchParams.set('table', table);
  if (campaignId) url.searchParams.set('campaignId', campaignId);
  if (start) url.searchParams.set('start', start);
  if (end) url.searchParams.set('end', end);

  const res = await fetchWithSupabaseAuth(url.toString(), { method: 'GET' });

  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    throw new Error(payload?.error || `Falha ao exportar CSV (HTTP ${res.status})`);
  }

  if (table === 'all') {
    const payload = await res.json().catch(() => ({}));
    if (!payload?.success || !Array.isArray(payload.files)) {
      throw new Error(payload?.error || 'Resposta inválida ao exportar CSV (all)');
    }

    const files = payload.files.map((f) => {
      const bytes = Uint8Array.from(atob(f.contentBase64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: 'text/csv;charset=utf-8' });
      return { blob, filename: f.filename, table: f.table, rows: f.rows };
    });

    return { files };
  }

  const blob = await res.blob();
  const stamp = new Date().toISOString().slice(0, 10);
  const safeTable = table === 'keywords' ? 'keywords' : 'metrics';
  const filename = `google_ads_${safeTable}_${clientId}_${stamp}.csv`;
  return { blob, filename };
}

export async function downloadGoogleAdsExportZip({ clientId, campaignId = null, start = null, end = null }) {
  if (!clientId) throw new Error('clientId é obrigatório');

  const url = new URL(`${getNodeBaseUrl()}/api/google-ads/export-zip`);
  url.searchParams.set('clientId', clientId);
  if (campaignId) url.searchParams.set('campaignId', campaignId);
  if (start) url.searchParams.set('start', start);
  if (end) url.searchParams.set('end', end);

  const res = await fetchWithSupabaseAuth(url.toString(), { method: 'GET' });
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    throw new Error(payload?.error || `Falha ao exportar ZIP (HTTP ${res.status})`);
  }

  const blob = await res.blob();
  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `google_ads_export_${clientId}_${stamp}.zip`;
  return { blob, filename };
}
