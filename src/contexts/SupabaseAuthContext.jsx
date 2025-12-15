
import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';

const AuthContext = createContext(undefined);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch the custom user data (role, name) from public.users
  const getUserProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching profile:', error);
      }
      
      return data;
    } catch (error) {
      console.error('Unexpected error loading profile:', error);
      return null;
    }
  };

  const handleSession = useCallback(async (currentSession) => {
    const currentUser = currentSession?.user ?? null;
    
    if (currentUser) {
      // Fetch profile BEFORE updating user state to ensure consistent app state
      // This prevents the "user exists but profile is null" race condition
      const userProfile = await getUserProfile(currentUser.id);
      
      // Merge auth metadata as fallback if public profile is missing or incomplete
      // This ensures roles set during signUp (in metadata) are available immediately
      const mergedProfile = {
        id: currentUser.id,
        email: currentUser.email,
        role: userProfile?.role || currentUser.user_metadata?.role || 'client',
        name: userProfile?.name || currentUser.user_metadata?.name || 'User',
        ...userProfile // public table data takes precedence
      };

      setProfile(mergedProfile);
      setUser(currentUser);
      setSession(currentSession);
    } else {
      setProfile(null);
      setUser(null);
      setSession(null);
    }
    
    setLoading(false);
  }, []);

  useEffect(() => {
    // Initial session check
    const initSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        await handleSession(session);
      } catch (error) {
        console.error("Session init error:", error);
        setLoading(false);
      }
    };

    initSession();

    // Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT') {
           setUser(null);
           setProfile(null);
           setSession(null);
           setLoading(false);
        } else {
           await handleSession(session);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [handleSession]);

  const signUp = useCallback(async (email, password, name, role = 'client') => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
          role
        }
      }
    });

    if (error) {
      if (!error.message.includes("already registered")) {
        toast({
          variant: "destructive",
          title: "Erro no cadastro",
          description: error.message,
        });
      }
      return { error };
    }
    
    return { data, error: null };
  }, []);

  const signIn = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast({
        variant: "destructive",
        title: "Erro no login",
        description: error.message === "Invalid login credentials" 
            ? "Email ou senha incorretos." 
            : error.message,
      });
      return { error };
    }

    return { data, error: null };
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Error signing out:", error);
      toast({
        variant: "destructive",
        title: "Erro ao sair",
        description: "Não foi possível encerrar a sessão.",
      });
    } else {
      setUser(null);
      setProfile(null);
      setSession(null);
    }
  }, []);

  const value = useMemo(() => ({
    user,
    profile,
    session,
    loading,
    signUp,
    signIn,
    signOut,
  }), [user, profile, session, loading, signUp, signIn, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
