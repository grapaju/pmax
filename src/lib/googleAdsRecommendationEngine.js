import { supabase } from './customSupabaseClient';

/**
 * GoogleAdsRecommendationEngine - Gera recomendações automáticas
 * Baseado na análise de keywords, campanhas e quality scores
 */

export class GoogleAdsRecommendationEngine {
  constructor(campaigns, keywords, analysis) {
    this.campaigns = campaigns || [];
    this.keywords = keywords || [];
    this.analysis = analysis || {};
    this.recommendations = [];
  }

  /**
   * Gera todas as recomendações
   */
  generateAll() {
    this.recommendations = [];

    // Recomendações de keywords
    this.generateKeywordRecommendations();

    // Recomendações de budget
    this.generateBudgetRecommendations();

    // Recomendações de Quality Score
    this.generateQualityScoreRecommendations();

    // Recomendações de performance
    this.generatePerformanceRecommendations();

    return {
      recommendations: this.recommendations,
      summary: this.getSummary(),
      byPriority: this.groupByPriority(),
      byType: this.groupByType(),
    };
  }

  /**
   * Recomendações relacionadas a keywords
   */
  generateKeywordRecommendations() {
    // Pausar keywords desperdiçadoras
    const wastefulKeywords = this.keywords.filter(k => 
      k.cost > 50 && k.conversions === 0 && k.impressions > 100
    );

    wastefulKeywords.forEach(kw => {
      this.recommendations.push({
        type: 'keyword',
        priority: 'alta',
        category: 'budget_waste',
        title: `Pausar keyword "${kw.keyword_text}"`,
        description: `R$ ${kw.cost.toFixed(2)} gastos sem conversões`,
        impact: 'alto',
        estimated_impact_value: kw.cost * 0.8,
        action: `Pausar ou adicionar como palavra negativa em match type amplo`,
        action_type: 'pause_keyword',
        campaign_id: kw.campaign_id,
        ad_group_id: kw.ad_group_id,
        keyword_text: kw.keyword_text,
        related_data: { keyword: kw },
      });
    });

    // Aumentar lances em keywords de alta performance
    const opportunityKeywords = this.keywords.filter(k => 
      k.conversions > 5 && 
      k.ctr >= 0.04 && 
      k.avg_cpc < 3 &&
      k.impressions < 1000
    );

    opportunityKeywords.forEach(kw => {
      const suggestedBid = kw.cpc_bid * 1.3;
      const estimatedImpact = (kw.conversion_value / kw.conversions) * 3;

      this.recommendations.push({
        type: 'keyword',
        priority: 'média',
        category: 'opportunity',
        title: `Aumentar lance em "${kw.keyword_text}"`,
        description: `Boa performance mas volume baixo (${kw.impressions} impressões)`,
        impact: 'médio',
        estimated_impact_value: estimatedImpact,
        action: `Aumentar lance de R$ ${kw.cpc_bid.toFixed(2)} para R$ ${suggestedBid.toFixed(2)} (+30%)`,
        action_type: 'adjust_bid',
        campaign_id: kw.campaign_id,
        ad_group_id: kw.ad_group_id,
        keyword_text: kw.keyword_text,
        related_data: { 
          keyword: kw,
          currentBid: kw.cpc_bid,
          suggestedBid: suggestedBid,
        },
      });
    });

    // Palavras negativas sugeridas
    const lowCtrKeywords = this.keywords.filter(k => 
      k.ctr < 0.01 && 
      k.impressions > 500 &&
      k.clicks < 5 &&
      k.conversions === 0
    );

    lowCtrKeywords.forEach(kw => {
      this.recommendations.push({
        type: 'keyword',
        priority: 'média',
        category: 'negative_keyword',
        title: `Adicionar "${kw.keyword_text}" como negativa`,
        description: `CTR muito baixo: ${(kw.ctr * 100).toFixed(2)}% com ${kw.impressions} impressões`,
        impact: 'médio',
        estimated_impact_value: kw.cost * 0.5,
        action: `Pausar keyword ou adicionar variações como palavras negativas`,
        action_type: 'add_negative',
        campaign_id: kw.campaign_id,
        ad_group_id: kw.ad_group_id,
        keyword_text: kw.keyword_text,
        related_data: { keyword: kw },
      });
    });
  }

  /**
   * Recomendações de orçamento
   */
  generateBudgetRecommendations() {
    this.campaigns.forEach(campaign => {
      const totalCost = campaign.cost || 0;
      const conversions = campaign.conversions || 0;
      const cpa = conversions > 0 ? totalCost / conversions : 0;

      // Campanha sem conversões com gasto alto
      if (totalCost > 200 && conversions === 0) {
        this.recommendations.push({
          type: 'budget',
          priority: 'alta',
          category: 'budget_waste',
          title: `Revisar campanha ${campaign.campaign_name}`,
          description: `R$ ${totalCost.toFixed(2)} gastos sem conversões`,
          impact: 'alto',
          estimated_impact_value: totalCost * 0.7,
          action: `Pausar ou reestruturar completamente a campanha`,
          action_type: 'pause_campaign',
          campaign_id: campaign.campaign_id,
          related_data: { campaign },
        });
      }

      // CPA muito alto
      const benchmarkCpa = 50; // Ajustar conforme seu negócio
      if (conversions > 0 && cpa > benchmarkCpa * 2) {
        this.recommendations.push({
          type: 'budget',
          priority: 'alta',
          category: 'high_cpa',
          title: `CPA elevado em ${campaign.campaign_name}`,
          description: `CPA de R$ ${cpa.toFixed(2)} (benchmark: R$ ${benchmarkCpa})`,
          impact: 'alto',
          estimated_impact_value: (cpa - benchmarkCpa) * conversions,
          action: `Otimizar segmentação e lances para reduzir CPA`,
          action_type: 'optimize_campaign',
          campaign_id: campaign.campaign_id,
          related_data: { 
            campaign,
            currentCpa: cpa,
            benchmarkCpa: benchmarkCpa,
          },
        });
      }
    });
  }

  /**
   * Recomendações de Quality Score
   */
  generateQualityScoreRecommendations() {
    // Keywords com QS muito baixo
    const criticalQS = this.keywords.filter(k => 
      k.quality_score && k.quality_score <= 3 && k.impressions > 100
    );

    criticalQS.forEach(kw => {
      const issues = [];
      
      if (kw.ad_relevance === 'BELOW_AVERAGE') {
        issues.push('Relevância do anúncio abaixo da média');
      }
      if (kw.landing_page_experience === 'BELOW_AVERAGE') {
        issues.push('Experiência da landing page abaixo da média');
      }
      if (kw.expected_ctr === 'BELOW_AVERAGE') {
        issues.push('CTR esperado abaixo da média');
      }

      this.recommendations.push({
        type: 'quality_score',
        priority: 'alta',
        category: 'low_quality_score',
        title: `QS crítico: "${kw.keyword_text}" (${kw.quality_score}/10)`,
        description: `Problemas: ${issues.join(', ')}`,
        impact: 'alto',
        estimated_impact_value: kw.cost * 0.4, // QS baixo aumenta custo
        action: `Melhorar relevância do anúncio e landing page ou pausar keyword`,
        action_type: 'improve_quality_score',
        campaign_id: kw.campaign_id,
        ad_group_id: kw.ad_group_id,
        keyword_text: kw.keyword_text,
        related_data: { 
          keyword: kw,
          issues,
        },
      });
    });

    // Grupos com QS médio baixo
    const keywordsByAdGroup = this.groupKeywordsByAdGroup();
    
    Object.entries(keywordsByAdGroup).forEach(([adGroupId, keywords]) => {
      const avgQS = keywords.reduce((sum, k) => sum + (k.quality_score || 0), 0) / keywords.length;
      
      if (avgQS < 5 && keywords.length >= 5) {
        const adGroup = keywords[0];
        
        this.recommendations.push({
          type: 'quality_score',
          priority: 'média',
          category: 'low_quality_score',
          title: `QS médio baixo no grupo "${adGroup.ad_group_name}"`,
          description: `QS médio de ${avgQS.toFixed(1)}/10 (${keywords.length} keywords)`,
          impact: 'médio',
          estimated_impact_value: 0,
          action: `Revisar estrutura do grupo de anúncios e relevância dos anúncios`,
          action_type: 'optimize_ad_group',
          campaign_id: adGroup.campaign_id,
          ad_group_id: adGroupId,
          related_data: { 
            adGroup,
            avgQualityScore: avgQS,
            keywordCount: keywords.length,
          },
        });
      }
    });
  }

  /**
   * Recomendações de performance geral
   */
  generatePerformanceRecommendations() {
    this.campaigns.forEach(campaign => {
      const ctr = campaign.ctr || 0;
      const conversionRate = campaign.conversion_rate || 0;

      // CTR muito baixo
      if (ctr < 0.02 && campaign.impressions > 1000) {
        this.recommendations.push({
          type: 'ad',
          priority: 'média',
          category: 'low_ctr',
          title: `CTR baixo em ${campaign.campaign_name}`,
          description: `CTR de ${(ctr * 100).toFixed(2)}% (${campaign.impressions} impressões)`,
          impact: 'médio',
          estimated_impact_value: 0,
          action: `Testar novos anúncios com títulos mais atrativos e CTAs claros`,
          action_type: 'improve_ads',
          campaign_id: campaign.campaign_id,
          related_data: { campaign },
        });
      }

      // Taxa de conversão baixa
      if (conversionRate < 0.01 && campaign.clicks > 100) {
        this.recommendations.push({
          type: 'landing_page',
          priority: 'alta',
          category: 'low_conversion_rate',
          title: `Taxa de conversão baixa em ${campaign.campaign_name}`,
          description: `${(conversionRate * 100).toFixed(2)}% de conversão (${campaign.clicks} cliques)`,
          impact: 'alto',
          estimated_impact_value: campaign.clicks * 0.03 * 50, // Estimativa de impacto
          action: `Otimizar landing page: velocidade, clareza da oferta e CTA`,
          action_type: 'improve_landing_page',
          campaign_id: campaign.campaign_id,
          related_data: { campaign },
        });
      }
    });
  }

  /**
   * Agrupa keywords por ad group
   */
  groupKeywordsByAdGroup() {
    const groups = {};
    
    this.keywords.forEach(kw => {
      if (!groups[kw.ad_group_id]) {
        groups[kw.ad_group_id] = [];
      }
      groups[kw.ad_group_id].push(kw);
    });

    return groups;
  }

  /**
   * Agrupa recomendações por prioridade
   */
  groupByPriority() {
    return {
      alta: this.recommendations.filter(r => r.priority === 'alta'),
      média: this.recommendations.filter(r => r.priority === 'média'),
      baixa: this.recommendations.filter(r => r.priority === 'baixa'),
    };
  }

  /**
   * Agrupa recomendações por tipo
   */
  groupByType() {
    const types = {};
    
    this.recommendations.forEach(rec => {
      if (!types[rec.type]) {
        types[rec.type] = [];
      }
      types[rec.type].push(rec);
    });

    return types;
  }

  /**
   * Resumo das recomendações
   */
  getSummary() {
    const totalImpact = this.recommendations.reduce(
      (sum, r) => sum + (r.estimated_impact_value || 0), 
      0
    );

    return {
      total: this.recommendations.length,
      byPriority: {
        alta: this.recommendations.filter(r => r.priority === 'alta').length,
        média: this.recommendations.filter(r => r.priority === 'média').length,
        baixa: this.recommendations.filter(r => r.priority === 'baixa').length,
      },
      byType: {
        keyword: this.recommendations.filter(r => r.type === 'keyword').length,
        budget: this.recommendations.filter(r => r.type === 'budget').length,
        quality_score: this.recommendations.filter(r => r.type === 'quality_score').length,
        ad: this.recommendations.filter(r => r.type === 'ad').length,
        landing_page: this.recommendations.filter(r => r.type === 'landing_page').length,
      },
      estimatedTotalImpact: totalImpact,
    };
  }

  /**
   * Salva recomendações no Supabase
   */
  async saveToSupabase(analysisId, clientId) {
    if (this.recommendations.length === 0) {
      console.warn('Nenhuma recomendação para salvar');
      return { success: false, count: 0 };
    }

    try {
      const records = this.recommendations.map(rec => ({
        analysis_id: analysisId,
        client_id: clientId,
        type: rec.type,
        priority: rec.priority,
        category: rec.category,
        title: rec.title,
        description: rec.description,
        impact: rec.impact,
        estimated_impact_value: rec.estimated_impact_value,
        action: rec.action,
        action_type: rec.action_type,
        campaign_id: rec.campaign_id,
        ad_group_id: rec.ad_group_id,
        keyword_text: rec.keyword_text,
        related_data: rec.related_data,
        status: 'pending',
      }));

      const { data, error } = await supabase
        .from('google_ads_recommendations')
        .insert(records);

      if (error) throw error;

      console.log(`✓ ${this.recommendations.length} recomendações salvas`);
      
      return { success: true, count: this.recommendations.length };
    } catch (error) {
      console.error('Erro ao salvar recomendações:', error.message);
      throw error;
    }
  }
}
