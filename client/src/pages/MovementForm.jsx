import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/index';
import { ArrowLeft, Save, MapPin, AlertTriangle, Info } from 'lucide-react';

function localToday() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function MovementForm() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    item_id: '',
    location_id: '',
    type: 'out',
    quantity: 1,
    reference_number: '',
    reason: '',
    movement_date: localToday(),
  });
  const [items, setItems] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const [itemData, locationData] = await Promise.all([
          api.getItems({ limit: 200, sort: 'name', order: 'asc' }),
          api.getLocations(),
        ]);
        setItems(itemData.items || []);
        setLocations(locationData.locations || []);
        if (locationData.locations?.length) {
          setForm((current) => ({
            ...current,
            location_id: current.location_id || locationData.locations[0].id,
          }));
        }
      } catch (err) {
        setError(err.message);
      }
    }
    load();
  }, []);

  const selectedItem = items.find((item) => item.id === parseInt(form.item_id, 10));
  const itemStock = selectedItem ? selectedItem.quantity : null;
  const quantityNumber = parseInt(form.quantity, 10) || 0;
  const insufficientStock = form.type === 'out' && itemStock !== null && quantityNumber > itemStock;
  const locationLabel =
    form.type === 'transfer' ? 'Move to Location *' : form.type === 'in' ? 'Receiving Location *' : 'Source Location *';
  const transferDestination = form.type === 'transfer' ? selectedItem?.location_id : null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.item_id) return setError('Please select an item');
    if (quantityNumber < 1) return setError('Quantity must be at least 1');
    if (insufficientStock) return setError(`Not enough stock. Only ${itemStock} available.`);
    if (form.type === 'transfer' && !form.location_id) return setError('Please select a destination location');

    setLoading(true);
    try {
      await api.createMovement({
        item_id: parseInt(form.item_id, 10),
        location_id: parseInt(form.location_id, 10),
        type: form.type,
        quantity: quantityNumber,
        reference_number: form.reference_number,
        reason: form.reason,
        movement_date: form.movement_date,
      });
      navigate('/movements');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <main className="px-6 py-8 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button className="btn-secondary" onClick={() => navigate('/movements')}>
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <h1 className="text-2xl font-bold">New Movement</h1>
      </div>

      {error && <div className="card border-red-500/30 bg-red-500/10 text-red-400 mb-4">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Movement Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block sm:col-span-2">
              <span className="block text-sm text-slate-400 mb-1.5">Item *</span>
              <select className="select-base" value={form.item_id} onChange={(e) => set('item_id', e.target.value)} required>
                <option value="">Select an item...</option>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} (Qty: {item.quantity})
                  </option>
                ))}
              </select>
              {selectedItem && (
                <div className="text-xs mt-1.5 text-slate-400">
                  Current stock: <span className="text-white">{itemStock} units</span> ·{' '}
                  {selectedItem.location_name || 'No location'}
                </div>
              )}
            </label>

            <label className="block">
              <span className="block text-sm text-slate-400 mb-1.5">Type *</span>
              <select className="select-base" value={form.type} onChange={(e) => set('type', e.target.value)} required>
                <option value="out">Outbound (Sell/Use)</option>
                <option value="in">Inbound (Receive)</option>
                <option value="transfer">Transfer (Move to location)</option>
              </select>
            </label>

            <label className="block">
              <span className="block text-sm text-slate-400 mb-1.5">Quantity *</span>
              <input
                className="input-base"
                type="number"
                value={form.quantity}
                onChange={(e) => set('quantity', e.target.value)}
                min="1"
                required
              />
              {insufficientStock && (
                <div className="text-xs mt-1.5 text-red-400 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Not enough stock — only {itemStock} available
                </div>
              )}
            </label>

            <label className="block">
              <span className="block text-sm text-slate-400 mb-1.5">{locationLabel}</span>
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
              {form.type === 'transfer' && transferDestination && (
                <div className="text-xs mt-1.5 text-slate-500">Currently stored at another location; transfer updates it.</div>
              )}
            </label>

            <label className="block">
              <span className="block text-sm text-slate-400 mb-1.5">Date *</span>
              <input
                className="input-base"
                type="date"
                value={form.movement_date}
                onChange={(e) => set('movement_date', e.target.value)}
                required
              />
            </label>
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Movement Info</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="block text-sm text-slate-400 mb-1.5">Reference Number</span>
              <input
                className="input-base"
                value={form.reference_number}
                onChange={(e) => set('reference_number', e.target.value)}
                placeholder="e.g., SALES-001, PO-001"
              />
            </label>
            <label className="block">
              <span className="block text-sm text-slate-400 mb-1.5">Reason</span>
              <input
                className="input-base"
                value={form.reason}
                onChange={(e) => set('reason', e.target.value)}
                placeholder="Why is this movement happening?"
              />
            </label>
          </div>
        </div>

        <div className="card flex items-start gap-3 bg-slate-900/50">
          <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center text-blue-400 flex-shrink-0">
            {form.type === 'transfer' ? <MapPin className="w-4 h-4" /> : <Info className="w-4 h-4" />}
          </div>
          <div className="text-sm text-slate-400">
            {form.type === 'transfer'
              ? 'Transfers move the item to another location without changing its total quantity.'
              : 'Outbound deducts stock (sales, usage). Inbound adds stock (receiving). Stock status updates automatically.'}
          </div>
        </div>

        <div className="flex gap-3">
          <button type="submit" className="btn-primary" disabled={loading || insufficientStock}>
            <Save className="w-4 h-4 mr-2" /> {loading ? 'Saving...' : 'Create Movement'}
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate('/movements')}>
            Cancel
          </button>
        </div>
      </form>
    </main>
  );
}

export default MovementForm;
