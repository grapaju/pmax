
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, ArrowRight, ShieldCheck, User, UserPlus, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { toast } from '@/components/ui/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const Login = () => {
  const navigate = useNavigate();
  const { signIn, signUp, user, loading } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  
  // Login State
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register State
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');

  // Redirect if already logged in
  useEffect(() => {
    if (!loading && user) {
      navigate('/', { replace: true });
    }
  }, [user, loading, navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { error } = await signIn(loginEmail, loginPassword);
      if (error) throw error;
      
      toast({
        title: "Login realizado",
        description: "Redirecionando...",
        className: "bg-emerald-900 border-emerald-800 text-white"
      });
      // Navigation is handled by the useEffect above
    } catch (error) {
      // Handled by context
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Default role is 'client' for self-registration
      const { data, error } = await signUp(regEmail, regPassword, regName, 'client');
      
      if (error) throw error;

      // Check if we got a session immediately
      if (data?.session) {
         toast({
            title: "Conta criada",
            description: "Bem-vindo à plataforma!",
            className: "bg-emerald-900 border-emerald-800 text-white"
         });
      } else if (data?.user && !data.session) {
         // Fallback: try to sign in immediately
         const { error: signInError } = await signIn(regEmail, regPassword);
         
         if (!signInError) {
             toast({
                title: "Conta criada",
                description: "Login realizado com sucesso!",
                className: "bg-emerald-900 border-emerald-800 text-white"
             });
         }
      }
    } catch (error) {
      // Handled by context
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoSetup = async () => {
    setIsLoading(true);
    try {
      // 1. Create Manager
      await signUp('manager@pmax.com', 'manager123', 'Gerente Admin', 'manager');
      
      // 2. Create Client
      await signUp('client@pmax.com', 'client123', 'Cliente Demo', 'client');

      // 3. Attempt to auto-login as manager for convenience
      await signIn('manager@pmax.com', 'manager123');

      toast({
        title: "Ambiente Demo Configurado",
        description: "Contas criadas! Entrando como Gerente...",
        className: "bg-emerald-900 border-emerald-800 text-white"
      });
      
    } catch (error) {
      console.error("Demo setup error:", error);
      toast({
        variant: "destructive",
        title: "Erro na configuração",
        description: "Não foi possível criar as contas demo.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[100px]" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md bg-zinc-900/50 backdrop-blur-xl border border-zinc-800 p-8 rounded-2xl shadow-2xl relative z-10"
      >
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-zinc-900 rounded-2xl border border-zinc-800 flex items-center justify-center mx-auto mb-4 shadow-lg">
            <ShieldCheck className="w-8 h-8 text-emerald-500" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Performance Max Manager</h1>
          <p className="text-zinc-400 text-sm">Acesso seguro à plataforma</p>
        </div>

        <Tabs defaultValue="login" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6 bg-zinc-900/50">
            <TabsTrigger value="login" className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white">Login</TabsTrigger>
            <TabsTrigger value="register" className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white">Criar Conta</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="login-email" className="text-zinc-300">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 w-5 h-5 text-zinc-500" />
                  <Input 
                    id="login-email" 
                    type="email" 
                    placeholder="seu@email.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="pl-10 bg-zinc-950 border-zinc-800 text-white focus:border-emerald-500"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="login-password" className="text-zinc-300">Senha</Label>
                  <a href="#" className="text-xs text-emerald-500 hover:text-emerald-400">Esqueceu?</a>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 w-5 h-5 text-zinc-500" />
                  <Input 
                    id="login-password" 
                    type="password" 
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="pl-10 bg-zinc-950 border-zinc-800 text-white focus:border-emerald-500"
                    required
                  />
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-11 font-medium"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    Entrar <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="register">
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reg-name" className="text-zinc-300">Nome Completo</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 w-5 h-5 text-zinc-500" />
                  <Input 
                    id="reg-name" 
                    type="text" 
                    placeholder="Seu nome"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    className="pl-10 bg-zinc-950 border-zinc-800 text-white focus:border-emerald-500"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reg-email" className="text-zinc-300">Email Corporativo</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 w-5 h-5 text-zinc-500" />
                  <Input 
                    id="reg-email" 
                    type="email" 
                    placeholder="seu@empresa.com"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    className="pl-10 bg-zinc-950 border-zinc-800 text-white focus:border-emerald-500"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reg-password" className="text-zinc-300">Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 w-5 h-5 text-zinc-500" />
                  <Input 
                    id="reg-password" 
                    type="password" 
                    placeholder="Mínimo 6 caracteres"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    className="pl-10 bg-zinc-950 border-zinc-800 text-white focus:border-emerald-500"
                    required
                    minLength={6}
                  />
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full bg-blue-600 hover:bg-blue-700 text-white h-11 font-medium mt-2"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <UserPlus className="w-4 h-4 mr-2" /> Criar Conta
                  </>
                )}
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        <div className="mt-6 pt-6 border-t border-zinc-800">
          <Button 
            variant="outline" 
            onClick={handleDemoSetup}
            disabled={isLoading}
            className="w-full border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-800"
          >
            <Database className="w-4 h-4 mr-2" />
            Gerar Dados de Demo (Manager & Client)
          </Button>
        </div>

        <div className="mt-4 text-center">
          <p className="text-xs text-zinc-500">
            Acesso protegido por autenticação segura Supabase.
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
