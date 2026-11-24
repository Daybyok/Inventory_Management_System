import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/index';
import { Plus, Search, Filter, ArrowDownCircle, ArrowUpCircle, Pencil, Trash2, Eye } from 'lucide-react';

const PAGE_SIZE = 50;
const DEFAULT_CATEGORIES = ['General', 'Grains', 'Meat', 'Dairy', 'Produce', 'Household'];

function Items() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('name');
  const [order, setOrder] = useState('asc');
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    api
      .getCategories()
      .then((data) => {
        if (data.categories?.length) {
          setCategories(Array.from(new Set([...DEFAULT_CATEGORIES, ...data.categories])));
        }
      })
      .catch(() => {});
  }, []);

  const loadItems = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getItems({
        sort,
        order,
        page,
        limit: PAGE_SIZE,
        search: debouncedSearch,
        category,
        status,
      });
      setItems(data.items);
      setTotal(data.total);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debouncedSearch, category, status, sort, order]);

  const deleteItem = async (id) => {
    if (!confirm('Delete this item? Its movement history will also be deleted.')) return;
    try {
      await api.deleteItem(id);
      if (items.length === 1 && page > 1) setPage((p) => p - 1);
      else loadItems();
    } catch (err) {
      setError(err.message);
    }
  };

  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  return (
    <main className="px-6 py-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Items</h1>
        <button className="btn-primary" onClick={() => navigate('/items/new')}>
          <Plus className="w-4 h-4 mr-2" /> Add Item
        </button>
      </div>

      <div className="card mb-6 flex flex-col gap-4 lg:flex-row">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            className="input-base pl-10"
            placeholder="Search name, SKU, category..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <select
          className="select-base max-w-xs"
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select
          className="select-base max-w-xs"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All Statuses</option>
          <option value="in_stock">In Stock</option>
          <option value="low_stock">Low Stock</option>
          <option value="out_stock">Out of Stock</option>
        </select>

        <div className="flex gap-2">
          <button
            className={`btn-secondary ${sort === 'quantity' ? 'text-blue-400 border-blue-500' : ''}`}
            onClick={() => {
              setSort(sort === 'quantity' ? 'name' : 'quantity');
              setPage(1);
            }}
          >
            <Filter className="w-4 h-4" /> Sort: {sort === 'quantity' ? 'Stock' : 'Name'}
          </button>
          <button
            className="btn-secondary"
            onClick={() => setOrder(order === 'asc' ? 'desc' : 'asc')}
            aria-label="Toggle sort direction"
          >
            {order === 'asc' ? <ArrowUpCircle className="w-4 h-4" /> : <ArrowDownCircle className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {error && <div className="card border-red-500/30 bg-red-500/10 text-red-400 mb-4">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-slate-400 text-sm">
            No items found. {search || category || status ? 'Try different filters.' : 'Add your first item.'}
          </p>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-left text-slate-400">
                <th className="py-3 px-2">Item</th>
                <th className="py-3 px-2">SKU</th>
                <th className="py-3 px-2">Category</th>
                <th className="py-3 px-2">Location</th>
                <th className="py-3 px-2">Qty</th>
                <th className="py-3 px-2">Price</th>
                <th className="py-3 px-2">Status</th>
                <th className="py-3 px-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-slate-800/50 hover:bg-slate-900/50">
                  <td className="py-3 px-2">
                    <span className="font-medium text-white">{item.name}</span>
                    <div className="text-xs text-slate-500 mt-0.5 line-clamp-1">{item.description || ''}</div>
                  </td>
                  <td className="py-3 px-2 text-slate-400 font-mono text-xs">{item.SKU}</td>
                  <td className="py-3 px-2">
                    <span className="badge-info">{item.category}</span>
                  </td>
                  <td className="py-3 px-2 text-slate-400">{item.location_name || '—'}</td>
                  <td className="py-3 px-2 font-medium text-white">{item.quantity}</td>
                  <td className="py-3 px-2 text-white font-medium">₱{Number(item.unit_price).toFixed(2)}</td>
                  <td className="py-3 px-2">
                    <span
                      className={
                        item.status === 'in_stock'
                          ? 'badge-success'
                          : item.status === 'low_stock'
                            ? 'badge-warning'
                            : 'badge-danger'
                      }
                    >
                      {item.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-3 px-2 text-right">
                    <div className="flex gap-2 justify-end">
                      <button
                        className="btn-secondary"
                        title="View"
                        onClick={() => navigate(`/items/${item.id}`)}
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        className="btn-secondary"
                        title="Edit"
                        onClick={() => navigate(`/items/edit/${item.id}`)}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button className="btn-danger" title="Delete" onClick={() => deleteItem(item.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
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

export default Items;
