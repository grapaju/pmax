
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { ShieldCheck, Lock } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const GoogleAdsSettingsDialog = ({ isOpen, onClose, clientId }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    client_id_val: '',
    client_secret: '',
    developer_token: '',
    refresh_token: ''
  });

  useEffect(() => {
    if (isOpen && clientId) {
      loadCredentials();
    }
  }, [isOpen, clientId]);

  const loadCredentials = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('google_ads_client_id, google_ads_client_secret, google_ads_developer_token, google_ads_refresh_token')
        .eq('id', clientId)
        .single();
        
      if (data) {
        setFormData({
          client_id_val: data.google_ads_client_id || '',
          client_secret: data.google_ads_client_secret || '',
          developer_token: data.google_ads_developer_token || '',
          refresh_token: data.google_ads_refresh_token || ''
        });
      }
    } catch (err) {
      console.error('Erro ao carregar credenciais:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from('clients')
        .update({
          google_ads_client_id: formData.client_id_val,
          google_ads_client_secret: formData.client_secret,
          google_ads_developer_token: formData.developer_token,
          google_ads_refresh_token: formData.refresh_token
        })
        .eq('id', clientId);

      if (error) throw error;

      toast({
        title: "Credenciais Salvas",
        description: "As configurações do Google Ads foram salvas com sucesso.",
        className: "bg-emerald-900 border-emerald-800 text-white"
      });
      onClose();

    } catch (err) {
      console.error(err);
      toast({
        title: "Erro ao salvar",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-zinc-900 border-zinc-800 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <ShieldCheck className="w-5 h-5 text-blue-500" />
            Configuração da API Google Ads
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            Credenciais criptografadas e armazenadas no Supabase.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="clientId" className="text-zinc-300">Client ID</Label>
            <Input
              id="clientId"
              type="text"
              placeholder="123456789-abc..."
              value={formData.client_id_val || ''}
              onChange={(e) => setFormData({ ...formData, client_id_val: e.target.value })}
              className="bg-zinc-950 border-zinc-800 focus:border-blue-500"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="clientSecret" className="text-zinc-300">Client Secret</Label>
            <div className="relative">
                <Input
                id="clientSecret"
                type="password"
                placeholder="GOCSPX-..."
                value={formData.client_secret || ''}
                onChange={(e) => setFormData({ ...formData, client_secret: e.target.value })}
                className="bg-zinc-950 border-zinc-800 focus:border-blue-500 pr-8"
                required
                />
                <Lock className="w-4 h-4 text-zinc-600 absolute right-3 top-3" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="devToken" className="text-zinc-300">Developer Token</Label>
            <Input
              id="devToken"
              type="text"
              placeholder="AbC123XyZ..."
              value={formData.developer_token || ''}
              onChange={(e) => setFormData({ ...formData, developer_token: e.target.value })}
              className="bg-zinc-950 border-zinc-800 focus:border-blue-500"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="refreshToken" className="text-zinc-300">Refresh Token</Label>
             <div className="relative">
                <Input
                id="refreshToken"
                type="password"
                placeholder="1//04..."
                value={formData.refresh_token || ''}
                onChange={(e) => setFormData({ ...formData, refresh_token: e.target.value })}
                className="bg-zinc-950 border-zinc-800 focus:border-blue-500"
                required
                />
                <Lock className="w-4 h-4 text-zinc-600 absolute right-3 top-3" />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              onClick={onClose}
              variant="outline"
              className="bg-transparent border-zinc-800 text-zinc-300 hover:bg-zinc-800"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white border-0"
            >
              {loading ? "Salvando..." : "Salvar Configuração"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default GoogleAdsSettingsDialog;
