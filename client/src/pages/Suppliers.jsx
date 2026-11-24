import React, { useEffect, useState } from 'react';
import api from '../api/index';
import { useAuth } from '@/context/AuthContext';
import { Building2, Mail, Phone, Plus, X } from 'lucide-react';

const EMPTY_FORM = { name: '', email: '', phone: '', contact_name: '' };

function Suppliers() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [suppliers, setSuppliers] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const data = await api.getSuppliers();
      setSuppliers(data.suppliers || []);
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
    if (!form.name.trim()) return setError('Supplier name is required');

    setSaving(true);
    setError('');
    try {
      await api.createSupplier({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        contact_name: form.contact_name.trim(),
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
        <h1 className="text-2xl font-bold">Suppliers</h1>
        {isAdmin && (
          <button className="btn-primary" onClick={() => setShowForm((open) => !open)}>
            {showForm ? <X className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
            {showForm ? 'Cancel' : 'New Supplier'}
          </button>
        )}
      </div>

      {error && <div className="card border-red-500/30 bg-red-500/10 text-red-400 mb-4">{error}</div>}

      {isAdmin && showForm && (
        <form onSubmit={handleCreate} className="card mb-6 space-y-4">
          <h2 className="text-lg font-semibold">New Supplier</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="block text-sm text-slate-400 mb-1.5">Supplier Name *</span>
              <input
                className="input-base"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </label>
            <label className="block">
              <span className="block text-sm text-slate-400 mb-1.5">Contact Person</span>
              <input
                className="input-base"
                value={form.contact_name}
                onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="block text-sm text-slate-400 mb-1.5">Email</span>
              <input
                className="input-base"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="block text-sm text-slate-400 mb-1.5">Phone</span>
              <input
                className="input-base"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </label>
          </div>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Saving...' : 'Create Supplier'}
          </button>
        </form>
      )}

      {suppliers.length === 0 ? (
        <div className="card text-center py-12 text-slate-400">No suppliers yet.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {suppliers.map((s) => (
            <div key={s.id} className="card">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 flex-shrink-0">
                  <Building2 className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="font-semibold text-white truncate">{s.name}</h2>
                  {s.contact_name && <span className="text-sm text-slate-400">{s.contact_name}</span>}
                </div>
              </div>
              <div className="mt-3 space-y-1 text-sm">
                {s.email && (
                  <div className="flex gap-2 text-slate-300">
                    <Mail className="w-4 h-4 text-slate-500 flex-shrink-0" /> <span className="truncate">{s.email}</span>
                  </div>
                )}
                {s.phone && (
                  <div className="flex gap-2 text-slate-300">
                    <Phone className="w-4 h-4 text-slate-500 flex-shrink-0" /> {s.phone}
                  </div>
                )}
                <div className="text-xs text-slate-500">Supplier ID: #{s.id}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

export default Suppliers;
