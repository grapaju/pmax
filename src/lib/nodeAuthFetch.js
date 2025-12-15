import { supabase } from '@/lib/customSupabaseClient';

export async function fetchWithSupabaseAuth(url, options = {}) {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) throw error;
  if (!session?.access_token) {
    throw new Error('Sessão expirada. Faça login novamente.');
  }

  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${session.access_token}`);

  return fetch(url, {
    ...options,
    headers,
  });
}
