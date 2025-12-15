// Supabase Edge Function: Google Ads Sync
// Deploy via: supabase functions deploy google-ads-sync

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { campaignId, googleAdsId } = await req.json()

    if (!googleAdsId) {
      throw new Error('Google Ads Customer ID is required')
    }

    // Inicializar Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Buscar credenciais da API do Google Ads do gestor
    const { data: credentials, error: credError } = await supabaseClient
      .from('google_ads_credentials')
      .select('*')
      .single()

    if (credError || !credentials) {
      throw new Error('Google Ads credentials not found. Configure in settings.')
    }

    // 2. Fazer requisição à API do Google Ads
    // Documentação: https://developers.google.com/google-ads/api/docs/start
    
    const response = await fetch(
      `https://googleads.googleapis.com/v15/customers/${googleAdsId}/googleAds:searchStream`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${credentials.access_token}`, // Precisa refresh token flow
          'developer-token': credentials.developer_token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `
            SELECT
              campaign.id,
              campaign.name,
              metrics.impressions,
              metrics.clicks,
              metrics.cost_micros,
              metrics.conversions,
              metrics.conversions_value,
              segments.date
            FROM campaign
            WHERE segments.date DURING LAST_30_DAYS
            ORDER BY segments.date DESC
          `
        })
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Google Ads API error: ${errorText}`)
    }

    const adsData = await response.json()
    
    // 3. Transformar dados da API para o formato esperado
    const transformedData = adsData.results?.map((row: any) => ({
      date: row.segments?.date,
      campaign: row.campaign?.name,
      impressions: parseInt(row.metrics?.impressions || '0'),
      clicks: parseInt(row.metrics?.clicks || '0'),
      cost: parseInt(row.metrics?.cost_micros || '0') / 1000000, // micros para valor real
      conversions: parseFloat(row.metrics?.conversions || '0'),
      conversionValue: parseFloat(row.metrics?.conversions_value || '0'),
    })) || []

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: transformedData,
        count: transformedData.length 
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )

  } catch (error) {
    console.error('Error in google-ads-sync:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      { 
        status: 400,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )
  }
})
