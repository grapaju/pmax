import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const GoogleOAuthCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const code = searchParams.get('code');
    const errorParam = searchParams.get('error');

    if (errorParam) {
      setError(`Erro de autorização: ${errorParam}`);
      setLoading(false);
      return;
    }

    if (code) {
      // Este projeto não deve trocar code->token no navegador,
      // pois isso exige client_secret (segredo) e costuma falhar por CORS.
      setError(
        'Por segurança, a troca de código por tokens não é feita no navegador.\n' +
        'Use o script tools/get-google-ads-refresh-token.js para gerar o Refresh Token e cole nas configurações do cliente.'
      );
      setLoading(false);
    } else {
      setError('Código de autorização não encontrado');
      setLoading(false);
    }
  }, [searchParams]);

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copiado!',
      description: `${label} copiado para a área de transferência.`,
      className: 'bg-emerald-900 border-emerald-800 text-white',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Card className="max-w-md w-full p-8 bg-zinc-900 border-zinc-800">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto mb-4"></div>
            <p className="text-zinc-300">Processando autorização...</p>
          </div>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 bg-zinc-900 border-zinc-800">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Erro na Autorização</h2>
            <p className="text-zinc-400 mb-6">{error}</p>
            <div className="text-left bg-zinc-950 border border-zinc-800 rounded-md p-4 mb-6">
              <p className="text-sm text-zinc-300 mb-2">No terminal, gere o Refresh Token:</p>
              <pre className="text-xs text-zinc-300 overflow-x-auto">node tools/get-google-ads-refresh-token.js</pre>
              <p className="text-xs text-zinc-400 mt-2">
                Depois, cole o Refresh Token em <strong>Configuração &gt; Refresh Token</strong> do cliente.
              </p>
            </div>
            <Button onClick={() => navigate('/manager')} className="w-full">
              Voltar ao Dashboard
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // Se chegou aqui, não há erro, mas também não executamos o exchange no browser.
  // Mantemos um fallback simples.
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <Card className="max-w-md w-full p-8 bg-zinc-900 border-zinc-800">
        <div className="text-center">
          <h2 className="text-xl font-bold text-white mb-2">Callback Recebido</h2>
          <p className="text-zinc-400 mb-6">
            Este callback não realiza a troca de tokens no navegador.
          </p>
          <div className="text-left bg-zinc-950 border border-zinc-800 rounded-md p-4 mb-6">
            <p className="text-sm text-zinc-300 mb-2">Gere o Refresh Token via script:</p>
            <pre className="text-xs text-zinc-300 overflow-x-auto">node tools/get-google-ads-refresh-token.js</pre>
          </div>
          <Button onClick={() => navigate('/manager')} className="w-full">
            Voltar ao Dashboard
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default GoogleOAuthCallback;
