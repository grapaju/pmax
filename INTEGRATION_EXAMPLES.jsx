// EXEMPLO: Como integrar no ClientDashboard.jsx

import React from 'react';
import GoogleAdsIntegration from '@/components/GoogleAdsIntegration';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function ClientDashboard() {
  const [currentClient, setCurrentClient] = useState(null);

  // ... resto do código existente

  return (
    <div className="space-y-6">
      {/* Seu header existente */}
      <div className="flex items-center justify-between">
        <h1>Dashboard do Cliente</h1>
      </div>

      {/* Adicione as tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="campaigns">Campanhas</TabsTrigger>
          <TabsTrigger value="google-ads">Google Ads</TabsTrigger> {/* NOVO */}
        </TabsList>

        {/* Suas tabs existentes */}
        <TabsContent value="overview">
          {/* Seu conteúdo existente */}
        </TabsContent>

        <TabsContent value="campaigns">
          {/* Seu conteúdo existente */}
        </TabsContent>

        {/* NOVA TAB: Google Ads Integration */}
        <TabsContent value="google-ads">
          {currentClient && (
            <GoogleAdsIntegration client={currentClient} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================
// ALTERNATIVA: Como seção separada (sem tabs)
// ============================================

export function ClientDashboardAlternative() {
  const [currentClient, setCurrentClient] = useState(null);

  return (
    <div className="space-y-6">
      {/* Seu conteúdo existente do dashboard */}
      <div>
        {/* Cards de métricas, gráficos, etc */}
      </div>

      {/* Adicione uma seção para Google Ads */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Análise Google Ads</h2>
        {currentClient && (
          <GoogleAdsIntegration client={currentClient} />
        )}
      </div>
    </div>
  );
}

// ============================================
// ALTERNATIVA 2: Como card colapsável
// ============================================

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ChevronDown, ChevronUp } from 'lucide-react';

export function ClientDashboardWithCollapsible() {
  const [currentClient, setCurrentClient] = useState(null);
  const [showGoogleAds, setShowGoogleAds] = useState(false);

  return (
    <div className="space-y-6">
      {/* Seu conteúdo existente */}
      
      {/* Card colapsável de Google Ads */}
      <Card>
        <CardHeader 
          className="cursor-pointer"
          onClick={() => setShowGoogleAds(!showGoogleAds)}
        >
          <div className="flex items-center justify-between">
            <CardTitle>Google Ads - Análise e Otimização</CardTitle>
            {showGoogleAds ? <ChevronUp /> : <ChevronDown />}
          </div>
        </CardHeader>
        {showGoogleAds && (
          <CardContent>
            {currentClient && (
              <GoogleAdsIntegration client={currentClient} />
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}

// ============================================
// ALTERNATIVA 3: Como página separada (Route)
// ============================================

// Em App.jsx ou routes:
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import GoogleAdsPage from './pages/GoogleAdsPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/clients/:id" element={<ClientDashboard />} />
        <Route path="/clients/:id/google-ads" element={<GoogleAdsPage />} /> {/* NOVO */}
      </Routes>
    </BrowserRouter>
  );
}

// Em pages/GoogleAdsPage.jsx:
import { useParams } from 'react-router-dom';
import GoogleAdsIntegration from '@/components/GoogleAdsIntegration';

export default function GoogleAdsPage() {
  const { id } = useParams();
  const [client, setClient] = useState(null);

  useEffect(() => {
    // Buscar cliente por ID
    const fetchClient = async () => {
      const { data } = await supabase
        .from('clients')
        .select('*')
        .eq('id', id)
        .single();
      setClient(data);
    };
    fetchClient();
  }, [id]);

  return (
    <div className="container mx-auto py-6">
      <GoogleAdsIntegration client={client} />
    </div>
  );
}
