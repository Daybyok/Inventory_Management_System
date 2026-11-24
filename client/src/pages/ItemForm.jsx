import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api/index';
import { ArrowLeft, Save } from 'lucide-react';

const DEFAULT_CATEGORIES = ['General', 'Grains', 'Meat', 'Dairy', 'Produce', 'Household'];

function ItemForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;

  const [form, setForm] = useState({
    name: '',
    sku: '',
    category: 'General',
    quantity: 0,
    unit_price: 0,
    location_id: '',
    description: '',
  });
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .getLocations()
      .then((data) => {
        setLocations(data.locations || []);
        setForm((current) =>
          current.location_id || !data.locations?.length
            ? current
            : { ...current, location_id: data.locations[0].id }
        );
      })
      .catch((err) => setError(err.message));

    api
      .getCategories()
      .then((data) => {
        if (data.categories?.length) {
          setCategories(Array.from(new Set([...DEFAULT_CATEGORIES, ...data.categories])));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isEditing) return;
    api
      .getItem(id)
      .then((item) => {
        setForm({
          name: item.name || '',
          sku: item.SKU || '',
          category: item.category || 'General',
          quantity: item.quantity ?? 0,
          unit_price: item.unit_price ?? 0,
          location_id: item.location_id ?? '',
          description: item.description || '',
        });
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [id, isEditing]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    const payload = {
      name: form.name.trim(),
      sku: form.sku.trim(),
      category: form.category || 'General',
      quantity: Number(form.quantity) || 0,
      unit_price: Number(form.unit_price) || 0,
      location_id: Number(form.location_id) || 1,
      description: form.description || '',
    };

    if (payload.quantity < 0) {
      setError('Quantity cannot be negative');
      setSaving(false);
      return;
    }
    if (payload.unit_price < 0) {
      setError('Unit price cannot be negative');
      setSaving(false);
      return;
    }

    try {
      if (isEditing) await api.updateItem(id, payload);
      else await api.createItem(payload);
      navigate('/items');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

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
    <main className="px-6 py-8 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button className="btn-secondary" onClick={() => navigate('/items')}>
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <h1 className="text-2xl font-bold">{isEditing ? 'Edit Item' : 'Add New Item'}</h1>
      </div>

      {error && <div className="card border-red-500/30 bg-red-500/10 text-red-400 mb-4">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Item Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="block text-sm text-slate-400 mb-1.5">Name *</span>
              <input className="input-base" value={form.name} onChange={(e) => set('name', e.target.value)} required />
            </label>
            <label className="block">
              <span className="block text-sm text-slate-400 mb-1.5">SKU *</span>
              <input
                className="input-base"
                value={form.sku}
                onChange={(e) => set('sku', e.target.value)}
                required
                disabled={isEditing}
              />
            </label>
            <label className="block">
              <span className="block text-sm text-slate-400 mb-1.5">Category</span>
              <select className="select-base" value={form.category} onChange={(e) => set('category', e.target.value)}>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="block text-sm text-slate-400 mb-1.5">Location</span>
              <select
                className="select-base"
                value={form.location_id}
                onChange={(e) => set('location_id', e.target.value)}
                required
              >
                <option value="" disabled>
                  Select a location...
                </option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Inventory & Pricing</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="block text-sm text-slate-400 mb-1.5">Quantity *</span>
              <input
                className="input-base"
                type="number"
                value={form.quantity}
                onChange={(e) => set('quantity', e.target.value)}
                min="0"
                required
              />
            </label>
            <label className="block">
              <span className="block text-sm text-slate-400 mb-1.5">Unit Price (₱) *</span>
              <input
                className="input-base"
                type="number"
                step="0.01"
                value={form.unit_price}
                onChange={(e) => set('unit_price', e.target.value)}
                min="0"
                required
              />
            </label>
          </div>
          {isEditing && (
            <p className="text-xs text-slate-500 mt-3">
              For audits, use Movements to adjust stock instead of editing quantity directly. Status is calculated
              automatically (0 = out of stock, 1-5 = low stock).
            </p>
          )}
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Description</h2>
          <textarea
            className="input-base"
            rows="3"
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            placeholder="Item description..."
          />
        </div>

        <div className="flex gap-3">
          <button type="submit" className="btn-primary" disabled={saving}>
            <Save className="w-4 h-4 mr-2" /> {saving ? 'Saving...' : isEditing ? 'Update Item' : 'Create Item'}
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate('/items')}>
            Cancel
          </button>
        </div>
      </form>
    </main>
  );
}

export default ItemForm;
