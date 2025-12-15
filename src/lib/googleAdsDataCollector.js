import { getCustomer, getDateRange, microsToUnits } from './googleAdsClient';
import { supabase } from './customSupabaseClient';

/**
 * DataCollector - Coleta dados da Google Ads API e salva no Supabase
 * Adaptado do corcril-ads para usar Supabase ao invés de MongoDB
 */

export class GoogleAdsDataCollector {
  constructor(customerId, refreshToken, loginCustomerId = null, clientId = null) {
    this.customerId = customerId;
    this.refreshToken = refreshToken;
    this.loginCustomerId = loginCustomerId;
    this.clientId = clientId;
    this.customer = null;
    this.dateRange = null;
  }

  /**
   * Inicializa o collector
   */
  initialize() {
    this.customer = getCustomer(this.customerId, this.refreshToken, this.loginCustomerId);
    console.log('✓ DataCollector initialized for customer:', this.customerId);
  }

  /**
   * Define o range de datas para coleta
   */
  setDateRange(days = 30) {
    this.dateRange = getDateRange(days);
    return this.dateRange;
  }

  /**
   * Coleta dados de campanhas
   */
  async collectCampaigns() {
    if (!this.dateRange) {
      this.setDateRange();
    }

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
        metrics.conversions_value,
        metrics.average_cpc,
        metrics.ctr,
        metrics.average_cost
      FROM campaign
      WHERE segments.date BETWEEN '${this.dateRange.startDate}' AND '${this.dateRange.endDate}'
        AND campaign.status = 'ENABLED'
      ORDER BY metrics.impressions DESC
    `;

    try {
      console.log('📊 Coletando campanhas...');
      const results = await this.customer.query(query);
      
      // Agrupar métricas por campanha
      const campaignMap = new Map();
      
      results.forEach(row => {
        const campaign = row.campaign;
        const metrics = row.metrics;
        const campaignId = campaign.id;
        
        if (!campaignMap.has(campaignId)) {
          campaignMap.set(campaignId, {
            campaign_id: campaignId,
            campaign_name: campaign.name,
            campaign_type: campaign.advertising_channel_type,
            campaign_status: campaign.status,
            bidding_strategy: campaign.bidding_strategy_type,
            impressions: 0,
            clicks: 0,
            cost: 0,
            conversions: 0,
            conversion_value: 0,
          });
        }
        
        const data = campaignMap.get(campaignId);
        data.impressions += Number(metrics.impressions || 0);
        data.clicks += Number(metrics.clicks || 0);
        data.cost += microsToUnits(metrics.cost_micros || 0);
        data.conversions += Number(metrics.conversions || 0);
        data.conversion_value += Number(metrics.conversions_value || 0);
      });

      const campaigns = Array.from(campaignMap.values());
      
      // Calcular métricas derivadas
      campaigns.forEach(c => {
        c.ctr = c.impressions > 0 ? c.clicks / c.impressions : 0;
        c.avg_cpc = c.clicks > 0 ? c.cost / c.clicks : 0;
        c.avg_cost = c.impressions > 0 ? c.cost / c.impressions : 0;
        c.conversion_rate = c.clicks > 0 ? c.conversions / c.clicks : 0;
        c.cpa = c.conversions > 0 ? c.cost / c.conversions : 0;
        c.roas = c.cost > 0 ? c.conversion_value / c.cost : 0;
      });

      console.log(`✓ Coletadas ${campaigns.length} campanhas`);
      return campaigns;
    } catch (error) {
      console.error('Erro ao coletar campanhas:', error.message);
      throw error;
    }
  }

  /**
   * Coleta dados de palavras-chave com Quality Score
   */
  async collectKeywords(campaignId = null) {
    if (!this.dateRange) {
      this.setDateRange();
    }

    let whereClause = `
      segments.date BETWEEN '${this.dateRange.startDate}' AND '${this.dateRange.endDate}'
      AND ad_group_criterion.type = 'KEYWORD'
      AND ad_group.status = 'ENABLED'
    `;
    
    if (campaignId) {
      whereClause += ` AND campaign.id = ${campaignId}`;
    }

    const query = `
      SELECT
        campaign.id,
        campaign.name,
        ad_group.id,
        ad_group.name,
        ad_group_criterion.criterion_id,
        ad_group_criterion.keyword.text,
        ad_group_criterion.keyword.match_type,
        ad_group_criterion.status,
        ad_group_criterion.quality_info.quality_score,
        ad_group_criterion.quality_info.creative_quality_score,
        ad_group_criterion.quality_info.post_click_quality_score,
        ad_group_criterion.quality_info.search_predicted_ctr,
        ad_group_criterion.cpc_bid_micros,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions,
        metrics.conversions_value,
        metrics.ctr,
        metrics.average_cpc,
        metrics.cost_per_conversion
      FROM keyword_view
      WHERE ${whereClause}
      ORDER BY metrics.impressions DESC
    `;

    try {
      console.log('🔑 Coletando palavras-chave...');
      const results = await this.customer.query(query);
      
      // Agrupar métricas por keyword
      const keywordMap = new Map();
      
      results.forEach(row => {
        const criterion = row.ad_group_criterion;
        const metrics = row.metrics;
        const keywordKey = `${row.campaign.id}-${row.ad_group.id}-${criterion.criterion_id}`;
        
        if (!keywordMap.has(keywordKey)) {
          keywordMap.set(keywordKey, {
            campaign_id: row.campaign.id,
            campaign_name: row.campaign.name,
            ad_group_id: row.ad_group.id,
            ad_group_name: row.ad_group.name,
            keyword_text: criterion.keyword?.text || '',
            match_type: criterion.keyword?.match_type || '',
            status: criterion.status,
            cpc_bid: microsToUnits(criterion.cpc_bid_micros || 0),
            quality_score: criterion.quality_info?.quality_score || null,
            ad_relevance: criterion.quality_info?.creative_quality_score || null,
            landing_page_experience: criterion.quality_info?.post_click_quality_score || null,
            expected_ctr: criterion.quality_info?.search_predicted_ctr || null,
            impressions: 0,
            clicks: 0,
            cost: 0,
            conversions: 0,
            conversion_value: 0,
          });
        }
        
        const data = keywordMap.get(keywordKey);
        data.impressions += Number(metrics.impressions || 0);
        data.clicks += Number(metrics.clicks || 0);
        data.cost += microsToUnits(metrics.cost_micros || 0);
        data.conversions += Number(metrics.conversions || 0);
        data.conversion_value += Number(metrics.conversions_value || 0);
      });

      const keywords = Array.from(keywordMap.values());
      
      // Calcular métricas derivadas
      keywords.forEach(k => {
        k.ctr = k.impressions > 0 ? k.clicks / k.impressions : 0;
        k.avg_cpc = k.clicks > 0 ? k.cost / k.clicks : 0;
        k.cost_per_conversion = k.conversions > 0 ? k.cost / k.conversions : 0;
      });

      console.log(`✓ Coletadas ${keywords.length} palavras-chave`);
      return keywords;
    } catch (error) {
      console.error('Erro ao coletar keywords:', error.message);
      throw error;
    }
  }

  /**
   * Salva métricas de campanhas no Supabase
   */
  async saveCampaignMetrics(campaigns) {
    if (!campaigns || campaigns.length === 0) {
      console.warn('Nenhuma campanha para salvar');
      return { success: false, count: 0 };
    }

    try {
      const records = campaigns.map(c => ({
        campaign_id: c.campaign_id,
        campaign_name: c.campaign_name,
        campaign_type: c.campaign_type,
        campaign_status: c.campaign_status,
        bidding_strategy: c.bidding_strategy,
        date_range_start: this.dateRange.startDateObj,
        date_range_end: this.dateRange.endDateObj,
        impressions: c.impressions,
        clicks: c.clicks,
        cost: c.cost,
        conversions: c.conversions,
        conversion_value: c.conversion_value,
        ctr: c.ctr,
        avg_cpc: c.avg_cpc,
        avg_cost: c.avg_cost,
        conversion_rate: c.conversion_rate,
        cpa: c.cpa,
        roas: c.roas,
        client_id: this.clientId,
      }));

      const { data, error } = await supabase
        .from('google_ads_metrics')
        .upsert(records, {
          onConflict: 'campaign_id,date_range_start,date_range_end,client_id',
          ignoreDuplicates: false,
        });

      if (error) throw error;

      console.log(`✓ ${campaigns.length} campanhas salvas no Supabase`);
      
      // Log da atividade
      await this.logActivity('collect_metrics', 'campaign', null, 'success', `${campaigns.length} campanhas coletadas`);
      
      return { success: true, count: campaigns.length };
    } catch (error) {
      console.error('Erro ao salvar métricas:', error.message);
      await this.logActivity('collect_metrics', 'campaign', null, 'error', error.message);
      throw error;
    }
  }

  /**
   * Salva palavras-chave no Supabase
   */
  async saveKeywords(keywords) {
    if (!keywords || keywords.length === 0) {
      console.warn('Nenhuma keyword para salvar');
      return { success: false, count: 0 };
    }

    try {
      const records = keywords.map(k => ({
        campaign_id: k.campaign_id,
        campaign_name: k.campaign_name,
        ad_group_id: k.ad_group_id,
        ad_group_name: k.ad_group_name,
        keyword_text: k.keyword_text,
        match_type: k.match_type,
        status: k.status,
        cpc_bid: k.cpc_bid,
        quality_score: k.quality_score,
        ad_relevance: k.ad_relevance,
        landing_page_experience: k.landing_page_experience,
        expected_ctr: k.expected_ctr,
        date_range_start: this.dateRange.startDateObj,
        date_range_end: this.dateRange.endDateObj,
        impressions: k.impressions,
        clicks: k.clicks,
        cost: k.cost,
        conversions: k.conversions,
        conversion_value: k.conversion_value,
        ctr: k.ctr,
        avg_cpc: k.avg_cpc,
        cost_per_conversion: k.cost_per_conversion,
        client_id: this.clientId,
      }));

      const { data, error } = await supabase
        .from('google_ads_keywords')
        .upsert(records, {
          onConflict: 'campaign_id,ad_group_id,keyword_text,match_type,date_range_start,date_range_end,client_id',
          ignoreDuplicates: false,
        });

      if (error) throw error;

      console.log(`✓ ${keywords.length} keywords salvas no Supabase`);
      
      await this.logActivity('collect_keywords', 'keyword', null, 'success', `${keywords.length} keywords coletadas`);
      
      return { success: true, count: keywords.length };
    } catch (error) {
      console.error('Erro ao salvar keywords:', error.message);
      await this.logActivity('collect_keywords', 'keyword', null, 'error', error.message);
      throw error;
    }
  }

  /**
   * Coleta tudo e salva no Supabase
   */
  async collectAndSaveAll(days = 30) {
    try {
      const startTime = Date.now();
      
      this.initialize();
      this.setDateRange(days);

      // Coletar campanhas
      const campaigns = await this.collectCampaigns();
      await this.saveCampaignMetrics(campaigns);

      // Coletar keywords
      const keywords = await this.collectKeywords();
      await this.saveKeywords(keywords);

      const duration = Date.now() - startTime;

      console.log(`\n✓ Coleta completa em ${duration}ms`);
      console.log(`  - ${campaigns.length} campanhas`);
      console.log(`  - ${keywords.length} keywords`);

      return {
        success: true,
        campaigns,
        keywords,
        duration,
      };
    } catch (error) {
      console.error('Erro na coleta completa:', error.message);
      throw error;
    }
  }

  /**
   * Registra atividade no log
   */
  async logActivity(action, entityType, entityId, status, message, errorDetails = null) {
    try {
      const { error } = await supabase
        .from('google_ads_activity_log')
        .insert({
          client_id: this.clientId,
          action,
          entity_type: entityType,
          entity_id: entityId,
          status,
          message,
          error_details: errorDetails,
        });

      if (error) console.warn('Erro ao registrar log:', error.message);
    } catch (err) {
      console.warn('Erro ao registrar log:', err.message);
    }
  }
}
