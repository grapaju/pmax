import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Layers, MonitorPlay, ShoppingBag, Search, Radio, BarChart3, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { periodToDateRange } from '@/lib/googleAdsDashboardLoader';

const DetailSection = ({ title, icon: Icon, children }) => (
  <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden mb-6 shadow-lg">
    <div className="p-4 border-b border-zinc-800 bg-zinc-900/50 flex items-center gap-2">
      <Icon className="w-5 h-5 text-emerald-500" />
      <h3 className="font-semibold text-white">{title}</h3>
    </div>
    <div className="p-4">
      {children}
    </div>
  </div>
);

const PerformanceBar = ({ value, label, color = 'bg-emerald-500' }) => (
  <div className="mb-3">
    <div className="flex justify-between text-xs mb-1">
      <span className="text-zinc-300">{label}</span>
      <span className="text-zinc-400">{value}%</span>
    </div>
    <div className="h-2 bg-zinc-950 rounded-full overflow-hidden">
      <div 
        className={`h-full ${color} rounded-full transition-all duration-500`}
        style={{ width: `${Math.min(value, 100)}%` }}
      />
    </div>
  </div>
);

const DetailedMetrics = ({ clientId, campaignId, period = 'all' }) => {
  const [rows, setRows] = useState([]);
  const [searchInsightRows, setSearchInsightRows] = useState([]);
  const [shoppingRows, setShoppingRows] = useState([]);
  const [audienceSignalRows, setAudienceSignalRows] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!clientId) {
        setRows([]);
        setSearchInsightRows([]);
        setShoppingRows([]);
        setAudienceSignalRows([]);
        return;
      }

      setLoading(true);
      try {
        const range = periodToDateRange(period);
        let q = supabase
          .from('google_ads_assets')
          .select('asset_group_id, asset_group_name, field_type, performance_label, impressions, clicks, cost, conversions, conversion_value, date_range_start')
          .eq('client_id', clientId)
          .order('date_range_start', { ascending: false });

        if (campaignId) {
          q = q.eq('campaign_id', String(campaignId));
        }

        if (range) {
          q = q.gte('date_range_start', range.start).lte('date_range_start', range.end);
        }

        const [assetsRes, stiRes, shopRes, sigRes] = await Promise.all([
          q,
          (async () => {
            let q2 = supabase
              .from('google_ads_pmax_search_term_insights')
              .select('campaign_id, campaign_name, category_label, impressions, clicks, cost, conversions, conversion_value, date_range_start')
              .eq('client_id', clientId)
              .order('date_range_start', { ascending: false });

            if (campaignId) q2 = q2.eq('campaign_id', String(campaignId));
            if (range) q2 = q2.gte('date_range_start', range.start).lte('date_range_start', range.end);
            return q2;
          })(),
          (async () => {
            let q3 = supabase
              .from('google_ads_pmax_shopping_performance')
              .select('campaign_id, campaign_name, product_item_id, product_title, product_brand, product_type_l1, impressions, clicks, cost, conversions, conversion_value, date_range_start')
              .eq('client_id', clientId)
              .order('date_range_start', { ascending: false });

            if (campaignId) q3 = q3.eq('campaign_id', String(campaignId));
            if (range) q3 = q3.gte('date_range_start', range.start).lte('date_range_start', range.end);
            return q3;
          })(),
          (async () => {
            let q4 = supabase
              .from('google_ads_pmax_audience_signals')
              .select('campaign_id, campaign_name, asset_group_id, asset_group_name, signal_type, signal_value, date_range_start')
              .eq('client_id', clientId)
              .order('date_range_start', { ascending: false });

            if (campaignId) q4 = q4.eq('campaign_id', String(campaignId));
            if (range) q4 = q4.gte('date_range_start', range.start).lte('date_range_start', range.end);
            return q4;
          })(),
        ]);

        if (assetsRes.error) throw assetsRes.error;
        setRows(assetsRes.data || []);

        if (!stiRes.error) setSearchInsightRows(stiRes.data || []);
        else setSearchInsightRows([]);

        if (!shopRes.error) setShoppingRows(shopRes.data || []);
        else setShoppingRows([]);

        if (!sigRes.error) setAudienceSignalRows(sigRes.data || []);
        else setAudienceSignalRows([]);
      } catch (e) {
        console.error('Erro ao carregar google_ads_assets (DetailedMetrics):', e);
        setRows([]);
        setSearchInsightRows([]);
        setShoppingRows([]);
        setAudienceSignalRows([]);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [clientId, campaignId, period]);

  const aggregatedData = useMemo(() => {
    const assetGroupMap = new Map();
    const assetTypesMap = new Map();

    for (const r of rows || []) {
      const groupKey = r.asset_group_id || r.asset_group_name || 'unknown';
      const g = assetGroupMap.get(groupKey) || {
        name: r.asset_group_name || 'Grupo de Recursos',
        status: 'Aprendizado',
        performance: 'medium',
        _perf: {},
      };

      const pl = String(r.performance_label || '').toUpperCase();
      g._perf[pl] = (g._perf[pl] || 0) + 1;
      assetGroupMap.set(groupKey, g);

      const typeKey = String(r.field_type || 'UNKNOWN');
      const t = assetTypesMap.get(typeKey) || { label: typeKey, performance: 'medium', count: 0, _perf: {} };
      t.count += 1;
      t._perf[pl] = (t._perf[pl] || 0) + 1;
      assetTypesMap.set(typeKey, t);
    }

    const assetGroups = Array.from(assetGroupMap.values()).map((g) => {
      const best = g._perf.BEST || 0;
      const good = g._perf.GOOD || 0;
      const low = g._perf.LOW || 0;
      if (best > 0) {
        g.status = 'Excelente';
        g.performance = 'high';
      } else if (good > 0) {
        g.status = 'Bom';
        g.performance = 'high';
      } else if (low > 0) {
        g.status = 'Ruim';
        g.performance = 'medium';
      } else {
        g.status = 'Aprendizado';
        g.performance = 'medium';
      }
      return g;
    });

    const assetTypes = {};
    for (const [k, t] of assetTypesMap.entries()) {
      const best = t._perf.BEST || 0;
      const good = t._perf.GOOD || 0;
      const low = t._perf.LOW || 0;
      t.performance = best > 0 ? 'high' : good > 0 ? 'good' : low > 0 ? 'medium' : 'medium';
      assetTypes[k] = t;
    }

    // Search Term Insights (categorias)
    const searchTermMap = new Map();
    for (const r of searchInsightRows || []) {
      const key = String(r.category_label || '').trim();
      if (!key) continue;
      const cur = searchTermMap.get(key) || { term: key, conversions: 0, cost: 0 };
      cur.conversions += Number(r.conversions) || 0;
      cur.cost += Number(r.cost) || 0;
      searchTermMap.set(key, cur);
    }

    const searchTerms = Array.from(searchTermMap.values())
      .sort((a, b) => (b.conversions - a.conversions) || (b.cost - a.cost))
      .slice(0, 12)
      .map((t) => ({
        ...t,
        cost: (t.cost || 0).toFixed(2),
      }));

    // Shopping performance (proxy de listing groups)
    const shopMap = new Map();
    function pickShopName_(row) {
      return (
        String(row.product_type_l1 || '').trim() ||
        String(row.product_brand || '').trim() ||
        String(row.product_title || '').trim() ||
        String(row.product_item_id || '').trim() ||
        'Item do feed'
      );
    }
    for (const r of shoppingRows || []) {
      const name = pickShopName_(r);
      const cur = shopMap.get(name) || { name, conversions: 0, cost: 0, conversion_value: 0 };
      cur.conversions += Number(r.conversions) || 0;
      cur.cost += Number(r.cost) || 0;
      cur.conversion_value += Number(r.conversion_value) || 0;
      shopMap.set(name, cur);
    }
    const listingGroups = Array.from(shopMap.values())
      .map((g) => ({
        ...g,
        roas: g.cost > 0 ? g.conversion_value / g.cost : 0,
      }))
      .sort((a, b) => (b.conversion_value - a.conversion_value) || (b.roas - a.roas))
      .slice(0, 10)
      .map((g) => ({
        name: g.name,
        conversions: Number(g.conversions || 0).toFixed(0),
        roas: Number(g.roas || 0).toFixed(1),
      }));

    // Audience signals (score simples de completude por asset group)
    const signalsByGroup = new Map();
    for (const r of audienceSignalRows || []) {
      const key = String(r.asset_group_id || '').trim() || String(r.asset_group_name || '').trim();
      if (!key) continue;
      const bucket = signalsByGroup.get(key) || {
        assetGroupName: String(r.asset_group_name || 'Grupo de Recursos').trim(),
        types: new Set(),
        count: 0,
      };
      const t = String(r.signal_type || '').trim();
      if (t) bucket.types.add(t);
      bucket.count += 1;
      signalsByGroup.set(key, bucket);
    }

    const audienceSignals = Array.from(signalsByGroup.values())
      .map((g) => {
        const distinctTypes = g.types.size;
        // Heurística: mais tipos/ocorrências => sinal mais forte.
        const strength = distinctTypes >= 2 || g.count >= 3 ? 'Strong' : 'Medium';
        return { name: g.assetGroupName, strength };
      })
      .sort((a, b) => (a.strength === b.strength ? 0 : a.strength === 'Strong' ? -1 : 1))
      .slice(0, 10);

    return {
      assetGroups,
      assetTypes,
      listingGroups,
      searchTerms,
      audienceSignals,
      impressionShare: { searchIS: 0, budgetLoss: 0, rankLoss: 0, count: 0 },
      hasData:
        (rows || []).length > 0 ||
        (searchInsightRows || []).length > 0 ||
        (shoppingRows || []).length > 0 ||
        (audienceSignalRows || []).length > 0,
    };
  }, [rows, searchInsightRows, shoppingRows, audienceSignalRows]);

  const avgIS = { search: 0, budget: 0, rank: 0 };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {loading && (
        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 text-sm">
          Carregando visão geral (assets)...
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Impression Share Metrics */}
        <DetailSection title="Análise de Parcela de Impressões" icon={BarChart3}>
          <div className="space-y-4">
            <PerformanceBar value={avgIS.search} label="Parcela de Impressões na Pesquisa" color="bg-emerald-500" />
            <PerformanceBar value={avgIS.budget} label="Perda p/ Orçamento (Taxa de Consumo)" color="bg-orange-500" />
            <PerformanceBar value={avgIS.rank} label="Perda p/ Classificação (Força do Anúncio)" color="bg-red-500" />
            <div className="mt-4 p-3 bg-zinc-950/50 border border-zinc-800 rounded-lg text-xs text-zinc-300 flex gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-zinc-500" />
              <p>
                Dados de parcela de impressão não são coletados pelo script atual.
              </p>
            </div>
          </div>
        </DetailSection>

        {/* Asset Group Performance */}
        <DetailSection title="Desempenho do Grupo de Recursos" icon={Layers}>
          <div className="space-y-3 max-h-[250px] overflow-y-auto custom-scrollbar">
            {aggregatedData.assetGroups.length > 0 ? (
              aggregatedData.assetGroups.map((group, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 bg-zinc-950 rounded border border-zinc-800">
                  <div>
                    <p className="text-sm font-medium text-white">{group.name}</p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                      group.status === 'Excelente' ? 'bg-emerald-500/20 text-emerald-400' :
                      group.status === 'Bom' ? 'bg-blue-500/20 text-blue-400' :
                      group.status === 'Ruim' ? 'bg-red-500/20 text-red-400' :
                      'bg-yellow-500/20 text-yellow-400'
                    }`}>{group.status}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-zinc-400">Perf: <span className={group.performance === 'high' ? 'text-emerald-400' : 'text-orange-400'}>{group.performance === 'high' ? 'Alta' : 'Média'}</span></p>
                  </div>
                </div>
              ))
            ) : <p className="text-zinc-500 text-sm">Nenhum dado de grupo de recursos disponível.</p>}
          </div>
        </DetailSection>

        {/* Search Terms & Conversions */}
        <DetailSection title="Categorias de Pesquisa (Insights) c/ Conversões" icon={Search}>
          <div className="space-y-2 max-h-[250px] overflow-y-auto custom-scrollbar">
            {aggregatedData.searchTerms.length > 0 ? (
              <table className="w-full text-sm">
                <thead className="text-xs text-zinc-500 border-b border-zinc-800">
                  <tr>
                    <th className="text-left py-1">Categoria</th>
                    <th className="text-right py-1">Conv.</th>
                    <th className="text-right py-1">Custo</th>
                  </tr>
                </thead>
                <tbody className="text-zinc-300">
                  {aggregatedData.searchTerms.map((term, idx) => (
                    <tr key={idx} className="border-b border-zinc-800/50">
                      <td className="py-2">{term.term}</td>
                      <td className="text-right">{term.conversions}</td>
                      <td className="text-right text-zinc-400">R${term.cost}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="mt-1 p-3 bg-zinc-950/50 border border-zinc-800 rounded-lg text-xs text-zinc-300 flex gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-zinc-500" />
                <p>
                  Sem dados de categorias de termos (PMax Insights) ainda. Confirme que você rodou a migration
                  <span className="text-zinc-200"> google-ads-pmax-insights.sql</span> no Supabase e executou o script.
                </p>
              </div>
            )}
          </div>
        </DetailSection>

        {/* Listing Groups (Products) */}
        <DetailSection title="Desempenho do Feed / Listagem (Proxy)" icon={ShoppingBag}>
          <div className="space-y-3">
             {aggregatedData.listingGroups.length > 0 ? (
              aggregatedData.listingGroups.map((group, idx) => (
                  <div key={idx} className="flex justify-between items-center text-sm">
                    <span className="text-zinc-300">{group.name}</span>
                    <div className="flex gap-3">
                      <span className="text-zinc-400">{group.conversions} Conv</span>
                      <span className={`${Number(group.roas) > 4 ? 'text-emerald-400' : 'text-orange-400'}`}>{group.roas}x ROAS</span>
                    </div>
                  </div>
              ))
             ) : (
              <div className="mt-1 p-3 bg-zinc-950/50 border border-zinc-800 rounded-lg text-xs text-zinc-300 flex gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-zinc-500" />
                <p>
                  Sem dados de feed/listagem ainda. Em algumas contas o Google Ads Scripts não expõe
                  <span className="text-zinc-200"> shopping_performance_view</span> para PMax.
                </p>
              </div>
             )}
          </div>
        </DetailSection>

        {/* Asset Type Breakdown */}
        <DetailSection title="Análise por Tipo de Recurso" icon={MonitorPlay}>
          <div className="grid grid-cols-2 gap-2">
            {Object.values(aggregatedData.assetTypes).map((type, idx) => (
              <div key={idx} className="bg-zinc-950 p-3 rounded-lg border border-zinc-800 text-center">
                <p className="text-xs text-zinc-400 mb-1">{type.label}</p>
                <div className={`text-sm font-semibold ${
                  type.performance === 'high' ? 'text-emerald-400' : 
                  type.performance === 'good' ? 'text-blue-400' : 'text-orange-400'
                }`}>
                  {type.performance === 'high' ? 'ALTA' : type.performance === 'good' ? 'BOA' : 'MÉDIA'}
                </div>
              </div>
            ))}
          </div>
        </DetailSection>

         {/* Audience Signals */}
         <DetailSection title="Força do Sinal de Público" icon={Radio}>
          <div className="space-y-2">
             {aggregatedData.audienceSignals.length > 0 ? (
              aggregatedData.audienceSignals.map((signal, idx) => (
                  <div key={idx} className="flex justify-between items-center text-sm p-2 hover:bg-zinc-950 rounded transition-colors">
                    <span className="text-zinc-300">{signal.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      signal.strength === 'Strong' ? 'bg-purple-500/20 text-purple-400' : 'bg-zinc-500/20 text-zinc-400'
                    }`}>{signal.strength === 'Strong' ? 'Forte' : 'Médio'}</span>
                  </div>
              ))
             ) : (
              <div className="mt-1 p-3 bg-zinc-950/50 border border-zinc-800 rounded-lg text-xs text-zinc-300 flex gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-zinc-500" />
                <p>
                  Sem dados de Audience Signals ainda. Se o GAQL não expor os sinais, a seção fica vazia mesmo.
                </p>
              </div>
             )}
          </div>
        </DetailSection>

      </div>
    </div>
  );
};

export default DetailedMetrics;