// ================================================================
// CORREÇÕES DE CÓDIGO - Foreign Keys
// Arquivo: src/components/ManagerDashboard.jsx
// ================================================================

// PROBLEMA 1: Criação de Campanha Padrão (linha ~98)
// --------------------------------------------------------

// ❌ CÓDIGO ANTIGO (ERRADO):
const { error: campError } = await supabase
    .from('campaigns')
    .insert([{
        client_id: clientData.client_id, // ⚠️ TEXT ("C-001")
        name: 'Campanha Padrão',
        budget: 1000,
        status: 'active',
        data: {}
    }]);

// ✅ CÓDIGO NOVO (CORRETO):
const { error: campError } = await supabase
    .from('campaigns')
    .insert([{
        client_id: clientData.id, // ✅ UUID
        name: 'Campanha Padrão',
        budget: 1000,
        status: 'active',
        data: {}
    }]);


// ================================================================
// PROBLEMA 2: Mapeamento de Dados para UI (linha ~130)
// --------------------------------------------------------

// O código atual mapeia corretamente, mas para evitar confusão:

// ❌ EVITE usar client_id (TEXT) em lógica de negócio:
const displayId = client.client_id; // Apenas para exibição!

// ✅ SEMPRE use id (UUID) para relacionamentos:
const clientUUID = client.id; // Para FKs e queries


// ================================================================
// Arquivo: src/components/TicketsSystem.jsx
// ================================================================

// PROBLEMA 3: Criação de Ticket (linha ~140-167)
// --------------------------------------------------------

// ❌ CÓDIGO ANTIGO (ERRADO):
if (user.role === 'manager') {
    if (!targetClientId) {
        toast({ title: "Erro", description: "Selecione um cliente.", variant: "destructive" });
        return;
    }
    // Get the text client_id
    const clientObj = clients.find(c => c.id === targetClientId);
    if (clientObj) {
        targetClientId = clientObj.client_id; // ⚠️ ERRADO: pegando TEXT
        targetClientName = clientObj.client_name;
    }
}

// ✅ CÓDIGO NOVO (CORRETO):
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
    // Cliente logado: buscar UUID do cliente
    try {
        const { data: clientRecord } = await supabase
            .from('clients')
            .select('id, client_name') // ✅ Pegar id (UUID)
            .eq('email', user.email)
            .single();
        
        if (clientRecord) {
            targetClientId = clientRecord.id; // ✅ UUID
            targetClientName = clientRecord.client_name;
        }
    } catch (e) {
        console.error("Could not find client record for user", e);
    }
}


// ================================================================
// RESUMO DAS MUDANÇAS NECESSÁRIAS
// ================================================================

/**
 * REGRA GERAL:
 * 
 * - clients.id (UUID) → Para relacionamentos (FKs)
 * - clients.client_id (TEXT) → Apenas para exibição ao usuário
 * 
 * SEMPRE use:
 * - campaigns.client_id = clients.id (UUID)
 * - tickets.client_id = clients.id (UUID)
 * 
 * NUNCA use:
 * - campaigns.client_id = clients.client_id (TEXT) ❌
 * - tickets.client_id = clients.client_id (TEXT) ❌
 */


// ================================================================
// VERIFICAÇÃO ADICIONAL
// ================================================================

// Se você quiser manter os IDs customizados (C-001, C-002, etc)
// apenas para exibição, considere adicionar este helper:

// src/lib/utils.js
export function getClientDisplayId(client) {
    return client.client_id || `Client-${client.id.slice(0, 8)}`;
}

// Uso nos componentes:
import { getClientDisplayId } from '@/lib/utils';

// Para exibir:
<p>ID: {getClientDisplayId(client)}</p>

// Para FKs:
client_id: client.id // Sempre UUID
