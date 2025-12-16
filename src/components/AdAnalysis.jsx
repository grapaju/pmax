import React, { useEffect, useMemo, useState } from 'react';
import { 
  AlertTriangle, CheckCircle2, TrendingUp, TrendingDown, 
  MousePointerClick, Eye, Target, DollarSign, Lightbulb,
  MoreHorizontal, Copy, LayoutTemplate, Image as ImageIcon, Type
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/lib/customSupabaseClient';
import { periodToDateRange } from '@/lib/googleAdsDashboardLoader';

function normalizeJson(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  return null;
}

function getByPath(obj, path) {
  if (!obj || !path) return undefined;
  const parts = Array.isArray(path) ? path : String(path).split('.');
  let curr = obj;
  for (const p of parts) {
    if (curr && typeof curr === 'object' && p in curr) curr = curr[p];
    else return undefined;
  }
  return curr;
}

function pickFirstString(...values) {
  for (const v of values) {
    if (v === null || v === undefined) continue;
    const s = String(v).trim();
    if (s) return s;
  }
  return null;
}

function getAssetDisplayTitle(row) {
  const json = normalizeJson(row?.raw_json);

  // 1) Campos flat comuns (variações de script)
  const flat = pickFirstString(
    json?.asset_text,
    json?.assetText,
    json?.headline,
    json?.long_headline,
    json?.longHeadline,
    json?.description,
    json?.title,
    json?.asset_name,
    json?.assetName,
    json?.name,
    json?.text,
    json?.asset_text_asset_text,
    json?.text_asset_text,
    json?.textAssetText
  );
  if (flat) return flat;

  // 2) Dot-notation (quando o script serializa chaves com ponto)
  if (json && typeof json === 'object') {
    const dotted = pickFirstString(
      json['asset.text_asset.text'],
      json['asset.textAsset.text'],
      json['asset.text'],
      json['asset.name'],
      json['asset.image_asset.full_size.url'],
      json['asset.imageAsset.fullSize.url'],
      json['asset.youtube_video_asset.youtube_video_id'],
      json['asset.youtubeVideoAsset.youtubeVideoId']
    );
    if (dotted) return dotted;
  }

  // 3) Estruturas aninhadas (GAQL / scripts)
  const nested = pickFirstString(
    getByPath(json, 'asset.text_asset.text'),
    getByPath(json, 'asset.textAsset.text'),
    getByPath(json, 'asset.text'),
    getByPath(json, 'asset.name'),
    getByPath(json, 'asset.image_asset.full_size.url'),
    getByPath(json, 'asset.imageAsset.fullSize.url'),
    getByPath(json, 'asset.youtube_video_asset.youtube_video_id'),
    getByPath(json, 'asset.youtubeVideoAsset.youtubeVideoId')
  );
  if (nested) return nested;

  // 4) Fallback por tipo (tenta descobrir algo exibível)
  const fieldType = String(row?.field_type || '').toUpperCase();
  if (fieldType.includes('HEADLINE') || fieldType.includes('DESCRIPTION')) {
    const maybeText = pickFirstString(
      json?.value,
      getByPath(json, 'value'),
      getByPath(json, 'asset.value')
    );
    if (maybeText) return maybeText;
  }

  const maybeUrl = pickFirstString(
    json?.asset_url,
    json?.assetUrl,
    json?.youtube_url,
    json?.youtubeUrl,
    json?.url,
    json?.image_url,
    json?.imageUrl,
    getByPath(json, 'image.url'),
    getByPath(json, 'asset.image.url'),
    getByPath(json, 'asset.image_asset.full_size.url'),
    getByPath(json, 'asset.imageAsset.fullSize.url')
  );
  if (maybeUrl) return maybeUrl;

  const ytId = pickFirstString(json?.youtube_video_id, json?.youtubeVideoId);
  if (ytId) return `https://www.youtube.com/watch?v=${ytId}`;

  const assetId = row?.asset_id ? String(row.asset_id).trim() : '';
  if (assetId) return `Asset ${assetId}`;

  const rn = row?.asset_resource_name ? String(row.asset_resource_name).trim() : '';
  if (rn) {
    const short = rn.split('/').filter(Boolean).slice(-1)[0];
    return short ? `Asset ${short}` : rn;
  }

  return 'Asset';
}

const AdAnalysis = ({ clientId, campaignId, period = 'all', targetRoas = 4, targetCpa = 45 }) => {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!clientId || !campaignId) {
        setAssets([]);
        return;
      }

      setLoading(true);
      try {
        const range = periodToDateRange(period);
        let q = supabase
          .from('google_ads_assets')
          .select('asset_resource_name, asset_id, asset_type, field_type, asset_group_id, asset_group_name, performance_label, impressions, clicks, cost, conversions, conversion_value, raw_json, date_range_start')
          .eq('client_id', clientId)
          .eq('campaign_id', String(campaignId))
          .order('date_range_start', { ascending: false });

        if (range) {
          q = q.gte('date_range_start', range.start).lte('date_range_start', range.end);
        }

        const { data, error } = await q;
        if (error) throw error;
        setAssets(data || []);
      } catch (e) {
        console.error('Erro ao carregar google_ads_assets:', e);
        setAssets([]);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [clientId, campaignId, period]);

  const ads = useMemo(() => {
    // Agrupa por asset_resource_name + field_type, somando métricas (para evitar duplicados por dia)
    const m = new Map();
    for (const r of assets || []) {
      const key = `${r.asset_resource_name || r.asset_id || ''}::${r.field_type || ''}`;
      const curr = m.get(key) || {
        id: key,
        headline: getAssetDisplayTitle(r),
        description: r.asset_group_name ? `Grupo: ${r.asset_group_name}` : '',
        type: r.field_type || r.asset_type || 'Asset',
        assetType: (() => {
          const s = String(r.asset_type || '').toLowerCase();
          if (s.includes('image')) return 'image';
          if (s.includes('video') || s.includes('youtube')) return 'video';
          return 'text';
        })(),
        roas: 0,
        ctr: 0,
        conversions: 0,
        cpa: 0,
        impressions: 0,
        clicks: 0,
        spend: 0,
        value: 0,
        status: 'average',
        _perf: {},
      };

      curr.impressions += Number(r.impressions || 0);
      curr.clicks += Number(r.clicks || 0);
      curr.spend += Number(r.cost || 0);
      curr.conversions += Number(r.conversions || 0);
      curr.value += Number(r.conversion_value || 0);

      const pl = String(r.performance_label || '').toUpperCase();
      curr._perf[pl] = (curr._perf[pl] || 0) + 1;

      m.set(key, curr);
    }

    const out = Array.from(m.values()).map((a) => {
      a.roas = a.spend > 0 ? a.value / a.spend : 0;
      a.cpa = a.conversions > 0 ? a.spend / a.conversions : 0;
      a.ctr = a.impressions > 0 ? (a.clicks / a.impressions) * 100 : 0;

      // status aproximado baseado em performance_label ou ROAS
      const best = a._perf.BEST || 0;
      const good = a._perf.GOOD || 0;
      const low = a._perf.LOW || 0;
      if (best > 0) a.status = 'excellent';
      else if (good > 0) a.status = 'good';
      else if (low > 0) a.status = 'poor';
      else a.status = a.roas >= targetRoas ? 'good' : a.roas >= targetRoas * 0.7 ? 'average' : 'poor';

      return a;
    });

    // Ordena por ROAS desc, depois por conversões
    return out.sort((a, b) => (b.roas - a.roas) || (b.conversions - a.conversions));
  }, [assets, targetRoas]);

  const sortedAds = ads;

  const categorizeAsset = (ad) => {
    const type = String(ad?.type || '').toUpperCase();
    const assetType = String(ad?.assetType || '').toLowerCase();

    if (assetType === 'image') return 'imagens';
    if (assetType === 'video') return 'videos';
    if (type.includes('HEADLINE')) return 'titulos';
    if (type.includes('DESCRIPTION')) return 'descricoes';
    if (type.includes('SITELINK')) return 'sitelinks';
    if (type.includes('CALLOUT')) return 'callouts';
    if (type.includes('CALL')) return 'chamadas';
    return 'outros';
  };

  const groupedAds = useMemo(() => {
    const statusRank = (status) => {
      switch (status) {
        case 'poor':
          return 0;
        case 'average':
          return 1;
        case 'good':
          return 2;
        case 'excellent':
          return 3;
        default:
          return 9;
      }
    };

    const sortWithinGroup = (a, b) => {
      const sr = statusRank(a?.status) - statusRank(b?.status);
      if (sr !== 0) return sr;

      const spendA = Number(a?.spend || 0);
      const spendB = Number(b?.spend || 0);
      if (spendB !== spendA) return spendB - spendA;

      const convA = Number(a?.conversions || 0);
      const convB = Number(b?.conversions || 0);
      if (convB !== convA) return convB - convA;

      const roasA = Number(a?.roas || 0);
      const roasB = Number(b?.roas || 0);
      return roasB - roasA;
    };

    const groups = {
      titulos: [],
      descricoes: [],
      imagens: [],
      videos: [],
      sitelinks: [],
      callouts: [],
      chamadas: [],
      outros: [],
    };

    for (const ad of sortedAds) {
      const k = categorizeAsset(ad);
      (groups[k] || groups.outros).push(ad);
    }

    for (const key of Object.keys(groups)) {
      groups[key].sort(sortWithinGroup);
    }

    return groups;
  }, [sortedAds]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'excellent': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'good': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'average': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
      case 'poor': return 'bg-red-500/10 text-red-400 border-red-500/20';
      default: return 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20';
    }
  };

  const getImprovementSuggestion = (ad) => {
    if (ad.roas < 2.0) return { text: "Pausar ou reescrever completamente. Baixo retorno.", icon: AlertTriangle, color: "text-red-400" };
    if (ad.ctr < 1.0) return { text: "Melhorar criativo/imagem para aumentar CTR.", icon: Eye, color: "text-orange-400" };
    if (ad.cpa > targetCpa * 1.5) return { text: "Revisar Landing Page ou Segmentação.", icon: Target, color: "text-yellow-400" };
    if (ad.status === 'excellent') return { text: "Ótimo desempenho! Considere escalar.", icon: TrendingUp, color: "text-emerald-400" };
    return { text: "Monitorar desempenho.", icon: Lightbulb, color: "text-blue-400" };
  };

  const getAssetIcon = (type) => {
    switch(type) {
      case 'image': return <ImageIcon className="w-4 h-4" />;
      case 'video': return <LayoutTemplate className="w-4 h-4" />;
      default: return <Type className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {loading && (
        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 text-sm">
          Carregando análise de anúncios/recursos...
        </div>
      )}
      
      {/* Header Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800 flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 rounded-full text-emerald-400">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-zinc-500">Melhor Anúncio (ROAS)</p>
            <p className="text-xl font-bold text-white">
              {sortedAds[0] ? `${sortedAds[0].roas.toFixed(2)}x` : '0.00x'}
              {sortedAds[0] ? <span className="text-xs font-normal text-zinc-400"> ({sortedAds[0].type})</span> : null}
            </p>
          </div>
        </div>
        <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800 flex items-center gap-4">
          <div className="p-3 bg-red-500/10 rounded-full text-red-400">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-zinc-500">Requer Atenção</p>
            <p className="text-xl font-bold text-white">{sortedAds.filter(a => a.status === 'poor').length} <span className="text-xs font-normal text-zinc-400">itens críticos</span></p>
          </div>
        </div>
        <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800 flex items-center gap-4">
          <div className="p-3 bg-blue-500/10 rounded-full text-blue-400">
            <MousePointerClick className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-zinc-500">CTR Médio</p>
            <p className="text-xl font-bold text-white">
              {sortedAds.length > 0 ? (sortedAds.reduce((acc, curr) => acc + (curr.ctr || 0), 0) / sortedAds.length).toFixed(2) : '0.00'}%
            </p>
          </div>
        </div>
      </div>

      {/* Ads List */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <LayoutTemplate className="w-5 h-5 text-zinc-400" />
          Assets (organizado por tipo)
        </h3>

        <div className="space-y-8">
          {(
            [
              { key: 'titulos', label: 'Títulos' },
              { key: 'descricoes', label: 'Descrições' },
              { key: 'imagens', label: 'Imagens' },
              { key: 'videos', label: 'Vídeos' },
              { key: 'sitelinks', label: 'Sitelinks' },
              { key: 'callouts', label: 'Callouts' },
              { key: 'chamadas', label: 'Chamadas' },
              { key: 'outros', label: 'Outros' },
            ]
          ).map((section) => {
            const items = groupedAds[section.key] || [];
            if (!items.length) return null;

            return (
              <div key={section.key} className="space-y-3">
                <div className="flex items-baseline justify-between">
                  <h4 className="text-sm font-semibold text-zinc-200 uppercase tracking-wider">
                    {section.label}
                  </h4>
                  <span className="text-xs text-zinc-500">{items.length} itens</span>
                </div>

                <div className="grid gap-4">
                  {items.map((ad, index) => {
                    const suggestion = getImprovementSuggestion(ad);
                    const SuggestionIcon = suggestion.icon;

                    return (
                      <div
                        key={ad.id}
                        className={`bg-zinc-900 rounded-xl border p-5 transition-all hover:border-zinc-700 group ${
                          ad.status === 'poor'
                            ? 'border-red-900/30'
                            : ad.status === 'excellent'
                              ? 'border-emerald-900/30'
                              : 'border-zinc-800'
                        }`}
                      >
                        <div className="flex flex-col lg:flex-row gap-6">
                          <div className="flex-1 space-y-3">
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border flex items-center gap-1.5 ${getStatusColor(
                                    ad.status
                                  )}`}
                                >
                                  {getAssetIcon(ad.assetType)}
                                  {ad.status === 'excellent'
                                    ? 'Excelente'
                                    : ad.status === 'good'
                                      ? 'Bom'
                                      : ad.status === 'average'
                                        ? 'Médio'
                                        : 'Ruim'}
                                </span>
                                <span className="text-xs text-zinc-500 uppercase tracking-wider">{ad.type}</span>
                              </div>
                              <div className="text-zinc-500 text-xs font-mono">#{index + 1}</div>
                            </div>

                            <div>
                              <h4 className="text-base font-semibold text-white mb-1">{ad.headline}</h4>
                              <p className="text-sm text-zinc-400 leading-relaxed">{ad.description}</p>
                            </div>

                            <div
                              className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg bg-zinc-950/50 border border-zinc-800/50 w-fit ${suggestion.color}`}
                            >
                              <SuggestionIcon className="w-3.5 h-3.5" />
                              <span className="font-medium">Sugestão:</span> {suggestion.text}
                            </div>
                          </div>

                          <div className="hidden lg:block w-px bg-zinc-800" />

                          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4 gap-4 lg:min-w-[480px]">
                            <div className="space-y-1">
                              <p className="text-xs text-zinc-500 flex items-center gap-1">
                                <TrendingUp className="w-3 h-3" /> ROAS
                              </p>
                              <p
                                className={`text-lg font-bold ${
                                  ad.roas >= 4
                                    ? 'text-emerald-400'
                                    : ad.roas < 2
                                      ? 'text-red-400'
                                      : 'text-white'
                                }`}
                              >
                                {Number.isFinite(ad.roas) ? ad.roas.toFixed(2) : '0.00'}x
                              </p>
                            </div>

                            <div className="space-y-1">
                              <p className="text-xs text-zinc-500 flex items-center gap-1">
                                <Target className="w-3 h-3" /> CPA
                              </p>
                              <p
                                className={`text-lg font-bold ${
                                  ad.cpa > targetCpa * 1.2 ? 'text-red-400' : 'text-white'
                                }`}
                              >
                                R${ad.cpa.toFixed(2)}
                              </p>
                            </div>

                            <div className="space-y-1">
                              <p className="text-xs text-zinc-500 flex items-center gap-1">
                                <DollarSign className="w-3 h-3" /> Conversões
                              </p>
                              <p className="text-lg font-bold text-white">{ad.conversions}</p>
                            </div>

                            <div className="space-y-1">
                              <p className="text-xs text-zinc-500 flex items-center gap-1">
                                <MousePointerClick className="w-3 h-3" /> CTR
                              </p>
                              <p
                                className={`text-lg font-bold ${
                                  ad.ctr < 1.0 ? 'text-orange-400' : 'text-white'
                                }`}
                              >
                                {Number.isFinite(ad.ctr) ? ad.ctr.toFixed(2) : '0.00'}%
                              </p>
                            </div>

                            <div className="space-y-1">
                              <p className="text-xs text-zinc-500 flex items-center gap-1">
                                <Eye className="w-3 h-3" /> Impressões
                              </p>
                              <p className="text-sm font-medium text-zinc-300">
                                {ad.impressions.toLocaleString()}
                              </p>
                            </div>

                            <div className="space-y-1">
                              <p className="text-xs text-zinc-500">Cliques</p>
                              <p className="text-sm font-medium text-zinc-300">
                                {ad.clicks.toLocaleString()}
                              </p>
                            </div>
                          </div>

                          <div className="flex lg:flex-col justify-end">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  className="h-8 w-8 p-0 text-zinc-400 hover:text-white hover:bg-zinc-800"
                                >
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent
                                align="end"
                                className="bg-zinc-900 border-zinc-800 text-zinc-300"
                              >
                                <DropdownMenuItem className="focus:bg-zinc-800 cursor-pointer">
                                  <Copy className="w-4 h-4 mr-2" /> Duplicar Anúncio
                                </DropdownMenuItem>
                                <DropdownMenuItem className="focus:bg-zinc-800 cursor-pointer text-red-400 focus:text-red-400">
                                  Pausar Anúncio
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default AdAnalysis;