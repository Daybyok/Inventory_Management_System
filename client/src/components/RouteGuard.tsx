import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

export function RouteGuard({ roles, redirectTo = '/login' }: { roles?: string[]; redirectTo?: string }) {
  const { isAuthenticated, loading, role } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <div className="w-8 h-8 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  if (roles && !roles.includes(role || '')) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

export default RouteGuard;
