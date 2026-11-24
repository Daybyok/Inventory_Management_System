import React from 'react';
import { NavLink, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { LogOut, Shield, User, UserRound, LayoutDashboard, Package, ArrowLeftRight, MapPin, Truck } from 'lucide-react';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/items', label: 'Items', icon: Package },
  { to: '/movements', label: 'Movements', icon: ArrowLeftRight },
  { to: '/locations', label: 'Locations', icon: MapPin },
  { to: '/suppliers', label: 'Suppliers', icon: Truck },
];

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors ${
    isActive ? 'bg-blue-500/10 text-blue-400' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
  }`;

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (!user) return null;

  return (
    <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-20">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-2.5 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-xs">
              I
            </div>
            <span className="text-white font-bold text-lg">Inventory</span>
          </Link>

          <div className="flex items-center gap-2 lg:hidden">
            <Link to="/profile" className="btn-secondary px-2.5 py-1.5" aria-label="Profile">
              <UserRound className="w-4 h-4" />
            </Link>
            <button onClick={handleLogout} className="btn-secondary px-2.5 py-1.5" aria-label="Logout">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        <nav className="flex items-center gap-1 overflow-x-auto pb-1 lg:pb-0">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={linkClass}>
              <Icon className="w-4 h-4" />
              {label}
            </NavLink>
          ))}
          {user.role === 'admin' && (
            <NavLink to="/admin/users" className={linkClass}>
              <Shield className="w-4 h-4" />
              Users
            </NavLink>
          )}
        </nav>

        <div className="hidden lg:flex items-center gap-3">
          <Link to="/profile" className="btn-secondary flex items-center gap-2 px-3 py-1.5 text-sm">
            <UserRound className="w-4 h-4" />
            Profile
          </Link>

          <div
            className={`px-3 py-1.5 rounded-lg border text-sm font-medium flex items-center gap-1.5 ${
              user.role === 'admin'
                ? 'bg-red-500/10 text-red-400 border-red-500/20'
                : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
            }`}
          >
            {user.role === 'admin' ? <Shield className="w-4 h-4" /> : <User className="w-4 h-4" />}
            <span>{user.role === 'admin' ? 'Admin' : 'Staff'}</span>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
