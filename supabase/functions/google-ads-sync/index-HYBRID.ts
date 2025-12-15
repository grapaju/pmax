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

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    
    if (userError || !user) {
        throw new Error("Unauthorized");
    }

    // Buscar credenciais
    const { data: creds, error: credsError } = await supabaseClient
        .from('google_ads_credentials')
        .select('*')
        .eq('user_id', user.id)
        .single();

    // Se não tem credenciais, retorna dados mock
    if (credsError || !creds || !creds.refresh_token) {
        console.warn('⚠️ Sem credenciais - retornando dados MOCK');
        const mockData = generateMockData();
        return new Response(JSON.stringify({ 
          success: true, 
          data: mockData,
          message: "⚠️ Dados de demonstração (configure Google Ads API para dados reais)" 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    console.log('✅ Credenciais encontradas');

    try {
      // Tentar obter access token
      const accessToken = await getAccessToken(creds);
      console.log('✅ Access Token obtido');

      // Tentar chamar API real
      const realData = await callGoogleAdsAPI(accessToken, creds.developer_token, googleAdsId);
      console.log('✅ Dados REAIS da Google Ads API');

      return new Response(JSON.stringify({ 
        success: true, 
        data: realData,
        message: `✅ Sincronizado ${realData.length} dias do Google Ads` 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (apiError) {
      // Se API falhar, retorna mock mas avisa
      console.error('⚠️ Erro na API, usando MOCK:', apiError.message);
      const mockData = generateMockData();
      
      return new Response(JSON.stringify({ 
        success: true, 
        data: mockData,
        message: `⚠️ Google Ads API indisponível (${apiError.message}). Usando dados de demonstração.` 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    console.error('❌ Erro geral:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400
    });
  }
});

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
    throw new Error(`Failed to refresh token: ${errorText}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function callGoogleAdsAPI(accessToken: string, devToken: string, googleAdsId: string): Promise<any[]> {
  const customerIdClean = googleAdsId.replace(/-/g, '');
  
  console.log('🔍 DEBUG: Customer ID original:', googleAdsId);
  console.log('🔍 DEBUG: Customer ID limpo:', customerIdClean);
  console.log('🔍 DEBUG: Developer Token:', devToken?.substring(0, 10) + '...');
  console.log('🔍 DEBUG: Access Token válido:', accessToken ? 'SIM' : 'NÃO');
  
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

  // Testar múltiplas versões da API
  const versions = ['v16', 'v15', 'v14', 'v17'];
  let lastError = null;
  
  for (const version of versions) {
    const url = `https://googleads.googleapis.com/${version}/customers/${customerIdClean}/googleAds:search`;
    console.log(`🔍 Tentando ${version}:`, url);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'developer-token': devToken,
          'login-customer-id': customerIdClean,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query })
      });
      
      console.log(`🔍 ${version} Status:`, response.status);

      if (response.ok) {
        console.log(`✅ ${version} FUNCIONOU!`);
        const adsData = await response.json();
        
        if (!adsData?.results) {
          return [];
        }

        return adsData.results.map((row: any) => ({
          date: row.segments?.date || '',
          impressions: parseInt(row.metrics?.impressions || '0'),
          clicks: parseInt(row.metrics?.clicks || '0'),
          cost: parseInt(row.metrics?.costMicros || '0') / 1000000,
          conversions: parseFloat(row.metrics?.conversions || '0'),
          conversionValue: parseFloat(row.metrics?.conversionsValue || '0'),
        }));
      }
      
      lastError = await response.text();
    } catch (err) {
      console.log(`❌ ${version} erro:`, err.message);
      lastError = err.message;
    }
  }

  throw new Error(`Todas as versões falharam. Último erro: ${lastError?.substring(0, 200)}`);
}

function generateMockData() {
  const data = [];
  const today = new Date();
  for (let i = 29; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const impressions = Math.floor(Math.random() * 2000) + 500;
    const clicks = Math.floor(impressions * (Math.random() * 0.05 + 0.02));
    const cost = clicks * (Math.random() * 2 + 0.5);
    const conversions = Math.floor(clicks * (Math.random() * 0.1));
    const conversionValue = conversions * (Math.random() * 100 + 50);

    data.push({
      date: date.toISOString().split('T')[0],
      clicks,
      impressions,
      cost,
      conversions,
      conversionValue,
    });
  }
  return data;
}
