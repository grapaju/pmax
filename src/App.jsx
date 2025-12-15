
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import Login from '@/components/Login';
import ManagerDashboard from '@/components/ManagerDashboard';
import ClientDashboard from '@/components/ClientDashboard'; 
import ClientSharedView from '@/components/ClientSharedView'; 
import GoogleOAuthCallback from '@/components/GoogleOAuthCallback';
import { Toaster } from '@/components/ui/toaster';
import { useAuth } from '@/contexts/SupabaseAuthContext';

// Protected Route Component
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // If roles are specified, check if user has required role
  if (allowedRoles && profile) {
    if (!allowedRoles.includes(profile.role)) {
       // Redirect to their appropriate dashboard if they try to access wrong one
       return <Navigate to={profile.role === 'manager' ? '/manager' : '/dashboard'} replace />;
    }
  }

  return children;
};

// Root redirect based on role
const RootRedirect = () => {
    const { user, profile, loading } = useAuth();
    
    if (loading) return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    );
    
    if (!user) return <Navigate to="/login" replace />;
    
    // Safety check: if profile isn't loaded yet (though context should handle this), wait
    if (!profile) return null;

    if (profile.role === 'manager') return <Navigate to="/manager" replace />;
    return <Navigate to="/dashboard" replace />;
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={
            <>
                <Helmet><title>Entrar - Performance Manager</title></Helmet>
                <Login />
            </>
        } />
        
        <Route path="/oauth/callback" element={
            <>
                <Helmet><title>Autorização Google Ads</title></Helmet>
                <GoogleOAuthCallback />
            </>
        } />
        
        <Route path="/client/:clientId" element={<ClientSharedView />} />

        {/* Protected Manager Routes */}
        <Route path="/manager" element={
          <ProtectedRoute allowedRoles={['manager']}>
            <Helmet><title>Painel Gerencial</title></Helmet>
            <UserWrapper component={ManagerDashboard} />
          </ProtectedRoute>
        } />

        {/* Protected Client Routes */}
        <Route path="/dashboard" element={
          <ProtectedRoute allowedRoles={['client', 'manager']}> 
             <Helmet><title>Meu Painel</title></Helmet>
             <UserWrapper component={ClientDashboard} />
          </ProtectedRoute>
        } />

        {/* Root Route */}
        <Route path="/" element={<RootRedirect />} />
        
        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster />
    </BrowserRouter>
  );
}

// Helper to inject auth props into dashboard components
const UserWrapper = ({ component: Component }) => {
    const { user, profile, signOut } = useAuth();
    // Combine auth user with profile data for the dashboard
    const augmentedUser = { ...user, ...profile };
    
    return <Component user={augmentedUser} onLogout={signOut} />;
};

export default App;
