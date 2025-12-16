import { supabase } from '@/lib/customSupabaseClient';

function toYmd(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function periodToDateRange(period) {
  // period examples used in the app: '7d', '15d', '30d', '60d', '90d'
  // CampaignDashboard internal selector: 'all' | '30d' | '7d'
  if (!period || period === 'all') return null;

  const days = Number(String(period).replace(/\D/g, ''));
  if (!Number.isFinite(days) || days <= 0) return null;

  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);

  return { start: toYmd(start), end: toYmd(end) };
}

function sumByClientId(rows) {
  const out = new Map();
  for (const r of rows || []) {
    const clientId = r.client_id;
    if (!clientId) continue;

    const curr = out.get(clientId) || {
      spend: 0,
      impressions: 0,
      clicks: 0,
      conversions: 0,
      conversionValue: 0,
    };

    curr.spend += Number(r.cost || 0);
    curr.impressions += Number(r.impressions || 0);
    curr.clicks += Number(r.clicks || 0);
    curr.conversions += Number(r.conversions || 0);
    curr.conversionValue += Number(r.conversion_value || 0);

    out.set(clientId, curr);
  }
  return out;
}

export async function fetchGoogleAdsTotalsByClientIds(clientIds, period) {
  const ids = (clientIds || []).filter(Boolean);
  if (ids.length === 0) return new Map();

  const range = periodToDateRange(period);

  let q = supabase
    .from('google_ads_metrics')
    .select('client_id, cost, impressions, clicks, conversions, conversion_value');

  q = q.in('client_id', ids);

  if (range) {
    q = q.gte('date_range_start', range.start).lte('date_range_start', range.end);
  }

  const { data, error } = await q;
  if (error) throw error;

  return sumByClientId(data || []);
}

export async function fetchGoogleAdsCampaignsByClientId(clientId) {
  if (!clientId) return [];

  const { data, error } = await supabase
    .from('google_ads_campaigns')
    .select('campaign_id, campaign_name, campaign_status, advertising_channel_type, campaign_type, collected_at')
    .eq('client_id', clientId)
    .order('campaign_name', { ascending: true });

  if (error) throw error;

  return (data || []).map((c) => ({
    id: c.campaign_id,
    name: c.campaign_name,
    status: c.campaign_status,
    channel: c.advertising_channel_type,
    type: c.campaign_type,
    collectedAt: c.collected_at,
  }));
}

function chunkIntoTrends(rows, maxPoints = 6) {
  if (!rows || rows.length === 0) return [];

  const points = Math.min(maxPoints, Math.max(1, rows.length));
  const chunkSize = Math.ceil(rows.length / points);

  const trends = [];
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);

    let spend = 0;
    let conversions = 0;
    let conversionValue = 0;

    for (const r of chunk) {
      spend += Number(r.cost || 0);
      conversions += Number(r.conversions || 0);
      conversionValue += Number(r.conversion_value || 0);
    }

    const roas = spend > 0 ? conversionValue / spend : 0;

    trends.push({
      month: `Wk${trends.length + 1}`,
      roas: Number.isFinite(roas) ? roas : 0,
      conversions: Math.round(conversions),
      spend,
    });
  }

  return trends;
}

export function buildCampaignDashboardDataFromMetrics(metricsRows, { start, end } = {}) {
  const rows = metricsRows || [];

  const totals = rows.reduce(
    (acc, r) => {
      acc.spend += Number(r.cost || 0);
      acc.conversions += Number(r.conversions || 0);
      acc.value += Number(r.conversion_value || 0);
      acc.clicks += Number(r.clicks || 0);
      acc.impressions += Number(r.impressions || 0);
      return acc;
    },
    { spend: 0, conversions: 0, value: 0, clicks: 0, impressions: 0 }
  );

  const roas = totals.spend > 0 ? totals.value / totals.spend : 0;
  const cpa = totals.conversions > 0 ? totals.spend / totals.conversions : 0;
  const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
  const cpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0;

  const periodStart = start || rows[0]?.date_range_start || 'N/A';
  const periodEnd = end || rows[rows.length - 1]?.date_range_start || 'N/A';

  return {
    totals: {
      ...totals,
      roas,
      cpa,
      ctr,
      cpc,
    },
    targets: { roas: 4, cpa: 30, budget: 5000 },
    trends: chunkIntoTrends(rows, 6),
    raw: rows.map((r) => ({
      date: r.date_range_start,
      spend: Number(r.cost || 0),
      conversions: Number(r.conversions || 0),
      value: Number(r.conversion_value || 0),
      clicks: Number(r.clicks || 0),
      impressions: Number(r.impressions || 0),
    })),
    meta: {
      periodStart,
      periodEnd,
      uploadDate: new Date().toISOString(),
    },
  };
}

export async function fetchCampaignDashboardData({ clientId, period, campaignId }) {
  if (!clientId) return null;

  const range = periodToDateRange(period);

  let q = supabase
    .from('google_ads_metrics')
    .select('date_range_start, cost, impressions, clicks, conversions, conversion_value')
    .eq('client_id', clientId)
    .order('date_range_start', { ascending: true });

  if (campaignId) {
    q = q.eq('campaign_id', String(campaignId));
  }

  if (range) {
    q = q.gte('date_range_start', range.start).lte('date_range_start', range.end);
  }

  const { data, error } = await q;
  if (error) throw error;

  return buildCampaignDashboardDataFromMetrics(data || [], range || undefined);
}
