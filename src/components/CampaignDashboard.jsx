
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Upload, FileText, TrendingUp, TrendingDown, DollarSign, 
  Target, BarChart3, Activity, X, MousePointerClick, Eye, Calendar, Save, Share2,
  ArrowUpRight, ArrowDownRight, Filter, Layout, LayoutTemplate, History, LayoutGrid
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CampaignDiagnostics from '@/components/CampaignDiagnostics';
import CampaignOptimizationTips from '@/components/CampaignOptimizationTips';
import ExportPDF from '@/components/ExportPDF';
import WeekOverWeekComparison from '@/components/WeekOverWeekComparison';
import CampaignSelector from '@/components/CampaignSelector';
import AdAnalysis from '@/components/AdAnalysis';
import DetailedMetrics from '@/components/DetailedMetrics';
import CampaignHistory from '@/components/CampaignHistory';
import { supabase } from '@/lib/customSupabaseClient';

// Utility for simple CSV parsing
const parseCSV = (text) => {
  const lines = text.split('\n');
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  
  return lines.slice(1).filter(line => line.trim()).map(line => {
    const values = line.split(',');
    const entry = {};
    headers.forEach((header, i) => {
      let val = values[i]?.trim();
      if (!isNaN(val) && val !== '') {
        val = parseFloat(val);
      }
      entry[header] = val;
    });
    return entry;
  });
};

const KPICard = ({ title, value, subValue, target, prefix = '', suffix = '', inverse = false, icon: Icon, comparison }) => {
  let statusColor = 'text-zinc-500';
  let isGood = true;

  if (target !== undefined && typeof value === 'number') {
    if (inverse) {
      isGood = value <= target;
    } else {
      isGood = value >= target;
    }
    statusColor = isGood ? 'text-emerald-400' : 'text-red-400';
  }

  let compColor = 'text-zinc-500';
  let CompIcon = null;
  if (comparison) {
    const isPositive = comparison.change > 0;
    const isGoodTrend = inverse ? !isPositive : isPositive;
    
    compColor = isGoodTrend ? 'text-emerald-400' : 'text-red-400';
    CompIcon = isPositive ? ArrowUpRight : ArrowDownRight;
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-xl flex flex-col justify-between hover:border-zinc-700 transition-all group relative overflow-hidden">
      <div className="flex justify-between items-start mb-2 relative z-10">
        <h3 className="text-zinc-400 text-sm font-medium flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4 text-zinc-500 group-hover:text-zinc-300 transition-colors" />}
          {title}
        </h3>
        {target !== undefined && (
          <span className={`text-[10px] px-2 py-0.5 rounded-full bg-zinc-950 border border-zinc-800 ${statusColor}`}>
            Meta: {prefix}{target}{suffix}
          </span>
        )}
      </div>
      
      <div className="relative z-10">
        <div className="text-2xl font-bold text-white mb-1">
          {prefix}{typeof value === 'number' ? value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : value}{suffix}
        </div>
        
        {comparison && (
           <div className="flex items-center gap-2 mt-1 mb-1 animate-in fade-in slide-in-from-left-2 duration-300">
             <div className={`text-xs font-bold flex items-center bg-zinc-950/50 px-1.5 py-0.5 rounded ${compColor}`}>
                {CompIcon && <CompIcon className="w-3 h-3 mr-0.5" />}
                {comparison.change > 0 ? '+' : ''}{comparison.change.toFixed(1)}%
             </div>
             <div className="text-[10px] text-zinc-500">
               vs {prefix}{comparison.prevValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}{suffix}
             </div>
           </div>
        )}

        {subValue && !comparison && (
          <p className="text-xs text-zinc-500">{subValue}</p>
        )}
      </div>

      {target !== undefined && (
        <div className="mt-3 h-1.5 w-full bg-zinc-950 rounded-full overflow-hidden relative z-10">
          <div 
            className={`h-full rounded-full ${isGood ? 'bg-emerald-500' : 'bg-red-500'}`} 
            style={{ width: `${Math.min((value / target) * 100, 100)}%` }}
          />
        </div>
      )}
      
      <div className="absolute right-0 bottom-0 opacity-[0.03] transform translate-y-1/4 translate-x-1/4 pointer-events-none">
         {Icon && <Icon className="w-32 h-32" />}
      </div>
    </div>
  );
};

const SimpleChart = ({ data, dataKey, color = 'bg-emerald-500', onPointClick }) => {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return (
      <div className="h-40 flex items-center justify-center bg-zinc-950/50 rounded-lg border border-zinc-800 border-dashed w-full">
        <span className="text-zinc-500 text-xs flex items-center gap-2">
          <BarChart3 className="w-4 h-4" />
          Sem dados disponíveis
        </span>
      </div>
    );
  }

  const maxVal = Math.max(...data.map(d => {
    const val = parseFloat(d[dataKey]);
    return isNaN(val) ? 0 : val;
  })) || 1; 

  return (
    <div className="flex flex-col h-40 w-full bg-zinc-950/30 rounded-lg">
      <div className="flex-1 flex items-end gap-2 pt-4 px-2">
        {data.map((item, idx) => {
          const rawVal = parseFloat(item[dataKey]);
          const val = isNaN(rawVal) ? 0 : rawVal;
          const percentage = (val / maxVal) * 100;
          
          return (
            <div 
              key={idx} 
              className="flex-1 h-full flex items-end justify-center group relative cursor-pointer"
              onClick={() => onPointClick && onPointClick(item)}
            >
               <div className="absolute top-0 opacity-0 group-hover:opacity-100 transition-opacity text-[9px] text-zinc-400 bg-zinc-900/80 px-1 rounded -translate-y-full mb-1">
                 Clique para detalhes
               </div>
               
               <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-zinc-800 text-white text-[10px] px-3 py-1.5 rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20 pointer-events-none border border-zinc-700">
                 <div className="font-semibold text-zinc-300 mb-0.5">{item.month}</div>
                 <div className="text-white font-bold">
                   {typeof rawVal === 'number' ? rawVal.toLocaleString(undefined, { maximumFractionDigits: 2 }) : item[dataKey]}
                 </div>
                 <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-zinc-800 border-r border-b border-zinc-700 rotate-45"></div>
               </div>
               
               <div className="w-full h-full absolute bottom-0 bg-zinc-800/20 rounded-t-sm z-0" />
               <div 
                 className={`w-full ${color} rounded-t-sm opacity-80 group-hover:opacity-100 transition-all duration-300 relative z-10 hover:scale-[1.02] origin-bottom`}
                 style={{ height: `${percentage}%`, minHeight: val > 0 ? '4px' : '0' }}
               />
            </div>
          );
        })}
      </div>
      
      <div className="flex gap-2 mt-2 pt-2 border-t border-zinc-800/50 px-2 pb-1">
         {data.map((item, idx) => (
            <div key={idx} className="flex-1 text-center overflow-hidden">
              <span className="text-[10px] text-zinc-500 font-medium block uppercase tracking-wider truncate">
                {item.month ? item.month.substring(0, 3) : ''}
              </span>
            </div>
         ))}
      </div>
    </div>
  );
};

const CampaignDashboard = ({ 
  initialData, 
  clientId, 
  clientName, 
  client,
  allClients = [],
  readOnly = false,
  campaigns = [],
  selectedCampaignId,
  onCampaignChange,
  onDataUpdate
}) => {
  const [data, setData] = useState(null);
  const [fileName, setFileName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef(null);
  const [uploadInfo, setUploadInfo] = useState(null);
  const [period, setPeriod] = useState('all');
  const [selectedPoint, setSelectedPoint] = useState(null);

  const computeTotalsFromRaw = (rawRows) => {
    const totals = (rawRows || []).reduce(
      (acc, r) => {
        acc.spend += Number(r.spend || 0);
        acc.conversions += Number(r.conversions || 0);
        acc.value += Number(r.value || 0);
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

    return { ...totals, roas, cpa, ctr, cpc };
  };

  const addDays = (ymd, days) => {
    const [y, m, d] = String(ymd).split('-').map(Number);
    const dt = new Date(y, (m || 1) - 1, d || 1);
    dt.setDate(dt.getDate() + days);
    const yyyy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const viewMetrics = useMemo(() => {
    if (!data) return null;
    
    if (period === 'all') {
       return {
         totals: data.totals,
         comparison: null 
       };
    }

    const days = period === '7d' ? 7 : 30;
    const raw = Array.isArray(data.raw) ? data.raw : [];
    const sorted = [...raw].filter(r => r?.date).sort((a, b) => String(a.date).localeCompare(String(b.date)));

    if (sorted.length === 0) {
      return { totals: data.totals, comparison: null };
    }

    const end = sorted[sorted.length - 1].date;
    const start = addDays(end, -(days - 1));
    const prevEnd = addDays(start, -1);
    const prevStart = addDays(prevEnd, -(days - 1));

    const currentRows = sorted.filter(r => r.date >= start && r.date <= end);
    const prevRows = sorted.filter(r => r.date >= prevStart && r.date <= prevEnd);

    const current = computeTotalsFromRaw(currentRows);
    const previous = computeTotalsFromRaw(prevRows);

    const pct = (curr, prev) => {
      const p = Number(prev || 0);
      const c = Number(curr || 0);
      if (!Number.isFinite(p) || p === 0) return null;
      return ((c - p) / p) * 100;
    };

    return {
      totals: current,
      comparison: {
        roas: { change: pct(current.roas, previous.roas), prevValue: previous.roas },
        cpa: { change: pct(current.cpa, previous.cpa), prevValue: previous.cpa },
        conversions: { change: pct(current.conversions, previous.conversions), prevValue: previous.conversions },
        spend: { change: pct(current.spend, previous.spend), prevValue: previous.spend },
        ctr: { change: pct(current.ctr, previous.ctr), prevValue: previous.ctr },
        cpc: { change: pct(current.cpc, previous.cpc), prevValue: previous.cpc }
      }
    };

  }, [data, period]);

  useEffect(() => {
    if (!viewMetrics || !viewMetrics.totals) return;
    const { totals } = viewMetrics;
    const { targets } = data;

    if (totals.roas < targets.roas * 0.8) {
      toast({
        title: "Alerta de Performance: ROAS Crítico",
        description: `O ROAS atual (${totals.roas.toFixed(2)}x) está 20% abaixo da meta.`,
        variant: "destructive",
      });
    }
  }, [viewMetrics, data]);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const parsedData = parseCSV(text);
        processData(parsedData);
        toast({ title: "Arquivo processado", description: "Dados prontos. Clique em salvar para persistir.", variant: "success" });
      } catch (error) {
        console.error(error);
        toast({ title: "Erro no arquivo", description: "Não foi possível ler o arquivo CSV.", variant: "destructive" });
      }
    };
    reader.readAsText(file);
  };

  const processData = (rawData) => {
    if (!rawData || rawData.length === 0) return;
    const totals = rawData.reduce((acc, curr) => ({
      spend: acc.spend + (curr.cost || curr.spend || 0),
      conversions: acc.conversions + (curr.conversions || 0),
      value: acc.value + (curr.value || curr.conversionvalue || 0),
      clicks: acc.clicks + (curr.clicks || 0),
      impressions: acc.impressions + (curr.impressions || 0),
    }), { spend: 0, conversions: 0, value: 0, clicks: 0, impressions: 0 });

    const roas = totals.spend > 0 ? totals.value / totals.spend : 0;
    const cpa = totals.conversions > 0 ? totals.spend / totals.conversions : 0;
    const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
    const cpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0;

    const targets = { roas: 4.0, cpa: 45.00, budget: 10000 };
    
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'];
    const trends = months.map(m => ({
      month: m,
      roas: parseFloat((roas * (0.8 + Math.random() * 0.4)).toFixed(2)),
      conversions: Math.round(totals.conversions / 6 * (0.8 + Math.random() * 0.4)),
      cpa: parseFloat((cpa * (0.9 + Math.random() * 0.2)).toFixed(2)),
      spend: parseFloat((totals.spend / 6 * (0.9 + Math.random() * 0.2)).toFixed(2)),
    }));

    setData({
      totals: { ...totals, roas, cpa, ctr, cpc },
      targets,
      trends,
      raw: rawData,
      meta: { periodStart: rawData[0]?.date || 'N/A', periodEnd: rawData[rawData.length-1]?.date || 'N/A', uploadDate: new Date().toISOString() }
    });
    setUploadInfo({ uploadDate: new Date().toLocaleDateString(), periodStart: rawData[0]?.date || 'N/A', periodEnd: rawData[rawData.length-1]?.date || 'N/A' });
  };

  const saveDataToSupabase = async (dataToSave = data) => {
    if (!dataToSave || !selectedCampaignId) {
        toast({ title: "Erro", description: "Dados ou Campanha inválidos.", variant: "destructive" });
        return;
    }

    const isUuid = (v) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
    if (!isUuid(String(selectedCampaignId))) {
      toast({
        title: "Ação indisponível",
        description: "Este painel está em modo de dados do Google Ads (ingest). Salvar aqui só funciona para campanhas internas/CSV.",
        variant: "destructive",
      });
      return;
    }
    
    setIsSaving(true);
    try {
      // 1. Update Campaign Data JSON
      const { error: updateError } = await supabase
        .from('campaigns')
        .update({ 
            data: dataToSave
        })
        .eq('id', selectedCampaignId);

      if (updateError) throw updateError;

      // 2. Insert into History
      const { error: historyError } = await supabase
        .from('campaign_history')
        .insert([{
            campaign_id: selectedCampaignId,
            data: dataToSave,
            period_start: dataToSave.meta?.periodStart || null,
            period_end: dataToSave.meta?.periodEnd || null
        }]);

      if (historyError) throw historyError;

      toast({ title: "Salvo com sucesso!", description: "Dados salvos no banco de dados.", variant: "success" });
      if (onDataUpdate) onDataUpdate();

    } catch (error) {
      console.error(error);
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const copyShareLink = () => {
    const link = `${window.location.origin}/client/${clientId}`;
    navigator.clipboard.writeText(link);
    toast({ title: "Link copiado", description: "Link de acesso do cliente copiado.", className: "bg-blue-900 border-blue-800 text-white" });
  };

  useEffect(() => {
    if (initialData) {
        // If coming from DB, it might be already structured or flattened.
        // We ensure it matches our `data` state structure.
        const structure = {
            totals: initialData.totals || {
                spend: initialData.spend || 0,
                conversions: initialData.conversions || 0,
                value: initialData.conversionValue || 0,
                clicks: initialData.clicks || 0,
                impressions: initialData.impressions || 0,
                roas: initialData.roas || 0,
                cpa: initialData.cpa || 0,
                ctr: initialData.ctr || 0,
                cpc: initialData.avgCpc || 0
            },
            targets: initialData.targets || { roas: 4, cpa: 30, budget: 5000 },
            trends: initialData.trends || [],
            raw: initialData.raw || [],
            meta: initialData.meta || { periodStart: 'N/A', periodEnd: 'N/A' }
        };

        // If no trends data but we have totals, mock it for visualization
        if (structure.trends.length === 0 && structure.totals.spend > 0) {
            const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'];
            structure.trends = months.map(m => ({
                month: m,
                roas: parseFloat((structure.totals.roas * (0.8 + Math.random() * 0.4)).toFixed(2)),
                conversions: Math.round(structure.totals.conversions / 6),
                spend: parseFloat((structure.totals.spend / 6).toFixed(2)),
                cpa: parseFloat(structure.totals.cpa.toFixed(2))
            }));
        }

        setData(structure);
    } else {
      setData(null);
    }
  }, [initialData]);

  const NoDataView = () => (
    <div className="flex flex-col items-center justify-center py-20 bg-zinc-900/20 border-2 border-dashed border-zinc-800 rounded-xl">
       <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mb-4"><FileText className="w-8 h-8 text-zinc-600" /></div>
       <h3 className="text-white font-medium mb-1">Nenhum dado de campanha disponível</h3>
       <p className="text-zinc-500 text-sm max-w-md text-center mb-6">{readOnly ? "O gestor ainda não carregou os dados." : "Selecione uma campanha ou importe um CSV para visualizar."}</p>
       {!readOnly && <Button onClick={() => fileInputRef.current?.click()} variant="outline">Selecionar Arquivo</Button>}
    </div>
  );

  return (
    <div className="space-y-8" id="campaign-dashboard-content">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-zinc-900/50 p-4 rounded-xl border border-zinc-800 print:hidden">
        <div>
          <div className="mb-2">
            <CampaignSelector campaigns={campaigns} selectedId={selectedCampaignId} onSelect={onCampaignChange} readOnly={readOnly} />
          </div>
          <p className="text-zinc-500 text-sm mt-1">
             {readOnly ? 'Acompanhe a performance da sua campanha em tempo real.' : 'Análise de KPIs e gestão de performance.'}
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-2">
            <div className="relative">
              <select 
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="h-10 pl-3 pr-8 rounded-md bg-zinc-900 border border-zinc-700 text-sm text-zinc-300 focus:ring-2 focus:ring-emerald-500/50 outline-none appearance-none cursor-pointer hover:bg-zinc-800 transition-colors w-full sm:w-40"
              >
                <option value="all">Todo Período</option>
                <option value="30d">Últimos 30 Dias</option>
                <option value="7d">Últimos 7 Dias</option>
              </select>
              <Filter className="w-3 h-3 text-zinc-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            <div className="h-6 w-px bg-zinc-800 hidden sm:block mx-2" />

            {!readOnly && (
                 <Button variant="outline" onClick={copyShareLink} className="bg-indigo-950 border-indigo-900 text-indigo-200 hover:bg-indigo-900 gap-2">
                    <Share2 className="w-4 h-4" /> <span className="hidden sm:inline">Compartilhar</span>
                 </Button>
            )}

            {data && <ExportPDF campaignName={initialData?.name || 'Relatório'} />}

            {!readOnly && (
               <>
                <input type="file" accept=".csv,.txt" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="bg-zinc-900 border-zinc-700 hover:bg-zinc-800 text-zinc-300 w-full sm:w-auto">
                  <Upload className="w-4 h-4 mr-2" /> {fileName || "Importar CSV"}
                </Button>
                {data && data.raw && data.raw.length > 0 && (
                   <Button onClick={() => saveDataToSupabase()} disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-700 text-white w-full sm:w-auto">
                     <Save className="w-4 h-4 mr-2" /> {isSaving ? "Salvando..." : "Salvar"}
                   </Button>
                )}
                {fileName && <Button variant="ghost" size="icon" onClick={() => { setFileName(''); setData(null); setUploadInfo(null); }} className="text-zinc-500 hover:text-red-400"><X className="w-4 h-4" /></Button>}
               </>
            )}
        </div>
      </div>

      {uploadInfo && (
        <div className="bg-blue-950/30 border border-blue-900/50 rounded-lg p-3 flex items-center gap-3 text-sm text-blue-200 animate-in fade-in slide-in-from-top-2">
          <Calendar className="w-4 h-4 text-blue-400" />
          <div className="flex gap-4">
             <span><strong>Dados inseridos:</strong> {uploadInfo.uploadDate}</span>
          </div>
        </div>
      )}

      <Tabs defaultValue="overview" className="w-full">
          <div className="mb-6 border-b border-zinc-800">
             <TabsList className="bg-transparent border-b-0 p-0 h-auto gap-2">
               <TabsTrigger value="overview" className="rounded-t-lg rounded-b-none border-t border-x border-transparent data-[state=active]:border-zinc-800 data-[state=active]:bg-zinc-900 data-[state=active]:text-white text-zinc-400 px-6 py-3">
                  <Layout className="w-4 h-4 mr-2" /> Painel da Campanha
               </TabsTrigger>
               <TabsTrigger value="ads" className="rounded-t-lg rounded-b-none border-t border-x border-transparent data-[state=active]:border-zinc-800 data-[state=active]:bg-zinc-900 data-[state=active]:text-white text-zinc-400 px-6 py-3">
                  <LayoutTemplate className="w-4 h-4 mr-2" /> Análise de Anúncios
               </TabsTrigger>
               <TabsTrigger value="client-overview" className="rounded-t-lg rounded-b-none border-t border-x border-transparent data-[state=active]:border-zinc-800 data-[state=active]:bg-zinc-900 data-[state=active]:text-white text-zinc-400 px-6 py-3">
                  <LayoutGrid className="w-4 h-4 mr-2" /> Visão Geral
               </TabsTrigger>
               <TabsTrigger value="history" className="rounded-t-lg rounded-b-none border-t border-x border-transparent data-[state=active]:border-zinc-800 data-[state=active]:bg-zinc-900 data-[state=active]:text-white text-zinc-400 px-6 py-3">
                  <History className="w-4 h-4 mr-2" /> Histórico & Versões
               </TabsTrigger>
             </TabsList>
          </div>

          <TabsContent value="overview" className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {!data ? <NoDataView /> : (
              <>
                {viewMetrics && (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    <KPICard 
                      title="ROAS (Retorno)" 
                      value={viewMetrics.totals.roas} 
                      target={data.targets.roas} 
                      subValue="Actual vs Target"
                      suffix="x"
                      icon={TrendingUp}
                      comparison={viewMetrics.comparison?.roas}
                    />
                    <KPICard 
                      title="CPA (Custo/Conv.)" 
                      value={viewMetrics.totals.cpa} 
                      target={data.targets.cpa} 
                      inverse={true}
                      subValue="Actual vs Target"
                      prefix="R$"
                      icon={Target}
                      comparison={viewMetrics.comparison?.cpa}
                    />
                    <KPICard 
                      title="Conversões Totais" 
                      value={viewMetrics.totals.conversions} 
                      subValue="Volume total no período"
                      icon={Activity}
                      comparison={viewMetrics.comparison?.conversions}
                    />
                    <KPICard 
                      title="CPC Médio" 
                      value={viewMetrics.totals.cpc} 
                      subValue="Custo por clique"
                      prefix="R$"
                      icon={MousePointerClick}
                      comparison={viewMetrics.comparison?.cpc}
                    />
                    <KPICard 
                      title="Impressões / CTR" 
                      value={viewMetrics.totals.ctr} 
                      subValue={`${viewMetrics.totals.impressions.toLocaleString()} imp. / ${viewMetrics.totals.clicks.toLocaleString()} cliques`}
                      suffix="%"
                      icon={Eye}
                      comparison={viewMetrics.comparison?.ctr}
                    />
                    <KPICard 
                      title="Orçamento Utilizado" 
                      value={viewMetrics.totals.spend} 
                      target={data.targets.budget}
                      inverse={true}
                      subValue={`De R$${data.targets.budget.toLocaleString()} projetado`}
                      prefix="R$"
                      icon={DollarSign}
                      comparison={viewMetrics.comparison?.spend}
                    />
                  </div>
                )}

                <div className="bg-zinc-950 p-5 rounded-xl border border-zinc-800">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-zinc-300 font-medium text-sm flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-zinc-500" />
                        Comparativo Semanal
                      </h4>
                    </div>
                    <WeekOverWeekComparison data={data} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-zinc-950 p-5 rounded-xl border border-zinc-800">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-zinc-300 font-medium text-sm flex items-center gap-2"><TrendingUp className="w-4 h-4 text-emerald-500" /> Tendência de ROAS</h4>
                    </div>
                    <SimpleChart data={data.trends} dataKey="roas" color="bg-emerald-500" onPointClick={setSelectedPoint} />
                  </div>

                  <div className="bg-zinc-950 p-5 rounded-xl border border-zinc-800">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-zinc-300 font-medium text-sm flex items-center gap-2"><Activity className="w-4 h-4 text-blue-500" /> Tendência de Conversões</h4>
                    </div>
                    <SimpleChart data={data.trends} dataKey="conversions" color="bg-blue-500" onPointClick={setSelectedPoint} />
                  </div>
                </div>
                
                {initialData && (
                  <div className="w-full">
                    <CampaignDiagnostics campaign={initialData} />
                  </div>
                )}

                <div className="w-full">
                  <CampaignOptimizationTips totals={viewMetrics?.totals || data.totals} targets={data.targets} />
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="ads">
             {!data ? <NoDataView /> : (
               <AdAnalysis
                 clientId={clientId}
                 campaignId={selectedCampaignId}
                 period={period}
                 targetRoas={data.targets.roas}
                 targetCpa={data.targets.cpa}
               />
             )}
          </TabsContent>

          <TabsContent value="client-overview">
             {clientId && (
               <DetailedMetrics
                 clientId={clientId}
                 campaignId={selectedCampaignId}
                 period={period}
               />
             )}
          </TabsContent>

          <TabsContent value="history">
             {clientId && (
               <CampaignHistory
                 clients={allClients}
                 selectedClient={client}
                 clientId={clientId}
                 campaignId={selectedCampaignId}
               />
             )}
          </TabsContent>
        </Tabs>

      <Dialog open={!!selectedPoint} onOpenChange={(open) => !open && setSelectedPoint(null)}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-emerald-500" />
              Detalhes: {selectedPoint?.month}
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
               Visão detalhada das métricas.
            </DialogDescription>
          </DialogHeader>
          
          {selectedPoint && (
            <div className="grid grid-cols-2 gap-4 mt-4">
               <div className="bg-zinc-950 p-3 rounded border border-zinc-800">
                 <span className="text-xs text-zinc-500 uppercase block mb-1">ROAS</span>
                 <span className="text-xl font-bold text-white">{typeof selectedPoint.roas === 'number' ? selectedPoint.roas.toFixed(2) : selectedPoint.roas}x</span>
               </div>
               <div className="bg-zinc-950 p-3 rounded border border-zinc-800">
                 <span className="text-xs text-zinc-500 uppercase block mb-1">Conversões</span>
                 <span className="text-xl font-bold text-white">{selectedPoint.conversions}</span>
               </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CampaignDashboard;
