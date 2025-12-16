
import React, { useState, useEffect } from 'react';
import { LogOut, Plus, Users, LayoutDashboard, ChevronLeft, AlertCircle, CheckCircle2, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ClientCard from '@/components/ClientCard';
import AddClientDialog from '@/components/AddClientDialog';
import PerformanceAlerts from '@/components/PerformanceAlerts';
import MetricCard from '@/components/MetricCard';
import TicketsSystem from '@/components/TicketsSystem';
import CampaignDashboard from '@/components/CampaignDashboard';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { fetchGoogleAdsTotalsByClientIds, fetchCampaignDashboardData, fetchGoogleAdsCampaignsByClientId } from '@/lib/googleAdsDashboardLoader';

const ManagerDashboard = ({ user }) => {
  const { signOut } = useAuth();
  const [clients, setClients] = useState([]);
  const [isAddClientOpen, setIsAddClientOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState('30d');
  const [isTicketsOpen, setIsTicketsOpen] = useState(false);
  const [unreadTickets, setUnreadTickets] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  
  // Campaign Selection State
  const [clientCampaigns, setClientCampaigns] = useState([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState(null);

  useEffect(() => {
    if (user) {
        fetchClients();
    }
  }, [user, selectedPeriod]);

  const fetchClients = async () => {
    setLoading(true);
    try {
      // Fetch clients and their campaigns using the text foreign key relationship
      const { data, error } = await supabase
        .from('clients')
        .select(`
            *,
            campaigns (*)
        `)
        .eq('owner_id', user.id);

      if (error) throw error;

      // Enriquecer campanhas com totais reais (google_ads_metrics) no período selecionado
      const baseClients = data || [];
      const ids = baseClients.map((c) => c.id).filter(Boolean);

      let totalsByClient = new Map();
      try {
        totalsByClient = await fetchGoogleAdsTotalsByClientIds(ids, selectedPeriod);
      } catch (e) {
        // Se RLS/config ainda não permitir, mantemos o fallback sem quebrar o dashboard.
        console.warn('Não foi possível carregar google_ads_metrics para cards:', e?.message || e);
      }

      const hydrated = baseClients.map((client) => {
        const totals = totalsByClient.get(client.id);
        if (!totals) return client;

        return {
          ...client,
          campaigns: (client.campaigns || []).map((c) => ({
            ...c,
            data: {
              ...(c.data || {}),
              __googleAdsLive: true,
              spend: totals.spend,
              impressions: totals.impressions,
              clicks: totals.clicks,
              conversions: totals.conversions,
              conversionValue: totals.conversionValue,
              roas: totals.spend > 0 ? totals.conversionValue / totals.spend : 0,
              cpa: totals.conversions > 0 ? totals.spend / totals.conversions : 0,
              ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0,
              avgCpc: totals.clicks > 0 ? totals.spend / totals.clicks : 0,
            },
          })),
        };
      });

      setClients(hydrated);
    } catch (error) {
      console.error('Error fetching clients:', error);
      toast({
        title: "Erro ao carregar",
        description: "Não foi possível buscar seus clientes.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Auto-refresh quando o script ingerir novos dados
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('manager-google-ads-ingest')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'google_ads_activity_log' },
        (payload) => {
          const row = payload?.new;
          if (!row || row.action !== 'script_ingest') return;
          // Recarrega cards/visão quando houver novo ingest
          fetchClients();
          setRefreshKey((k) => k + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, selectedPeriod]);

  // Update campaigns when client changes
  useEffect(() => {
    const load = async () => {
      if (!selectedClient?.id) {
        setClientCampaigns([]);
        setSelectedCampaignId(null);
        return;
      }

      try {
        const googleCampaigns = await fetchGoogleAdsCampaignsByClientId(selectedClient.id);
        setClientCampaigns(googleCampaigns);
        if (googleCampaigns.length > 0) {
          setSelectedCampaignId((prev) => prev || googleCampaigns[0].id);
        } else {
          setSelectedCampaignId(null);
        }
      } catch (e) {
        console.warn('Falha ao carregar google_ads_campaigns:', e?.message || e);
        setClientCampaigns([]);
        setSelectedCampaignId(null);
      }
    };

    load();
  }, [selectedClient?.id]);

  const handleAddClient = async (newClientData) => {
    try {
        // Create client with new schema
        const { data: clientData, error: clientError } = await supabase
            .from('clients')
            .insert([{
                client_id: newClientData.clientId, // Custom ID (e.g., C-001)
                client_name: newClientData.name,
                email: newClientData.email,
                owner_id: user.id,
                google_ads_customer_id: newClientData.googleAdsCustomerId || null
            }])
            .select()
            .single();

        if (clientError) throw clientError;

        // Create default campaign linked by client UUID
        const { error: campError } = await supabase
            .from('campaigns')
            .insert([{
                client_id: clientData.id, // ✅ Using UUID for FK
                name: 'Campanha Padrão',
                budget: 1000,
                status: 'active',
                data: {}
            }]);
        
        if (campError) console.error("Error creating default campaign:", campError);

        toast({ title: "Cliente adicionado", description: "Cliente criado com sucesso." });
        fetchClients();
        setIsAddClientOpen(false);

    } catch (error) {
        console.error("Error adding client:", error);
        toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  // Transform DB data for UI compatibility
  const getFilteredClients = () => {
    const multiplier = selectedPeriod === '7d' ? 0.25 : 
                       selectedPeriod === '15d' ? 0.5 : 
                       selectedPeriod === '60d' ? 2 : 
                       selectedPeriod === '90d' ? 3 : 1;
    
    return clients.map(client => {
      const mappedCampaigns = (client.campaigns || []).map(c => {
         const baseData = c.data || {};
        const factor = baseData.__googleAdsLive ? 1 : multiplier;
         return {
            ...baseData,
            id: c.id,
            name: c.name,
            budget: c.budget,
            status: c.status,
          spend: Math.round((baseData.spend || 0) * factor),
          impressions: Math.round((baseData.impressions || 0) * factor),
          clicks: Math.round((baseData.clicks || 0) * factor),
          conversions: Math.round((baseData.conversions || 0) * factor),
          conversionValue: Math.round((baseData.conversionValue || 0) * factor),
         };
      });

      return {
          ...client,
          // Map new schema fields to props expected by components
          name: client.client_name, 
          // Keep internal ID but ensure components know about display ID
          displayId: client.client_id, 
          campaigns: mappedCampaigns
      };
    });
  };

  const filteredClients = getFilteredClients();
  const currentViewClient = selectedClient 
    ? filteredClients.find(c => c.id === selectedClient.id) 
    : null;
    
  const currentCampaign = clientCampaigns.find(c => c.id === selectedCampaignId);
  const [currentCampaignData, setCurrentCampaignData] = useState(null);

  useEffect(() => {
    const load = async () => {
      if (!currentViewClient?.id) {
        setCurrentCampaignData(null);
        return;
      }
      try {
        const dashboardData = await fetchCampaignDashboardData({ clientId: currentViewClient.id, period: selectedPeriod, campaignId: selectedCampaignId });
        setCurrentCampaignData({
          ...(dashboardData || {}),
          id: selectedCampaignId,
          name: currentCampaign?.name,
          budget: null,
        });
      } catch (e) {
        console.warn('Falha ao carregar dashboard google_ads_metrics:', e?.message || e);
        // fallback: mantém o que já existia no campaign.data
        setCurrentCampaignData(null);
      }
    };

    load();
  }, [currentViewClient?.id, selectedPeriod, selectedCampaignId, refreshKey, clientCampaigns.length]);

  const totalSpend = filteredClients.reduce((sum, client) => 
    sum + client.campaigns.reduce((cSum, c) => cSum + (c.spend || 0), 0), 0
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="bg-zinc-900 border-b border-zinc-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {selectedClient && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setSelectedClient(null)}
                  className="text-zinc-400 hover:text-white hover:bg-zinc-800"
                >
                  <ChevronLeft className="w-5 h-5" />
                </Button>
              )}
              <div>
                <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                  <LayoutDashboard className="w-6 h-6 text-emerald-500" />
                  {selectedClient ? selectedClient.client_name : 'Painel do Gerente'}
                </h1>
                <p className="text-zinc-500 text-sm">
                  {selectedClient ? `ID: ${selectedClient.client_id}` : `Bem-vindo de volta, ${user.name}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={() => setIsTicketsOpen(true)}
                variant="outline"
                className="relative bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800 hover:text-white"
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                Tickets
                {unreadTickets > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white">
                    {unreadTickets}
                  </span>
                )}
              </Button>
              <Button
                onClick={signOut}
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
        
        {!selectedClient ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <MetricCard 
                title="Total de Clientes" 
                value={filteredClients.length} 
                icon={Users} 
                color="blue" 
              />
              <MetricCard 
                title="Gasto Total" 
                value={`R$${totalSpend.toLocaleString()}`} 
                icon={Users} 
                color="green" 
                trend="up" 
                trendValue="+12%" 
              />
               <MetricCard 
                title="Alertas Ativos" 
                value="3" 
                subValue="Requer Atenção"
                icon={AlertCircle} 
                color="orange" 
                status="warning"
              />
               <MetricCard 
                title="Status do Sistema" 
                value="Conectado" 
                icon={CheckCircle2} 
                color="blue" 
                status="good"
              />
            </div>

            <div className="grid grid-cols-1 gap-6 mb-8">
              <PerformanceAlerts clients={filteredClients} />
            </div>

            <div className="mb-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">Portfólio de Clientes</h2>
                <Button
                  onClick={() => setIsAddClientOpen(true)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white border-0 shadow-lg shadow-emerald-900/20"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar Cliente
                </Button>
              </div>

              {loading ? (
                <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div></div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredClients.map((client, index) => (
                    <ClientCard 
                        key={client.id} 
                        client={client} 
                        index={index}
                        onClick={() => setSelectedClient(client)}
                    />
                    ))}
                    {filteredClients.length === 0 && (
                        <div className="col-span-full text-center py-12 text-zinc-500 bg-zinc-900/50 rounded-lg border border-zinc-800 border-dashed">
                            Nenhum cliente encontrado. Adicione um novo cliente para começar.
                        </div>
                    )}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="animate-in slide-in-from-right duration-300">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">Análise Detalhada: {currentViewClient.client_name}</h2>
              <span className="text-sm text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                Modo Performance PMax
              </span>
            </div>

             <CampaignDashboard 
                initialData={currentCampaignData} 
                clientId={currentViewClient.id}
                clientName={currentViewClient.client_name}
                client={currentViewClient}
                allClients={filteredClients}
                campaigns={clientCampaigns}
                selectedCampaignId={selectedCampaignId}
                onCampaignChange={setSelectedCampaignId}
                onDataUpdate={fetchClients} 
             />
          </div>
        )}
      </div>

      <AddClientDialog
        isOpen={isAddClientOpen}
        onClose={() => setIsAddClientOpen(false)}
        onAdd={handleAddClient}
      />
      
      {isTicketsOpen && (
        <TicketsSystem user={user} onClose={() => setIsTicketsOpen(false)} />
      )}
    </div>
  );
};

export default ManagerDashboard;
