/**
 * GoogleAdsAnalyzer - Analisa dados de Keywords e Quality Score
 * Adaptado do corcril-ads para usar dados do Supabase
 */

export class KeywordAnalyzer {
  constructor(keywords) {
    this.keywords = keywords || [];
    this.thresholds = {
      minQualityScore: 5,
      minCtr: 0.02, // 2%
      maxCpc: 5.0,
      minImpressions: 100,
      minConversionRate: 0.01, // 1%
      maxCostWithoutConversions: 50, // R$ 50
    };
  }

  /**
   * Analisa performance de todas as keywords
   */
  analyzeAll() {
    return {
      performance: this.analyzePerformance(),
      opportunities: this.findOpportunities(),
      wasteful: this.findWastefulKeywords(),
      summary: this.getSummary(),
    };
  }

  /**
   * Analisa performance das keywords
   */
  analyzePerformance() {
    const highPerformers = [];
    const lowPerformers = [];
    const noData = [];

    this.keywords.forEach(kw => {
      if (kw.impressions < this.thresholds.minImpressions) {
        noData.push(kw);
        return;
      }

      const score = this.calculatePerformanceScore(kw);
      
      if (score >= 70) {
        highPerformers.push({ ...kw, performanceScore: score });
      } else if (score < 40) {
        lowPerformers.push({ ...kw, performanceScore: score });
      }
    });

    return {
      highPerformers: highPerformers.sort((a, b) => b.performanceScore - a.performanceScore),
      lowPerformers: lowPerformers.sort((a, b) => a.performanceScore - b.performanceScore),
      noData,
    };
  }

  /**
   * Calcula score de performance (0-100)
   */
  calculatePerformanceScore(kw) {
    let score = 0;

    // CTR (30 pontos)
    if (kw.ctr >= 0.05) score += 30;
    else if (kw.ctr >= 0.03) score += 20;
    else if (kw.ctr >= 0.02) score += 10;

    // Quality Score (25 pontos)
    if (kw.quality_score >= 8) score += 25;
    else if (kw.quality_score >= 6) score += 15;
    else if (kw.quality_score >= 4) score += 5;

    // Conversões (25 pontos)
    if (kw.conversions > 10) score += 25;
    else if (kw.conversions > 5) score += 20;
    else if (kw.conversions > 1) score += 15;
    else if (kw.conversions > 0) score += 10;

    // CPC (10 pontos)
    if (kw.avg_cpc < 1) score += 10;
    else if (kw.avg_cpc < 2) score += 7;
    else if (kw.avg_cpc < 3) score += 5;

    // ROAS ou CPA (10 pontos)
    const conversionValue = kw.conversion_value || 0;
    if (kw.conversions > 0) {
      const roas = kw.cost > 0 ? conversionValue / kw.cost : 0;
      if (roas >= 3) score += 10;
      else if (roas >= 2) score += 7;
      else if (roas >= 1) score += 5;
    }

    return Math.min(score, 100);
  }

  /**
   * Encontra oportunidades de expansão
   */
  findOpportunities() {
    const opportunities = [];

    this.keywords.forEach(kw => {
      if (kw.impressions < this.thresholds.minImpressions) return;

      const reasons = [];

      // Alto CTR mas poucas impressões
      if (kw.ctr >= 0.04 && kw.impressions < 1000) {
        reasons.push('Alto CTR, aumentar lances para mais impressões');
      }

      // Boa taxa de conversão mas baixo volume
      const convRate = kw.clicks > 0 ? kw.conversions / kw.clicks : 0;
      if (convRate >= 0.05 && kw.clicks < 100) {
        reasons.push('Boa taxa de conversão, expandir para mais cliques');
      }

      // Quality Score alto mas posição baixa
      if (kw.quality_score >= 8 && kw.avg_cpc < this.thresholds.maxCpc / 2) {
        reasons.push('QS alto, pode aumentar lance com bom custo-benefício');
      }

      // Match type muito restritivo com bom desempenho
      if (kw.match_type === 'EXACT' && kw.conversions > 3 && kw.ctr >= 0.03) {
        reasons.push('Testar match type PHRASE para expandir alcance');
      }

      if (reasons.length > 0) {
        opportunities.push({
          ...kw,
          opportunityReasons: reasons,
          potentialImpact: this.estimateOpportunityImpact(kw),
        });
      }
    });

    return opportunities.sort((a, b) => b.potentialImpact - a.potentialImpact);
  }

  /**
   * Estima impacto de uma oportunidade (0-100)
   */
  estimateOpportunityImpact(kw) {
    let impact = 0;

    // Base no volume atual
    if (kw.clicks > 50) impact += 30;
    else if (kw.clicks > 20) impact += 20;
    else impact += 10;

    // Base na performance
    const convRate = kw.clicks > 0 ? kw.conversions / kw.clicks : 0;
    if (convRate >= 0.05) impact += 40;
    else if (convRate >= 0.02) impact += 25;
    else if (kw.ctr >= 0.05) impact += 15;

    // Base no QS
    if (kw.quality_score >= 8) impact += 20;
    else if (kw.quality_score >= 6) impact += 10;

    // Base no potencial de crescimento
    if (kw.impressions < 500) impact += 10;

    return Math.min(impact, 100);
  }

  /**
   * Encontra keywords desperdiçando budget
   */
  findWastefulKeywords() {
    const wasteful = [];

    this.keywords.forEach(kw => {
      if (kw.impressions < this.thresholds.minImpressions) return;

      const reasons = [];
      let wasteScore = 0;

      // Gasto sem conversões
      if (kw.cost > this.thresholds.maxCostWithoutConversions && kw.conversions === 0) {
        reasons.push(`R$ ${kw.cost.toFixed(2)} gastos sem conversões`);
        wasteScore += 40;
      }

      // CTR muito baixo
      if (kw.ctr < 0.01 && kw.impressions > 1000) {
        reasons.push(`CTR muito baixo: ${(kw.ctr * 100).toFixed(2)}%`);
        wasteScore += 25;
      }

      // Quality Score muito baixo
      if (kw.quality_score && kw.quality_score < 3) {
        reasons.push(`Quality Score crítico: ${kw.quality_score}/10`);
        wasteScore += 25;
      }

      // CPC muito alto sem retorno
      if (kw.avg_cpc > this.thresholds.maxCpc && kw.conversions < 1) {
        reasons.push(`CPC alto sem conversões: R$ ${kw.avg_cpc.toFixed(2)}`);
        wasteScore += 30;
      }

      // Muitos cliques sem conversão
      if (kw.clicks > 50 && kw.conversions === 0) {
        reasons.push(`${kw.clicks} cliques sem conversão`);
        wasteScore += 20;
      }

      if (reasons.length > 0 && wasteScore >= 30) {
        wasteful.push({
          ...kw,
          wasteReasons: reasons,
          wasteScore: Math.min(wasteScore, 100),
          estimatedWaste: this.estimateWastedBudget(kw),
        });
      }
    });

    return wasteful.sort((a, b) => b.wasteScore - a.wasteScore);
  }

  /**
   * Estima budget desperdiçado
   */
  estimateWastedBudget(kw) {
    // Se não tem conversão, considera 80% do custo como desperdício
    if (kw.conversions === 0) {
      return kw.cost * 0.8;
    }

    // Se tem conversão mas CPA muito alto, calcula desperdício
    const avgCpa = kw.cost / kw.conversions;
    const benchmarkCpa = kw.conversion_value / kw.conversions || avgCpa * 0.5;
    
    if (avgCpa > benchmarkCpa * 2) {
      return (avgCpa - benchmarkCpa) * kw.conversions;
    }

    return 0;
  }

  /**
   * Gera resumo da análise
   */
  getSummary() {
    const total = this.keywords.length;
    
    if (total === 0) {
      return {
        total: 0,
        withData: 0,
        highPerformers: 0,
        lowPerformers: 0,
        opportunities: 0,
        wasteful: 0,
        averages: {},
      };
    }

    const withData = this.keywords.filter(k => k.impressions >= this.thresholds.minImpressions);
    
    const totalCost = this.keywords.reduce((sum, k) => sum + (k.cost || 0), 0);
    const totalClicks = this.keywords.reduce((sum, k) => sum + (k.clicks || 0), 0);
    const totalConversions = this.keywords.reduce((sum, k) => sum + (k.conversions || 0), 0);
    const totalImpressions = this.keywords.reduce((sum, k) => sum + (k.impressions || 0), 0);
    
    const keywordsWithQS = this.keywords.filter(k => k.quality_score);
    const avgQualityScore = keywordsWithQS.length > 0
      ? keywordsWithQS.reduce((sum, k) => sum + k.quality_score, 0) / keywordsWithQS.length
      : 0;

    return {
      total,
      withData: withData.length,
      highPerformers: this.analyzePerformance().highPerformers.length,
      lowPerformers: this.analyzePerformance().lowPerformers.length,
      opportunities: this.findOpportunities().length,
      wasteful: this.findWastefulKeywords().length,
      averages: {
        qualityScore: avgQualityScore,
        ctr: totalImpressions > 0 ? totalClicks / totalImpressions : 0,
        cpc: totalClicks > 0 ? totalCost / totalClicks : 0,
        conversionRate: totalClicks > 0 ? totalConversions / totalClicks : 0,
        cpa: totalConversions > 0 ? totalCost / totalConversions : 0,
      },
      totals: {
        cost: totalCost,
        clicks: totalClicks,
        conversions: totalConversions,
        impressions: totalImpressions,
      },
    };
  }
}

/**
 * QualityScoreAnalyzer - Analisa Quality Scores e componentes
 */
export class QualityScoreAnalyzer {
  constructor(keywords) {
    this.keywords = keywords.filter(k => k.quality_score !== null && k.quality_score !== undefined);
  }

  /**
   * Analisa todos os aspectos do Quality Score
   */
  analyzeAll() {
    return {
      overview: this.getOverview(),
      distribution: this.getDistribution(),
      components: this.analyzeComponents(),
      lowScoreKeywords: this.getLowScoreKeywords(),
      recommendations: this.generateQSRecommendations(),
    };
  }

  /**
   * Visão geral do Quality Score
   */
  getOverview() {
    if (this.keywords.length === 0) {
      return {
        totalKeywords: 0,
        averageScore: 0,
        belowAverage: 0,
        aboveAverage: 0,
      };
    }

    const total = this.keywords.length;
    const totalScore = this.keywords.reduce((sum, k) => sum + k.quality_score, 0);
    const avgScore = totalScore / total;

    const belowAvg = this.keywords.filter(k => k.quality_score < 5).length;
    const aboveAvg = this.keywords.filter(k => k.quality_score >= 7).length;

    return {
      totalKeywords: total,
      averageScore: parseFloat(avgScore.toFixed(1)),
      belowAverage: belowAvg,
      aboveAverage: aboveAvg,
      percentBelowAverage: parseFloat(((belowAvg / total) * 100).toFixed(1)),
      percentAboveAverage: parseFloat(((aboveAvg / total) * 100).toFixed(1)),
    };
  }

  /**
   * Distribuição de Quality Scores
   */
  getDistribution() {
    const distribution = {
      '1-3': 0,
      '4-6': 0,
      '7-10': 0,
    };

    this.keywords.forEach(k => {
      if (k.quality_score <= 3) distribution['1-3']++;
      else if (k.quality_score <= 6) distribution['4-6']++;
      else distribution['7-10']++;
    });

    return distribution;
  }

  /**
   * Analisa componentes do Quality Score
   */
  analyzeComponents() {
    const components = {
      adRelevance: { aboveAverage: 0, average: 0, belowAverage: 0 },
      landingPageExperience: { aboveAverage: 0, average: 0, belowAverage: 0 },
      expectedCtr: { aboveAverage: 0, average: 0, belowAverage: 0 },
    };

    this.keywords.forEach(k => {
      // Ad Relevance
      if (k.ad_relevance === 'ABOVE_AVERAGE') components.adRelevance.aboveAverage++;
      else if (k.ad_relevance === 'AVERAGE') components.adRelevance.average++;
      else if (k.ad_relevance === 'BELOW_AVERAGE') components.adRelevance.belowAverage++;

      // Landing Page Experience
      if (k.landing_page_experience === 'ABOVE_AVERAGE') components.landingPageExperience.aboveAverage++;
      else if (k.landing_page_experience === 'AVERAGE') components.landingPageExperience.average++;
      else if (k.landing_page_experience === 'BELOW_AVERAGE') components.landingPageExperience.belowAverage++;

      // Expected CTR
      if (k.expected_ctr === 'ABOVE_AVERAGE') components.expectedCtr.aboveAverage++;
      else if (k.expected_ctr === 'AVERAGE') components.expectedCtr.average++;
      else if (k.expected_ctr === 'BELOW_AVERAGE') components.expectedCtr.belowAverage++;
    });

    return components;
  }

  /**
   * Retorna keywords com QS baixo
   */
  getLowScoreKeywords() {
    return this.keywords
      .filter(k => k.quality_score < 5)
      .sort((a, b) => a.quality_score - b.quality_score)
      .map(k => ({
        ...k,
        issues: this.identifyQSIssues(k),
      }));
  }

  /**
   * Identifica problemas específicos de QS
   */
  identifyQSIssues(kw) {
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
    if (kw.quality_score <= 3) {
      issues.push('Quality Score crítico');
    }

    return issues;
  }

  /**
   * Gera recomendações para melhorar QS
   */
  generateQSRecommendations() {
    const recommendations = [];

    const components = this.analyzeComponents();

    // Recomendações para Ad Relevance
    if (components.adRelevance.belowAverage > 0) {
      recommendations.push({
        component: 'ad_relevance',
        priority: 'alta',
        title: 'Melhorar Relevância dos Anúncios',
        description: `${components.adRelevance.belowAverage} keywords com relevância de anúncio abaixo da média`,
        action: 'Incluir as palavras-chave nos títulos e descrições dos anúncios',
      });
    }

    // Recomendações para Landing Page
    if (components.landingPageExperience.belowAverage > 0) {
      recommendations.push({
        component: 'landing_page',
        priority: 'alta',
        title: 'Melhorar Landing Pages',
        description: `${components.landingPageExperience.belowAverage} keywords com experiência de landing page abaixo da média`,
        action: 'Otimizar velocidade, relevância e experiência mobile das landing pages',
      });
    }

    // Recomendações para Expected CTR
    if (components.expectedCtr.belowAverage > 0) {
      recommendations.push({
        component: 'expected_ctr',
        priority: 'média',
        title: 'Melhorar CTR Esperado',
        description: `${components.expectedCtr.belowAverage} keywords com CTR esperado abaixo da média`,
        action: 'Criar anúncios mais atrativos e testar diferentes variações',
      });
    }

    return recommendations;
  }
}
