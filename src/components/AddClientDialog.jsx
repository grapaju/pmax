
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

const AddClientDialog = ({ isOpen, onClose, onAdd }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    clientId: '',
    googleAdsCustomerId: '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    await onAdd(formData);
    setLoading(false);
    setFormData({ name: '', email: '', clientId: '', googleAdsCustomerId: '' });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
        <DialogHeader>
          <DialogTitle>Adicionar Novo Cliente</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome da Empresa</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="bg-zinc-800 border-zinc-700"
              placeholder="Ex: Minha Loja Ltda"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="clientId">ID Personalizado do Cliente</Label>
             <Input
              id="clientId"
              value={formData.clientId}
              onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
              className="bg-zinc-800 border-zinc-700"
              placeholder="Ex: C-001"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email do Responsável</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="bg-zinc-800 border-zinc-700"
              placeholder="cliente@empresa.com"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="googleAdsCustomerId">ID da Conta Google Ads (Opcional)</Label>
            <Input
              id="googleAdsCustomerId"
              value={formData.googleAdsCustomerId}
              onChange={(e) => setFormData({ ...formData, googleAdsCustomerId: e.target.value })}
              className="bg-zinc-800 border-zinc-700"
              placeholder="123-456-7890"
            />
            <p className="text-xs text-zinc-500">ID da conta do cliente no Google Ads</p>
          </div>
          
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Adicionar Cliente'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddClientDialog;
