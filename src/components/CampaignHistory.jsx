
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, ChevronDown, ChevronUp, History, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/customSupabaseClient';

const isUuid = (v) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);

const CampaignHistory = ({ clients, selectedClient, clientId, campaignId }) => {
  const [history, setHistory] = useState([]);
  const [expandedCampaign, setExpandedCampaign] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchHistory = async () => {
                if (!selectedClient && !clientId) return;
        setLoading(true);
        try {
                        const effectiveClientId = clientId || selectedClient?.id;
                        const campaignIds = (selectedClient?.campaigns || []).map(c => c.id).filter(Boolean);
                        const useCampaignHistory = campaignIds.length > 0 && campaignIds.every((id) => isUuid(String(id)));

                        if (useCampaignHistory) {
                            const { data, error } = await supabase
                                .from('campaign_history')
                                .select('*')
                                .in('campaign_id', campaignIds)
                                .order('created_at', { ascending: false });
                            if (error) throw error;

                            const mappedHistory = (data || []).map(h => ({
                                    id: h.id,
                                    campaign_name: selectedClient.campaigns.find(c => c.id === h.campaign_id)?.name || 'Desconhecido',
                                    upload_date: h.created_at,
                                    period_start: h.period_start,
                                    period_end: h.period_end,
                                    stats: h.data?.totals || { roas: 0, cpa: 0, conversions: 0 }
                            }));

                            setHistory(mappedHistory);
                            return;
                        }

                        // Modo ingest (google_ads_raw_imports + google_ads_metrics)
                        const { data: imports, error: importsError } = await supabase
                            .from('google_ads_raw_imports')
                            .select('id, created_at, date_range_start, date_range_end, source, report_name, applied_status, applied_summary')
                            .eq('client_id', effectiveClientId)
                            .order('created_at', { ascending: false })
                            .limit(25);
                        if (importsError) throw importsError;

                        const importsList = imports || [];
                        if (importsList.length === 0) {
                            setHistory([]);
                            return;
                        }

                        const starts = importsList.map(i => i.date_range_start).filter(Boolean).sort();
                        const ends = importsList.map(i => i.date_range_end).filter(Boolean).sort();
                        const minStart = starts[0] || null;
                        const maxEnd = ends[ends.length - 1] || null;

                        let metricsRows = [];
                        if (minStart && maxEnd) {
                            let mq = supabase
                                .from('google_ads_metrics')
                                .select('date_range_start, cost, conversions, conversion_value')
                                .eq('client_id', effectiveClientId)
                                .gte('date_range_start', minStart)
                                .lte('date_range_start', maxEnd);

                            // Se campaignId estiver disponível e for um id do Google Ads, filtra
                            if (campaignId && !isUuid(String(campaignId))) {
                                mq = mq.eq('campaign_id', String(campaignId));
                            }

                            const { data: mdata, error: merror } = await mq;
                            if (merror) throw merror;
                            metricsRows = mdata || [];
                        }

                        const mapped = importsList.map((imp) => {
                            const start = imp.date_range_start;
                            const end = imp.date_range_end;
                            const inRange = (r) => {
                                if (!start || !end) return false;
                                const d = r.date_range_start;
                                return d >= start && d <= end;
                            };

                            const totals = metricsRows.filter(inRange).reduce((acc, r) => {
                                acc.cost += Number(r.cost || 0);
                                acc.conversions += Number(r.conversions || 0);
                                acc.value += Number(r.conversion_value || 0);
                                return acc;
                            }, { cost: 0, conversions: 0, value: 0 });

                            const roas = totals.cost > 0 ? totals.value / totals.cost : 0;
                            const cpa = totals.conversions > 0 ? totals.cost / totals.conversions : 0;

                            const name = imp.report_name || (imp.source === 'google_ads_script' ? 'Ingest via Script' : 'Import Google Ads');

                            return {
                                id: imp.id,
                                campaign_name: name,
                                upload_date: imp.created_at,
                                period_start: start,
                                period_end: end,
                                stats: { roas, cpa, conversions: totals.conversions },
                            };
                        });

                        setHistory(mapped);

        } catch (err) {
            console.error("Error fetching history:", err);
        } finally {
            setLoading(false);
        }
    };

        fetchHistory();
    }, [selectedClient, clientId, campaignId]);

  const toggleExpand = (id) => {
    setExpandedCampaign(expandedCampaign === id ? null : id);
  };

  if (!selectedClient) {
    return (
        <div className="p-8 text-center text-zinc-500">
            Selecione um cliente para ver o histórico.
        </div>
    );
  }
  
  if (loading) {
      return <div className="p-8 text-center text-zinc-500">Carregando histórico...</div>;
  }

  if (history.length === 0) {
      return <div className="p-8 text-center text-zinc-500">Nenhum histórico encontrado. Salve dados da campanha para gerar histórico.</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.2 }}
      className="bg-zinc-900 rounded-xl border border-zinc-800 shadow-lg overflow-hidden"
    >
      <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <History className="w-5 h-5 text-blue-500" />
          Histórico de Versões & Evolução
        </h2>
        <span className="text-xs text-zinc-500 bg-zinc-950 px-3 py-1 rounded-full border border-zinc-800">
          Registros do Banco de Dados
        </span>
      </div>

      <div className="p-6">
        <div className="mb-8 relative border-l-2 border-zinc-800 ml-4 pl-8 space-y-8">
            {history.map((version, idx) => (
                <div key={version.id} className="relative">
                    <div className="absolute -left-[41px] top-0 w-5 h-5 rounded-full bg-zinc-900 border-2 border-emerald-500 flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    </div>
                    
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 bg-zinc-950/50 p-4 rounded-lg border border-zinc-800 hover:border-zinc-700 transition-colors cursor-pointer" onClick={() => toggleExpand(version.id)}>
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <h4 className="text-white font-medium">{version.campaign_name}</h4>
                                {idx === 0 && (
                                    <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20">
                                        Mais Recente
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-4 text-xs text-zinc-500">
                                <span className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    Salvo: {new Date(version.upload_date).toLocaleDateString()}
                                </span>
                                <span>
                                    Período: {version.period_start || 'N/A'} → {version.period_end || 'N/A'}
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center gap-6">
                            <div className="text-right">
                                <span className="block text-[10px] text-zinc-500 uppercase">ROAS</span>
                                <span className={`text-sm font-bold ${version.stats.roas >= 4 ? 'text-emerald-400' : 'text-orange-400'}`}>
                                    {version.stats.roas ? version.stats.roas.toFixed(2) : '0.00'}x
                                </span>
                            </div>
                            <div className="text-right hidden sm:block">
                                <span className="block text-[10px] text-zinc-500 uppercase">CPA</span>
                                <span className="text-sm font-medium text-white">R${version.stats.cpa ? version.stats.cpa.toFixed(2) : '0.00'}</span>
                            </div>
                             <div className="text-right hidden sm:block">
                                <span className="block text-[10px] text-zinc-500 uppercase">Conv.</span>
                                <span className="text-sm font-medium text-white">{version.stats.conversions}</span>
                            </div>
                            <ChevronDown className={`w-4 h-4 text-zinc-500 transition-transform ${expandedCampaign === version.id ? 'rotate-180' : ''}`} />
                        </div>
                    </div>

                    <AnimatePresence>
                        {expandedCampaign === version.id && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                            >
                                <div className="mt-4 p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
                                    <h5 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Snapshot de Métricas</h5>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div className="p-3 bg-zinc-950 rounded border border-zinc-800">
                                            <span className="text-xs text-zinc-500 block mb-1">ROAS</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-lg font-bold text-white">{version.stats.roas ? version.stats.roas.toFixed(2) : '0.00'}x</span>
                                            </div>
                                        </div>
                                         <div className="p-3 bg-zinc-950 rounded border border-zinc-800">
                                            <span className="text-xs text-zinc-500 block mb-1">CPA</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-lg font-bold text-white">R${version.stats.cpa ? version.stats.cpa.toFixed(2) : '0.00'}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-4 flex justify-end">
                                        <Button variant="outline" size="sm" className="text-xs h-8">
                                            <FileText className="w-3 h-3 mr-2" />
                                            Ver Detalhes Completos
                                        </Button>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            ))}
        </div>
      </div>
    </motion.div>
  );
};

export default CampaignHistory;
