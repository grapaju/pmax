
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MessageSquare, Send, Plus, Search, Clock, CheckCircle2, 
  AlertCircle, ChevronRight, User, Shield, Filter, Trash2, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/lib/customSupabaseClient';

const TicketsSystem = ({ user, onClose }) => {
  const [tickets, setTickets] = useState([]);
  const [clients, setClients] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTicketData, setNewTicketData] = useState({ title: '', message: '', targetClientId: '', priority: 'medium' });
  const [clientFilter, setClientFilter] = useState('all');
  const [isDeleting, setIsDeleting] = useState(false);
  const [loadingTickets, setLoadingTickets] = useState(true);
  
  const messagesEndRef = useRef(null);

  // 1. Fetch Tickets on Mount
  useEffect(() => {
    if (user) {
      fetchTickets();
      if (user.role === 'manager') {
        fetchClients();
      }
    }
  }, [user]);

  // 2. Fetch Messages when Ticket Selected
  useEffect(() => {
    if (selectedTicket) {
      fetchMessages(selectedTicket.id);
    } else {
      setMessages([]);
    }
  }, [selectedTicket]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (selectedTicket && messages.length > 0) {
      scrollToBottom();
    }
  }, [messages, selectedTicket]);

  const fetchTickets = async () => {
    setLoadingTickets(true);
    try {
      // RLS policies will filter this automatically for us
      const { data, error } = await supabase
        .from('tickets')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setTickets(data || []);
    } catch (error) {
      console.error('Error fetching tickets:', error);
      toast({ title: "Erro", description: "Falha ao carregar tickets.", variant: "destructive" });
    } finally {
      setLoadingTickets(false);
    }
  };

  const fetchClients = async () => {
    try {
      const { data } = await supabase.from('clients').select('id, client_id, client_name');
      setClients(data || []);
    } catch (error) {
      console.error('Error fetching clients for tickets:', error);
    }
  };

  const fetchMessages = async (ticketId) => {
    try {
      const { data, error } = await supabase
        .from('ticket_messages')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleCreateTicket = async () => {
    if (!newTicketData.title.trim() || !newTicketData.message.trim()) {
       toast({ title: "Erro", description: "Preencha todos os campos.", variant: "destructive" });
       return;
    }

    let targetClientId = user.role === 'manager' ? newTicketData.targetClientId : null;
    let targetClientName = 'Cliente';

    // If manager, must select client. If client, fetch their ID automatically.
    if (user.role === 'manager') {
      if (!targetClientId) {
        toast({ title: "Erro", description: "Selecione um cliente.", variant: "destructive" });
        return;
      }
      // Manter o UUID, apenas pegar o nome
      const clientObj = clients.find(c => c.id === targetClientId);
      if (clientObj) {
          // targetClientId já é o UUID correto (c.id)
          targetClientName = clientObj.client_name;
      }
    } else {
        // Find client record for this user
        try {
            const { data: clientRecord } = await supabase.from('clients').select('id, client_name').eq('email', user.email).single();
            if (clientRecord) {
                targetClientId = clientRecord.id; // ✅ UUID
                targetClientName = clientRecord.client_name;
            }
        } catch (e) {
            console.error("Could not find client record for user", e);
        }
    }

    const ticketIdStr = `TKT-${Date.now().toString().slice(-6)}`;

    try {
      // 1. Create Ticket
      const { data: ticketData, error: ticketError } = await supabase
        .from('tickets')
        .insert([{
            ticket_id: ticketIdStr,
            title: newTicketData.title,
            description: newTicketData.message, // Initial description
            status: 'open',
            priority: newTicketData.priority,
            created_by: user.email,
            client_id: targetClientId,
            assigned_to: user.role === 'manager' ? user.email : null
        }])
        .select()
        .single();

      if (ticketError) throw ticketError;

      // 2. Create Initial Message
      const { error: msgError } = await supabase
        .from('ticket_messages')
        .insert([{
            ticket_id: ticketData.id,
            sender_email: user.email,
            sender_name: user.name || 'Usuário',
            sender_role: user.role,
            content: newTicketData.message
        }]);

      if (msgError) console.error("Error creating initial message", msgError);

      toast({ title: "Ticket Criado", description: "Solicitação enviada com sucesso.", variant: "success" });
      
      setNewTicketData({ title: '', message: '', targetClientId: '', priority: 'medium' });
      setIsCreateOpen(false);
      fetchTickets();
      setSelectedTicket(ticketData);

    } catch (error) {
       console.error("Error creating ticket:", error);
       toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  const handleSendMessage = async (content = null) => {
    const msgContent = content || newMessage;
    if (!msgContent.trim() || !selectedTicket) return;

    try {
        const { error } = await supabase
            .from('ticket_messages')
            .insert([{
                ticket_id: selectedTicket.id,
                sender_email: user.email,
                sender_name: user.name || 'Usuário',
                sender_role: user.role,
                content: msgContent
            }]);

        if (error) throw error;

        // Update ticket status
        let newStatus = selectedTicket.status;
        if (user.role === 'manager') newStatus = 'in_progress';
        else if (user.role === 'client' && selectedTicket.status === 'closed') newStatus = 'open';

        if (newStatus !== selectedTicket.status) {
             await supabase.from('tickets').update({ status: newStatus }).eq('id', selectedTicket.id);
             setSelectedTicket({...selectedTicket, status: newStatus});
             fetchTickets(); // Refresh list to update status there too
        } else {
             // Just update timestamp
             await supabase.from('tickets').update({}).eq('id', selectedTicket.id);
        }

        setNewMessage('');
        fetchMessages(selectedTicket.id);

    } catch (error) {
        console.error("Error sending message:", error);
        toast({ title: "Erro", description: "Falha ao enviar mensagem.", variant: "destructive" });
    }
  };

  const handleStatusChange = async (status) => {
    if (!selectedTicket || user.role !== 'manager') return;
    
    // Map UI status to DB status
    const dbStatus = status === 'Em Resposta' ? 'in_progress' : status === 'Resolvido' ? 'closed' : 'open';

    try {
        const { error } = await supabase
            .from('tickets')
            .update({ status: dbStatus })
            .eq('id', selectedTicket.id);

        if (error) throw error;

        toast({ title: "Status Atualizado", description: `Ticket marcado como ${status}`, variant: "default" });
        setSelectedTicket({ ...selectedTicket, status: dbStatus });
        fetchTickets();

    } catch (error) {
        console.error("Error updating status:", error);
        toast({ title: "Erro", description: "Falha ao atualizar status.", variant: "destructive" });
    }
  };

  // Filter local state
  const filteredTickets = tickets.filter(ticket => {
    if (user.role === 'manager') {
       if (clientFilter !== 'all' && ticket.client_id !== clientFilter) return false; // Filter by client_id text
       return true;
    }
    return true; // RLS handles client filtering
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'open': return 'text-orange-400 bg-orange-950/30 border-orange-900/50';
      case 'in_progress': return 'text-blue-400 bg-blue-950/30 border-blue-900/50';
      case 'closed': return 'text-emerald-400 bg-emerald-950/30 border-emerald-900/50';
      default: return 'text-zinc-400 bg-zinc-800';
    }
  };

  const getStatusLabel = (status) => {
      switch(status) {
          case 'open': return 'Aberto';
          case 'in_progress': return 'Em Progresso';
          case 'closed': return 'Resolvido';
          default: return status;
      }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-zinc-950 w-full max-w-6xl h-[85vh] rounded-2xl border border-zinc-800 shadow-2xl flex overflow-hidden relative"
      >
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onClose} 
          className="absolute top-4 right-4 z-50 text-zinc-400 hover:text-white hover:bg-zinc-800"
          title="Fechar"
        >
          <X className="w-6 h-6" />
        </Button>

        {/* Sidebar List */}
        <div className={`w-full md:w-1/3 border-r border-zinc-800 flex flex-col ${selectedTicket ? 'hidden md:flex' : 'flex'}`}>
          <div className="p-4 border-b border-zinc-800 bg-zinc-900/50">
             <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-emerald-500" />
                  Tickets
                </h2>
             </div>
             
             {user.role === 'manager' && (
               <div className="relative mb-3">
                 <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                 <select
                    className="flex h-9 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1 pl-9 text-sm text-white shadow-sm transition-colors placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500"
                    value={clientFilter}
                    onChange={(e) => setClientFilter(e.target.value)}
                 >
                   <option value="all">Todos os Clientes</option>
                   {clients.map(client => (
                     <option key={client.id} value={client.client_id}>{client.client_name}</option>
                   ))}
                 </select>
               </div>
             )}

             <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <Input placeholder="Buscar..." className="pl-9 h-9 bg-zinc-900 border-zinc-800 text-sm" />
                </div>
                <Button 
                  onClick={() => setIsCreateOpen(true)} 
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                >
                  <Plus className="w-4 h-4" /> Novo
                </Button>
             </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
            {loadingTickets ? (
                 <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500"></div></div>
            ) : filteredTickets.length === 0 ? (
              <div className="text-center py-10 text-zinc-500">
                <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-20" />
                <p>Nenhum ticket encontrado</p>
              </div>
            ) : (
              filteredTickets.map(ticket => (
                <div 
                  key={ticket.id}
                  onClick={() => setSelectedTicket(ticket)}
                  className={`group relative p-4 rounded-lg cursor-pointer transition-all border ${
                    selectedTicket?.id === ticket.id 
                      ? 'bg-zinc-900 border-emerald-500/30' 
                      : 'hover:bg-zinc-900/50 border-transparent hover:border-zinc-800'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${getStatusColor(ticket.status)}`}>
                      {getStatusLabel(ticket.status)}
                    </span>
                    <span className="text-[10px] text-zinc-500">
                      {new Date(ticket.updated_at || ticket.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  
                  {user.role === 'manager' && (
                     <div className="flex items-center justify-between mb-1">
                       <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                          <User className="w-3 h-3" />
                          {ticket.client_id}
                       </div>
                     </div>
                  )}

                  <h3 className="font-semibold text-white text-sm mb-1 truncate pr-6">{ticket.title}</h3>
                  <p className="text-xs text-zinc-400 truncate">
                    {ticket.ticket_id}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className={`w-full md:w-2/3 flex flex-col bg-zinc-900/20 ${!selectedTicket ? 'hidden md:flex' : 'flex'}`}>
          {selectedTicket ? (
            <>
              <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
                <div className="flex items-center gap-3">
                  <Button variant="ghost" size="icon" onClick={() => setSelectedTicket(null)} className="md:hidden">
                    <ChevronRight className="w-5 h-5 rotate-180" />
                  </Button>
                  <div>
                    <h3 className="font-bold text-white flex items-center gap-2">
                      {selectedTicket.title}
                    </h3>
                    <p className="text-xs text-zinc-400">ID: {selectedTicket.ticket_id}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {user.role === 'manager' && (
                    <div className="flex bg-zinc-900 rounded-lg p-1 border border-zinc-800 gap-1">
                       <Button 
                        size="xs" 
                        variant={selectedTicket.status === 'in_progress' ? "secondary" : "ghost"}
                        onClick={() => handleStatusChange('Em Resposta')}
                        className="h-7 text-xs px-3"
                      >
                        Responder
                      </Button>
                      <Button 
                        size="xs" 
                        variant={selectedTicket.status === 'closed' ? "secondary" : "ghost"}
                        onClick={() => handleStatusChange('Resolvido')}
                        className="h-7 text-xs px-3 text-emerald-400 hover:text-emerald-300"
                      >
                        Resolver
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                {messages.length === 0 && (
                    <div className="text-center py-10 text-zinc-500 text-sm">Nenhuma mensagem ainda.</div>
                )}
                {messages.map((msg) => (
                  <div 
                    key={msg.id} 
                    className={`flex group ${msg.sender_email === user.email ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`flex items-end gap-2 max-w-[80%] ${msg.sender_email === user.email ? 'flex-row-reverse' : ''}`}>
                      <div 
                        className={`rounded-2xl p-4 relative ${
                          msg.sender_email === user.email
                            ? 'bg-emerald-600 text-white rounded-tr-sm' 
                            : 'bg-zinc-800 text-zinc-200 rounded-tl-sm'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-4 mb-1">
                          <span className={`text-xs font-bold ${msg.sender_email === user.email ? 'text-emerald-100' : 'text-zinc-400'}`}>
                            {msg.sender_name} <span className="text-[10px] opacity-70 font-normal">({msg.sender_role})</span>
                          </span>
                          <span className={`text-[10px] ${msg.sender_email === user.email ? 'text-emerald-200' : 'text-zinc-500'}`}>
                            {new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </span>
                        </div>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {selectedTicket.status === 'closed' && user.role === 'client' ? (
                <div className="p-4 bg-zinc-900 border-t border-zinc-800 text-center">
                  <p className="text-zinc-400 text-sm mb-2">Este ticket foi marcado como resolvido.</p>
                  <Button variant="outline" onClick={() => handleSendMessage('Reabrindo ticket...')}>
                    Reabrir Ticket
                  </Button>
                </div>
              ) : (
                <div className="p-4 bg-zinc-900 border-t border-zinc-800">
                  <div className="flex gap-2">
                    <Input 
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Digite sua mensagem..."
                      className="bg-zinc-950 border-zinc-800 focus:border-emerald-500"
                      onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                    />
                    <Button onClick={() => handleSendMessage()} className="bg-emerald-600 hover:bg-emerald-700">
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 p-8 text-center">
              <div className="w-20 h-20 bg-zinc-900 rounded-full flex items-center justify-center mb-4">
                <MessageSquare className="w-10 h-10 text-zinc-700" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Selecione um Ticket</h3>
              <p className="max-w-md">Escolha um ticket da lista ao lado para ver os detalhes ou inicie uma nova solicitação de suporte.</p>
            </div>
          )}
        </div>
      </motion.div>

      {/* New Ticket Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
          <DialogHeader>
            <DialogTitle>Novo Ticket de Suporte</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            
            {user.role === 'manager' && (
              <div className="space-y-2">
                <Label htmlFor="client-select">Selecionar Cliente</Label>
                <select
                  id="client-select"
                  className="flex h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2 focus:ring-offset-zinc-900"
                  value={newTicketData.targetClientId}
                  onChange={(e) => setNewTicketData({...newTicketData, targetClientId: e.target.value})}
                >
                  <option value="" disabled>Selecione um cliente...</option>
                  {clients.map(client => (
                    <option key={client.id} value={client.id}>{client.client_name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="subject">Assunto</Label>
              <Input 
                id="subject" 
                placeholder="Resumo do problema"
                className="bg-zinc-950 border-zinc-800"
                value={newTicketData.title}
                onChange={(e) => setNewTicketData({...newTicketData, title: e.target.value})}
              />
            </div>

            <div className="space-y-2">
               <Label htmlFor="priority">Prioridade</Label>
               <select
                  id="priority"
                  className="flex h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2 focus:ring-offset-zinc-900"
                  value={newTicketData.priority}
                  onChange={(e) => setNewTicketData({...newTicketData, priority: e.target.value})}
                >
                  <option value="low">Baixa</option>
                  <option value="medium">Média</option>
                  <option value="high">Alta</option>
                </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Mensagem</Label>
              <textarea 
                id="message" 
                className="w-full min-h-[150px] rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2 focus:ring-offset-zinc-900"
                placeholder="Descreva sua dúvida ou problema detalhadamente..."
                value={newTicketData.message}
                onChange={(e) => setNewTicketData({...newTicketData, message: e.target.value})}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateTicket} className="bg-emerald-600 hover:bg-emerald-700">Criar Ticket</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TicketsSystem;
