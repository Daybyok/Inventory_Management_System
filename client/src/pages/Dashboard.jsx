import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/index';
import { useAuth } from '@/context/AuthContext';
import { Plus, Shield, Package, ArrowLeftRight, MapPin, Truck } from 'lucide-react';

function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [recentMovements, setRecentMovements] = useState([]);
  const [topItems, setTopItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [staffForm, setStaffForm] = useState({ username: '', password: '', confirmPassword: '' });
  const [staffError, setStaffError] = useState('');
  const [staffSuccess, setStaffSuccess] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    async function load() {
      try {
        const data = await api.getDashboard();
        setStats(data.stats);
        setRecentMovements(data.recentMovements || []);
        setTopItems(data.topItems || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const createStaffAccount = async (e) => {
    e.preventDefault();
    setStaffError('');
    setStaffSuccess('');

    if (!staffForm.username.trim()) return setStaffError('Please enter a username');
    if (!/^[a-zA-Z0-9_.-]{3,50}$/.test(staffForm.username.trim())) {
      return setStaffError('Username must be 3-50 letters, numbers, dots, dashes or underscores');
    }
    if (staffForm.password.length < 6) return setStaffError('Password must be at least 6 characters');
    if (staffForm.password !== staffForm.confirmPassword) return setStaffError('Passwords do not match');

    setIsCreating(true);
    try {
      await api.createUser({ username: staffForm.username.trim(), password: staffForm.password, role: 'staff' });
      setStaffSuccess(`Staff account "${staffForm.username.trim()}" created.`);
      setStaffForm({ username: '', password: '', confirmPassword: '' });
    } catch (err) {
      setStaffError(err.message || 'Failed to create account');
    } finally {
      setIsCreating(false);
    }
  };

  if (loading) {
    return (
      <main className="px-6 py-8">
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="px-6 py-8 max-w-7xl mx-auto">
        <div className="card border-red-500/30 bg-red-500/10 text-red-400 p-4">{error}</div>
      </main>
    );
  }

  return (
    <main className="px-6 py-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-slate-400 mt-1">Welcome back, {user?.username}</p>
        </div>
        <button className="btn-primary" onClick={() => navigate('/items')}>
          Browse Items
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="card">
          <p className="text-slate-400 text-sm uppercase tracking-wider">Total Items</p>
          <p className="text-3xl font-bold mt-1">{stats.totalItems}</p>
        </div>
        <div className="card">
          <p className="text-slate-400 text-sm uppercase tracking-wider">Total Stock Units</p>
          <p className="text-3xl font-bold mt-1">{stats.totalStock}</p>
        </div>
        <div className="card">
          <p className="text-slate-400 text-sm uppercase tracking-wider">Low / Out of Stock</p>
          <p className="text-3xl font-bold mt-1 text-amber-400">{stats.lowStockCount}</p>
        </div>
        <div className="card">
          <p className="text-slate-400 text-sm uppercase tracking-wider">Total Stock Value</p>
          <p className="text-3xl font-bold mt-1">
            ₱{Number(stats.totalStockValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Recent Movements</h2>
          {recentMovements.length === 0 ? (
            <p className="text-slate-500 text-sm">No movements yet</p>
          ) : (
            <div className="space-y-2">
              {recentMovements.map((m) => (
                <div key={m.id} className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0">
                  <div className="flex gap-3 text-sm min-w-0">
                    <span
                      className={`font-medium ${
                        m.type === 'in' ? 'text-green-400' : m.type === 'out' ? 'text-red-400' : 'text-blue-400'
                      }`}
                    >
                      {m.type.toUpperCase()}
                    </span>
                    <span className="text-white truncate">{m.item_name || `Item #${m.item_id}`}</span>
                    <span className="text-slate-400 whitespace-nowrap">{m.quantity} units</span>
                  </div>
                  <span className="text-slate-500 text-xs whitespace-nowrap ml-2">
                    {new Date(m.movement_date).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Top Stock Items</h2>
          {topItems.length === 0 ? (
            <p className="text-slate-500 text-sm">No items</p>
          ) : (
            <div className="space-y-2">
              {topItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0">
                  <span className="text-sm text-white truncate">{item.name}</span>
                  <div className="flex gap-3 text-sm">
                    <span className="text-slate-400">{item.quantity}</span>
                    <span
                      className={
                        item.status === 'in_stock'
                          ? 'text-green-400'
                          : item.status === 'low_stock'
                            ? 'text-amber-400'
                            : 'text-red-400'
                      }
                    >
                      {item.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {isAdmin && (
        <div className="card mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-5 h-5 text-red-400" />
            <h2 className="text-lg font-semibold text-white">Create Staff Account</h2>
          </div>
          <form onSubmit={createStaffAccount} className="space-y-3">
            <input
              className="input-base"
              type="text"
              value={staffForm.username}
              onChange={(e) => setStaffForm({ ...staffForm, username: e.target.value })}
              placeholder="Username"
              disabled={isCreating}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                className="input-base"
                type="password"
                value={staffForm.password}
                onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })}
                placeholder="Password (min 6 chars)"
                disabled={isCreating}
              />
              <input
                className="input-base"
                type="password"
                value={staffForm.confirmPassword}
                onChange={(e) => setStaffForm({ ...staffForm, confirmPassword: e.target.value })}
                placeholder="Confirm Password"
                disabled={isCreating}
              />
            </div>
            {staffError && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg">
                {staffError}
              </p>
            )}
            {staffSuccess && (
              <p className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 px-3 py-2 rounded-lg">
                {staffSuccess}
              </p>
            )}
            <button type="submit" disabled={isCreating} className="btn-primary w-full">
              {isCreating ? 'Creating...' : 'Create Staff Account'}
            </button>
          </form>
          <div className="mt-4">
            <Link
              to="/admin/users"
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors font-medium flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Manage All Accounts
            </Link>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <button className="card text-left hover:border-blue-500/30 transition-colors" onClick={() => navigate('/items')}>
          <Package className="w-5 h-5 text-blue-400 mb-2" />
          <h2 className="text-lg font-semibold mb-1">Manage Items</h2>
          <p className="text-sm text-slate-400">View, add, and edit inventory items</p>
        </button>
        <button className="card text-left hover:border-blue-500/30 transition-colors" onClick={() => navigate('/movements')}>
          <ArrowLeftRight className="w-5 h-5 text-green-400 mb-2" />
          <h2 className="text-lg font-semibold mb-1">Movements</h2>
          <p className="text-sm text-slate-400">Track inbound, outbound, and transfer records</p>
        </button>
        <button className="card text-left hover:border-blue-500/30 transition-colors" onClick={() => navigate('/locations')}>
          <MapPin className="w-5 h-5 text-amber-400 mb-2" />
          <h2 className="text-lg font-semibold mb-1">Locations</h2>
          <p className="text-sm text-slate-400">Manage warehouse and shelf locations</p>
        </button>
        <button className="card text-left hover:border-blue-500/30 transition-colors" onClick={() => navigate('/suppliers')}>
          <Truck className="w-5 h-5 text-purple-400 mb-2" />
          <h2 className="text-lg font-semibold mb-1">Suppliers</h2>
          <p className="text-sm text-slate-400">Manage vendors and suppliers</p>
        </button>
      </div>
    </main>
  );
}

export default Dashboard;
