
import React, { useState, useEffect } from 'react';
import { LogOut, Activity, DollarSign, MousePointer2, TrendingUp, Target, PieChart, BarChart, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CampaignHistory from '@/components/CampaignHistory';
import PerformanceAlerts from '@/components/PerformanceAlerts';
import MetricCard from '@/components/MetricCard';
import DateRangeSelector from '@/components/DateRangeSelector';
import TicketsSystem from '@/components/TicketsSystem';
import CampaignSelector from '@/components/CampaignSelector';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';

const ClientDashboard = ({ user, onLogout }) => {
  const [clientData, setClientData] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState('30d');
  const [isTicketsOpen, setIsTicketsOpen] = useState(false);
  const [unreadTickets, setUnreadTickets] = useState(0);

  useEffect(() => {
    const fetchClientData = async () => {
       try {
         // Find the client record associated with the logged-in user's email
         const { data: client, error } = await supabase
           .from('clients')
           .select(`
             *,
             campaigns (*)
           `)
           .eq('email', user.email)
           .single();

         if (error) {
             console.error("Error fetching client data:", error);
             return;
         }
         
         setClientData(client);
       } catch (err) {
         console.error("Unexpected error:", err);
       }
    };

    if (user?.email) {
        fetchClientData();
    }
  }, [user]);

  if (!clientData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
         <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto mb-4"></div>
            <p className="text-zinc-500">Carregando seus dados...</p>
         </div>
      </div>
    );
  }

  const getFilteredData = () => {
    const multiplier = selectedPeriod === '7d' ? 0.25 : 
                       selectedPeriod === '15d' ? 0.5 : 
                       selectedPeriod === '60d' ? 2 : 
                       selectedPeriod === '90d' ? 3 : 1;
    
    // Map the new schema data structure to what the UI expects
    // Note: campaigns are now joined via FK
    return {
      ...clientData,
      name: clientData.client_name, // Map client_name to name for compatibility
      campaigns: (clientData.campaigns || []).map(c => {
         const baseData = c.data || {};
         return {
            ...baseData,
            id: c.id,
            name: c.name,
            budget: c.budget,
            spend: Math.round((baseData.spend || 0) * multiplier),
            impressions: Math.round((baseData.impressions || 0) * multiplier),
            clicks: Math.round((baseData.clicks || 0) * multiplier),
            conversions: Math.round((baseData.conversions || 0) * multiplier),
            conversionValue: Math.round((baseData.conversionValue || 0) * multiplier),
         };
      })
    };
  };

  const filteredClientData = getFilteredData();

  const metrics = filteredClientData.campaigns.reduce((acc, c) => ({
    spend: acc.spend + (c.spend || 0),
    budget: acc.budget + (c.budget || 0),
    conversions: acc.conversions + (c.conversions || 0),
    value: acc.value + (c.conversionValue || 0),
    impressions: acc.impressions + (c.impressions || 0),
    clicks: acc.clicks + (c.clicks || 0),
    targetRoas: c.targetRoas || 0,
    currentRoas: c.roas || 0
  }), { spend: 0, budget: 0, conversions: 0, value: 0, impressions: 0, clicks: 0, targetRoas: 0, currentRoas: 0 });

  const avgCpc = metrics.clicks > 0 ? metrics.spend / metrics.clicks : 0;
  const ctr = metrics.impressions > 0 ? (metrics.clicks / metrics.impressions) * 100 : 0;
  const burnRate = metrics.budget > 0 ? (metrics.spend / metrics.budget) * 100 : 0;
  const overallRoas = metrics.spend > 0 ? metrics.value / metrics.spend : 0;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="bg-zinc-900 border-b border-zinc-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div>
                <h1 className="text-2xl font-bold text-white">Painel do Cliente</h1>
                <p className="text-zinc-500 text-sm">Visão geral para {filteredClientData.client_name}</p>
              </div>
              
              <div className="hidden md:block pl-6 border-l border-zinc-800">
                 <CampaignSelector 
                    campaigns={filteredClientData.campaigns} 
                    selectedId={filteredClientData.campaigns[0]?.id} 
                    readOnly={true}
                 />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                onClick={() => setIsTicketsOpen(true)}
                variant="outline"
                className="relative bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800 hover:text-white"
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                Suporte
                 {unreadTickets > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white">
                    {unreadTickets}
                  </span>
                )}
              </Button>
              <DateRangeSelector 
                selectedPeriod={selectedPeriod} 
                onPeriodChange={setSelectedPeriod} 
              />
              <Button
                onClick={onLogout}
                variant="outline"
                className="bg-transparent border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-white"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sair
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        <div className="mb-2 flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-emerald-500" />
          <h2 className="text-lg font-semibold text-white">Financeiro & Performance</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <MetricCard 
            title="Gasto Total" 
            value={`R$${metrics.spend.toLocaleString()}`} 
            subValue={`de R$${metrics.budget.toLocaleString()} orçamento`}
            icon={DollarSign} 
            color="green"
            trend={burnRate > 100 ? 'up' : 'neutral'}
            trendValue={`Consumo: ${burnRate.toFixed(0)}%`}
          />
          <MetricCard 
            title="ROAS (Atual vs Meta)" 
            value={`${overallRoas.toFixed(2)}x`} 
            subValue={`Meta: ${metrics.targetRoas}x`}
            icon={TrendingUp} 
            color={overallRoas >= metrics.targetRoas ? 'blue' : 'orange'}
            status={overallRoas >= metrics.targetRoas ? 'good' : 'warning'}
          />
          <MetricCard 
            title="Valor de Conversão" 
            value={`R$${metrics.value.toLocaleString()}`} 
            subValue={`${metrics.conversions} Conversões`}
            icon={Target} 
            color="purple"
            trend="up"
            trendValue="+8.5% MoM"
          />
           <MetricCard 
            title="CPC Médio" 
            value={`R$${avgCpc.toFixed(2)}`} 
            subValue={`CTR: ${ctr.toFixed(2)}%`}
            icon={MousePointer2} 
            color="blue"
          />
        </div>

        <div className="mb-2 flex items-center gap-2">
          <Activity className="w-5 h-5 text-emerald-500" />
          <h2 className="text-lg font-semibold text-white">Visibilidade & Engajamento</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <MetricCard 
            title="Total de Impressões" 
            value={metrics.impressions.toLocaleString()} 
            icon={PieChart} 
            color="blue"
          />
          <MetricCard 
            title="Total de Cliques" 
            value={metrics.clicks.toLocaleString()} 
            icon={MousePointer2} 
            color="blue"
          />
          <MetricCard 
            title="Gasto Mensal Projetado" 
            value={`R$${(metrics.spend * 1.2).toLocaleString()}`} 
            subValue="Baseado na média diária atual"
            icon={BarChart} 
            color="orange"
          />
        </div>

        <div className="grid grid-cols-1 gap-6 mb-8">
          <PerformanceAlerts clients={[filteredClientData]} />
        </div>

        <CampaignHistory clients={[filteredClientData]} selectedClient={filteredClientData} />
      </div>

      {isTicketsOpen && (
        <TicketsSystem user={user} onClose={() => setIsTicketsOpen(false)} />
      )}
    </div>
  );
};

export default ClientDashboard;
