import { corsHeaders } from "./cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { campaignId, googleAdsId } = await req.json();

    if (!googleAdsId) {
      throw new Error("Google Ads Customer ID is required");
    }

    // 1. Get the user from the current session
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    
    if (userError || !user) {
        throw new Error("Unauthorized");
    }

    // 2. Fetch Credentials from DB
    const { data: creds, error: credsError } = await supabaseClient
        .from('google_ads_credentials')
        .select('*')
        .eq('user_id', user.id)
        .single();

    if (credsError || !creds) {
        return new Response(JSON.stringify({ error: "No Google Ads credentials found for this user." }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
        });
    }

    console.log('✅ Credenciais encontradas para usuário:', user.id);

    // 3. Get fresh Access Token using Refresh Token
    const accessToken = await getAccessToken(creds);
    console.log('✅ Access Token obtido');

    // 4. Call Google Ads API
    const customerIdClean = googleAdsId.replace(/-/g, ''); // Remove hífens: 123-456-7890 → 1234567890
    
    const query = `
      SELECT
        segments.date,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions,
        metrics.conversions_value
      FROM campaign
      WHERE segments.date DURING LAST_30_DAYS
      ORDER BY segments.date DESC
    `;

    console.log('🔍 Chamando Google Ads API para customer:', customerIdClean);

    const response = await fetch(
      `https://googleads.googleapis.com/v17/customers/${customerIdClean}/googleAds:search`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'developer-token': creds.developer_token,
          'login-customer-id': customerIdClean,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Erro da Google Ads API:', errorText);
      throw new Error(`Google Ads API error: ${errorText}`);
    }

    const adsData = await response.json();
    console.log('✅ Dados recebidos da Google Ads API');

    // 5. Transform data to expected format
    const transformedData = transformGoogleAdsData(adsData);

    return new Response(JSON.stringify({ 
      success: true, 
      data: transformedData,
      message: `Synced ${transformedData.length} days of data from Google Ads` 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Erro na sincronização:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400
    });
  }
});

// Função para renovar Access Token usando Refresh Token
async function getAccessToken(creds: any): Promise<string> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: creds.client_id_val,
      client_secret: creds.client_secret,
      refresh_token: creds.refresh_token,
      grant_type: 'refresh_token'
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to refresh access token: ${errorText}`);
  }

  const data = await response.json();
  return data.access_token;
}

// Transforma dados da API do Google Ads para o formato esperado
function transformGoogleAdsData(adsData: any): any[] {
  if (!adsData || !adsData.results) {
    return [];
  }

  const results = adsData.results || [];

  return results.map((row: any) => ({
    date: row.segments?.date || '',
    impressions: parseInt(row.metrics?.impressions || '0'),
    clicks: parseInt(row.metrics?.clicks || '0'),
    cost: parseInt(row.metrics?.costMicros || '0') / 1000000, // micros para reais
    conversions: parseFloat(row.metrics?.conversions || '0'),
    conversionValue: parseFloat(row.metrics?.conversionsValue || '0'),
  }));
}
