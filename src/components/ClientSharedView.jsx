
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import CampaignDashboard from '@/components/CampaignDashboard';
import { ShieldAlert } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';

const ClientSharedView = () => {
  const { clientId } = useParams();
  const [clientData, setClientData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [campaigns, setCampaigns] = useState([]);

  useEffect(() => {
    const fetchClientData = async () => {
      try {
        setLoading(true);
        
        // Fetch Client and Campaigns
        const { data: client, error } = await supabase
            .from('clients')
            .select(`
                *,
                campaigns (*)
            `)
            .eq('id', clientId)
            .single();

        if (error) throw error;
        
        if (client && client.campaigns && client.campaigns.length > 0) {
            setCampaigns(client.campaigns);
            
            // Format first campaign for display
            const mainCampaign = client.campaigns[0];
            const campaignData = mainCampaign.data || {};
            
            setClientData({
                ...campaignData,
                id: mainCampaign.id,
                name: `${client.name} - ${mainCampaign.name}`,
                budget: mainCampaign.budget
            });
        } else {
            setError("Nenhuma campanha encontrada para este cliente.");
        }

      } catch (err) {
        console.error(err);
        setError("Dados não encontrados ou link inválido.");
      } finally {
        setLoading(false);
      }
    };

    if (clientId) {
        fetchClientData();
    }
  }, [clientId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (error || !clientData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 text-white p-4">
        <ShieldAlert className="w-16 h-16 text-zinc-700 mb-4" />
        <h1 className="text-2xl font-bold mb-2">Acesso Indisponível</h1>
        <p className="text-zinc-500 text-center max-w-md">
           {error}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <Helmet>
        <title>{clientData.name} - Relatório de Performance</title>
      </Helmet>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <header className="mb-8 border-b border-zinc-800 pb-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white mb-1">{clientData.name}</h1>
                    <p className="text-zinc-500 text-sm">Relatório de Performance - Visualização do Cliente</p>
                </div>
                <div className="text-right hidden sm:block">
                    <p className="text-xs text-zinc-500 uppercase tracking-wider">Status</p>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span className="text-sm font-medium text-emerald-400">Ativo</span>
                    </div>
                </div>
            </div>
        </header>

        <CampaignDashboard 
            initialData={clientData} 
            clientId={clientId}
            clientName={clientData.name}
            readOnly={true}
            campaigns={campaigns}
            selectedCampaignId={clientData.id}
        />
      </div>
      
      <footer className="py-8 text-center text-zinc-600 text-xs border-t border-zinc-900 mt-12">
        <p>Gerado automaticamente pela Plataforma PMax Manager.</p>
        <p className="mt-1">&copy; {new Date().getFullYear()} Todos os direitos reservados.</p>
      </footer>
    </div>
  );
};

export default ClientSharedView;
