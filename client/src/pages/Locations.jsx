import React, { useEffect, useState } from 'react';
import api from '../api/index';
import { useAuth } from '@/context/AuthContext';
import { Plus, Store, MapPin, MapPinned, X } from 'lucide-react';

const EMPTY_FORM = { name: '', type: 'warehouse', address: '' };

function Locations() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [locations, setLocations] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const data = await api.getLocations();
      setLocations(data.locations || []);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return setError('Location name is required');

    setSaving(true);
    setError('');
    try {
      await api.createLocation({
        name: form.name.trim(),
        type: form.type,
        address: form.address.trim(),
      });
      setForm(EMPTY_FORM);
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const icons = { warehouse: Store, shelf: MapPin, bin: MapPinned };
  const colors = {
    warehouse: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    shelf: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    bin: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
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

  return (
    <main className="px-6 py-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Locations</h1>
        {isAdmin && (
          <button className="btn-primary" onClick={() => setShowForm((open) => !open)}>
            {showForm ? <X className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
            {showForm ? 'Cancel' : 'New Location'}
          </button>
        )}
      </div>

      {error && <div className="card border-red-500/30 bg-red-500/10 text-red-400 mb-4">{error}</div>}

      {isAdmin && showForm && (
        <form onSubmit={handleCreate} className="card mb-6 space-y-4">
          <h2 className="text-lg font-semibold">New Location</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <label className="block sm:col-span-1">
              <span className="block text-sm text-slate-400 mb-1.5">Name *</span>
              <input
                className="input-base"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g., Shelf C3"
                required
              />
            </label>
            <label className="block">
              <span className="block text-sm text-slate-400 mb-1.5">Type</span>
              <select
                className="select-base"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              >
                <option value="warehouse">Warehouse</option>
                <option value="shelf">Shelf</option>
                <option value="bin">Bin</option>
              </select>
            </label>
            <label className="block">
              <span className="block text-sm text-slate-400 mb-1.5">Address / Notes</span>
              <input
                className="input-base"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Optional"
              />
            </label>
          </div>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Saving...' : 'Create Location'}
          </button>
        </form>
      )}

      {locations.length === 0 ? (
        <div className="card text-center py-12 text-slate-400">No locations yet.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {locations.map((loc) => {
            const Icon = icons[loc.type] || Store;
            return (
              <div key={loc.id} className="card hover:border-slate-600 transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center border ${
                        colors[loc.type] || colors.warehouse
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="font-semibold text-white">{loc.name}</h2>
                      <span className="text-xs text-slate-400 uppercase">{loc.type}</span>
                    </div>
                  </div>
                  <span className="badge-info">{loc.itemCount} items</span>
                </div>
                {loc.address && <p className="text-xs text-slate-400">{loc.address}</p>}
                <p className="text-xs text-slate-500 mt-2">
                  {loc.itemCount === 0
                    ? 'No items stored here yet.'
                    : `${loc.itemCount} item${Number(loc.itemCount) === 1 ? '' : 's'} stored here.`}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}

export default Locations;
