import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/index';
import { Plus, Search, Download, RefreshCw, ArrowUp, ArrowDown, Trash2 } from 'lucide-react';

const PAGE_SIZE = 50;

function csvEscape(value) {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function Movements() {
  const navigate = useNavigate();
  const [movements, setMovements] = useState([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const loadMovements = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getMovements({
        page,
        limit: PAGE_SIZE,
        search: debouncedSearch,
        type: filterType,
        date_from: dateFrom,
        date_to: dateTo,
      });
      setMovements(data.movements);
      setTotal(data.total);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMovements();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debouncedSearch, filterType, dateFrom, dateTo]);

  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  const deleteMovement = async (id) => {
    if (!confirm('Delete this movement? Stock will be adjusted back where possible.')) return;
    try {
      await api.deleteMovement(id);
      if (movements.length === 1 && page > 1) setPage((p) => p - 1);
      else loadMovements();
    } catch (err) {
      setError(err.message);
    }
  };

  const exportCSV = () => {
    if (movements.length === 0) return alert('No movements to export');
    const headers = ['ID', 'Item', 'SKU', 'Type', 'Quantity', 'Location', 'Reference', 'Reason', 'Date'];
    const rows = movements.map((m) => [
      m.id,
      m.item_name || `Item #${m.item_id}`,
      m.item_sku || '',
      m.type.toUpperCase(),
      m.quantity,
      m.location_name || `Location #${m.location_id}`,
      m.reference_number || '',
      m.reason || '',
      m.movement_date,
    ]);
    const csv = [headers, ...rows].map((row) => row.map(csvEscape).join(',')).join('\r\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `movements_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="px-6 py-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Movements</h1>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={exportCSV}>
            <Download className="w-4 h-4 mr-1" /> CSV
          </button>
          <button className="btn-primary" onClick={() => navigate('/movements/new')}>
            <Plus className="w-4 h-4 mr-1" /> New Movement
          </button>
        </div>
      </div>

      <div className="card mb-6 flex flex-col gap-4 xl:flex-row xl:items-center">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            className="input-base pl-10"
            placeholder="Search item, SKU, reference..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <select
          className="select-base max-w-xs"
          value={filterType}
          onChange={(e) => {
            setFilterType(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All Types</option>
          <option value="in">Inbound (IN)</option>
          <option value="out">Outbound (OUT)</option>
          <option value="transfer">Transfer</option>
        </select>

        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400 whitespace-nowrap">From</label>
          <input
            type="date"
            className="input-base py-2 max-w-[160px]"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
          />
          <label className="text-xs text-slate-400 whitespace-nowrap">To</label>
          <input
            type="date"
            className="input-base py-2 max-w-[160px]"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <div className="flex gap-2">
          <button
            className={`btn-secondary ${filterType === 'in' ? 'text-green-400 border-green-500' : ''}`}
            onClick={() => {
              setFilterType('in');
              setPage(1);
            }}
          >
            <ArrowUp className="w-4 h-4" /> In
          </button>
          <button
            className={`btn-secondary ${filterType === 'out' ? 'text-red-400 border-red-500' : ''}`}
            onClick={() => {
              setFilterType('out');
              setPage(1);
            }}
          >
            <ArrowDown className="w-4 h-4" /> Out
          </button>
          <button className="btn-secondary" onClick={loadMovements} aria-label="Refresh">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {error && <div className="card border-red-500/30 bg-red-500/10 text-red-400 mb-4">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : movements.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-slate-400 text-sm">No movements match your filters.</p>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-left text-slate-400">
                <th className="py-3 px-2 w-8">ID</th>
                <th className="py-3 px-2">Type</th>
                <th className="py-3 px-2">Item</th>
                <th className="py-3 px-2">Location</th>
                <th className="py-3 px-2">Qty</th>
                <th className="py-3 px-2">Reference</th>
                <th className="py-3 px-2">Reason</th>
                <th className="py-3 px-2">Date</th>
                <th className="py-3 px-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => (
                <tr key={m.id} className="border-b border-slate-800/50 hover:bg-slate-900/50">
                  <td className="py-3 px-2 text-slate-400 font-mono text-xs">{m.id}</td>
                  <td className="py-3 px-2">
                    <span
                      className={
                        m.type === 'in' ? 'badge-success' : m.type === 'out' ? 'badge-danger' : 'badge-info'
                      }
                    >
                      {m.type.toUpperCase()}
                    </span>
                  </td>
                  <td className="py-3 px-2 text-slate-300">
                    {m.item_name || `Item #${m.item_id}`}
                    {m.item_sku && <div className="text-xs text-slate-500 font-mono">{m.item_sku}</div>}
                  </td>
                  <td className="py-3 px-2 text-slate-400">{m.location_name || `Loc #${m.location_id}`}</td>
                  <td className="py-3 px-2 font-medium text-white">
                    <span className={m.type === 'in' ? 'text-green-400' : m.type === 'out' ? 'text-red-400' : 'text-blue-400'}>
                      {m.type === 'in' ? '+' : m.type === 'out' ? '-' : '~'}
                      {m.quantity}
                    </span>
                  </td>
                  <td className="py-3 px-2 text-slate-400">{m.reference_number || '—'}</td>
                  <td className="py-3 px-2 text-slate-400 max-w-[220px] truncate" title={m.reason || ''}>
                    {m.reason || '—'}
                  </td>
                  <td className="py-3 px-2 text-slate-400">{new Date(m.movement_date).toLocaleDateString()}</td>
                  <td className="py-3 px-2 text-right">
                    <button className="btn-danger" title="Delete movement" onClick={() => deleteMovement(m.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button className="btn-secondary" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
            Previous
          </button>
          <span className="text-sm text-slate-400 px-3">
            Page {page} of {totalPages}
          </span>
          <button
            className="btn-secondary"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
          >
            Next
          </button>
        </div>
      )}
    </main>
  );
}

export default Movements;
