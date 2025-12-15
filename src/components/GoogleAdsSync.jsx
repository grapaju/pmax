
import React, { useState, useEffect } from 'react';
import { RefreshCw, CloudLightning, CheckCircle2, AlertCircle, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { collectGoogleAdsData, downloadGoogleAdsExportZip } from '@/lib/googleAdsApi';

const GoogleAdsSync = ({ campaignId, onSyncComplete, clientId, googleAdsId }) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [status, setStatus] = useState('idle');

  useEffect(() => {
    // Optionally load last sync time from DB if stored, for now localStorage is fine for UI state
    // or better, pass last updated from parent
  }, [campaignId]);

  const handleSync = async (isAuto = false) => {
    if (!googleAdsId && !isAuto) {
         toast({ 
             title: "Configuração Pendente", 
             description: "Este cliente não possui um ID do Google Ads configurado.", 
             variant: "destructive" 
         });
         return;
    }

    setIsSyncing(true);
    setStatus('syncing');
    
    if (!isAuto) {
        toast({ 
          title: "Sincronização Iniciada", 
          description: "Coletando dados do Google Ads...", 
          className: "bg-blue-900 border-blue-800 text-white" 
        });
    }

    try {
      console.log('🚀 Iniciando sincronização...', { campaignId, clientId, googleAdsId });

      const result = await collectGoogleAdsData({ clientId, days: 30 });
      console.log('✅ Resposta da coleta:', result);
      
      const processedData = processApiData(result.data);
      
      const now = new Date().toISOString();
      setLastSync(now);
      setStatus('success');
      
      if (onSyncComplete) {
        onSyncComplete(processedData);
      }
      
      toast({ 
          title: "Sincronização Concluída", 
          description: `${result.campaigns || 0} campanhas e ${result.keywords || 0} palavras-chave coletadas.`, 
          className: "bg-emerald-900 border-emerald-800 text-white",
          duration: 5000
      });

    } catch (error) {
      console.error("❌ Erro na sincronização:", error);
      setStatus('error');
      
      toast({ 
          title: "Erro na Sincronização", 
          description: error.message || "Falha ao conectar com Google Ads API.", 
          variant: "destructive" 
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDownloadCsv = async () => {
    if (!clientId) {
      toast({
        title: 'Cliente inválido',
        description: 'clientId não encontrado para exportar CSV.',
        variant: 'destructive',
      });
      return;
    }

    setIsDownloading(true);
    try {
      const { blob, filename } = await downloadGoogleAdsExportZip({ clientId, campaignId });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast({
        title: 'CSV gerado',
        description: 'Download iniciado (ZIP com todos os CSVs).',
        className: 'bg-zinc-900 border-zinc-800 text-white',
      });
    } catch (error) {
      toast({
        title: 'Falha ao baixar CSV',
        description: error.message || 'Não foi possível gerar o CSV.',
        variant: 'destructive',
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const processApiData = (rawData) => {
    if (!rawData || !Array.isArray(rawData)) return null;

    // 1. Calculate Totals
    const totals = rawData.reduce((acc, curr) => ({
        spend: acc.spend + (curr.cost || 0),
        conversions: acc.conversions + (curr.conversions || 0),
        value: acc.value + (curr.conversionValue || 0),
        clicks: acc.clicks + (curr.clicks || 0),
        impressions: acc.impressions + (curr.impressions || 0),
    }), { spend: 0, conversions: 0, value: 0, clicks: 0, impressions: 0 });

    const roas = totals.spend > 0 ? totals.value / totals.spend : 0;
    const cpa = totals.conversions > 0 ? totals.spend / totals.conversions : 0;
    const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
    const cpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0;

    // 2. Mock Trends for display based on raw data
    // In real app, we would aggregate by month properly
    const trends = []; // Simplified for this view

    const targets = { roas: 4.0, cpa: 45.00, budget: 5000 };

    return {
        totals: { ...totals, roas, cpa, ctr, cpc },
        targets,
        trends,
        raw: rawData,
        meta: {
            periodStart: rawData[rawData.length - 1]?.date,
            periodEnd: rawData[0]?.date,
            uploadDate: new Date().toISOString(),
            source: 'Google Ads API (Edge)'
        }
    };
  };

  return (
    <div className="flex items-center gap-4 bg-zinc-950/50 p-2 rounded-lg border border-zinc-800 print:hidden">
      <div className="flex flex-col items-end mr-2">
        <div className="flex items-center gap-2 text-xs text-zinc-400">
             {status === 'success' && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
             {status === 'error' && <AlertCircle className="w-3 h-3 text-red-500" />}
             {status === 'syncing' && <RefreshCw className="w-3 h-3 text-blue-500 animate-spin" />}
             <span>
               {lastSync 
                 ? `Última sinc: ${new Date(lastSync).toLocaleDateString()} ${new Date(lastSync).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`
                 : 'Sincronização pendente'
               }
             </span>
        </div>
      </div>
      
      <Button 
        onClick={() => handleSync(false)} 
        disabled={isSyncing}
        size="sm"
        className={`gap-2 ${isSyncing ? 'bg-zinc-800' : 'bg-blue-600 hover:bg-blue-700'} text-white border-0`}
      >
        {isSyncing ? (
            <>
                <RefreshCw className="w-3 h-3 animate-spin" />
                Sincronizando...
            </>
        ) : (
            <>
                <CloudLightning className="w-3 h-3" />
                Sincronizar
            </>
        )}
      </Button>

      <Button
        onClick={handleDownloadCsv}
        disabled={isDownloading}
        size="sm"
        variant="outline"
        className="gap-2 bg-zinc-900 border-zinc-700 hover:bg-zinc-800 text-zinc-300"
      >
        <Download className={`w-3 h-3 ${isDownloading ? 'animate-pulse' : ''}`} />
        {isDownloading ? 'Baixando...' : 'Baixar CSV'}
      </Button>
    </div>
  );
};

export default GoogleAdsSync;
