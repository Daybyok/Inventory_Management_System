import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api/index';
import { ArrowLeft, Pencil, Package, MapPin, Tag, Calendar, Hash } from 'lucide-react';

function ItemDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [item, setItem] = useState(null);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const [itemData, movementData] = await Promise.all([
          api.getItem(id),
          api.getMovements({ item_id: id, limit: 10 }),
        ]);
        setItem(itemData);
        setMovements(movementData.movements || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <main className="px-6 py-8">
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
        </div>
      </main>
    );
  }

  if (error || !item) {
    return (
      <main className="px-6 py-8 max-w-3xl mx-auto">
        <div className="card border-red-500/30 bg-red-500/10 text-red-400 mb-4">{error || 'Item not found'}</div>
        <button className="btn-secondary" onClick={() => navigate('/items')}>
          <ArrowLeft className="w-4 h-4" /> Back to items
        </button>
      </main>
    );
  }

  const statusClass =
    item.status === 'in_stock' ? 'badge-success' : item.status === 'low_stock' ? 'badge-warning' : 'badge-danger';

  return (
    <main className="px-6 py-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <button className="btn-secondary" onClick={() => navigate('/items')}>
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <h1 className="text-2xl font-bold">{item.name}</h1>
        </div>
        <button className="btn-primary" onClick={() => navigate(`/items/edit/${item.id}`)}>
          <Pencil className="w-4 h-4 mr-2" /> Edit
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="card space-y-3">
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <Package className="w-4 h-4 text-slate-500" /> Stock: <span className="text-white font-medium">{item.quantity} units</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <Tag className="w-4 h-4 text-slate-500" /> Price:{' '}
            <span className="text-white font-medium">₱{Number(item.unit_price).toFixed(2)}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <Hash className="w-4 h-4 text-slate-500" /> SKU: <span className="font-mono text-white">{item.SKU}</span>
          </div>
        </div>

        <div className="card space-y-3">
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <MapPin className="w-4 h-4 text-slate-500" /> Location:{' '}
            <span className="text-white font-medium">{item.location_name || 'Unassigned'}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <Tag className="w-4 h-4 text-slate-500" /> Category: <span className="badge-info">{item.category}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <Calendar className="w-4 h-4 text-slate-500" /> Added:{' '}
            <span className="text-white">{new Date(item.created_at).toLocaleDateString()}</span>
          </div>
          <div className="pt-1">
            <span className={statusClass}>{item.status.replace('_', ' ')}</span>
          </div>
        </div>
      </div>

      {item.description && (
        <div className="card mb-6">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2">Description</h2>
          <p className="text-sm text-slate-300 whitespace-pre-wrap">{item.description}</p>
        </div>
      )}

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Recent Movements</h2>
          <button className="btn-secondary text-sm" onClick={() => navigate('/movements/new')}>
            New Movement
          </button>
        </div>
        {movements.length === 0 ? (
          <p className="text-slate-500 text-sm">No movements recorded for this item yet.</p>
        ) : (
          <div className="space-y-2">
            {movements.map((m) => (
              <div key={m.id} className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0 text-sm">
                <div className="flex items-center gap-3">
                  <span
                    className={`font-medium ${
                      m.type === 'in' ? 'text-green-400' : m.type === 'out' ? 'text-red-400' : 'text-blue-400'
                    }`}
                  >
                    {m.type.toUpperCase()}
                  </span>
                  <span className="text-slate-300">{m.reference_number || '—'}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-white">
                    {m.type === 'out' ? '-' : m.type === 'in' ? '+' : '~'}
                    {m.quantity}
                  </span>
                  <span className="text-slate-500 text-xs">{new Date(m.movement_date).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

export default ItemDetail;
