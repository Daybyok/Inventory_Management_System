import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import api from '@/api/index.js';
import { Shield, Plus, Trash2, UserCheck, UserX, Wrench } from 'lucide-react';

export default function AdminUserManagement() {
  const { user } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = async () => {
    const data = await api.getUsers();
    setUsers(data.users);
  };

  useEffect(() => {
    async function load() {
      try {
        await reload();
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleCreate = async (data: { username: string; password: string; role: string }) => {
    try {
      await api.createUser(data);
      await reload();
      setError('');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleUpdate = async (id: number, data: any) => {
    try {
      await api.updateUser(id, data);
      await reload();
      setError('');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    try {
      await api.deleteUser(id);
      await reload();
      setError('');
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <main className="max-w-7xl mx-auto px-4 md:px-6 py-8 space-y-8">
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 bg-gradient-to-br from-red-500 to-orange-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">
          <Shield className="w-4 h-4" />
        </div>
        <div>
          <h1 className="font-bold text-xl">User Management</h1>
          <p className="text-sm text-slate-400">Create accounts and manage access.</p>
        </div>
      </div>

      {error && <div className="card border-red-500/30 bg-red-500/10 text-red-400">{error}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Total Users', value: users.length, icon: UserCheck, color: 'blue' },
          { label: 'Admins', value: users.filter((u) => u.role === 'admin').length, icon: Shield, color: 'red' },
          { label: 'Staff', value: users.filter((u) => u.role === 'staff').length, icon: UserX, color: 'amber' },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="card flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-xs uppercase tracking-wider">{stat.label}</p>
                <p className="text-3xl font-bold mt-1">{stat.value}</p>
              </div>
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  stat.color === 'blue'
                    ? 'bg-blue-500/10 text-blue-400'
                    : stat.color === 'red'
                      ? 'bg-red-500/10 text-red-400'
                      : 'bg-amber-500/10 text-amber-400'
                }`}
              >
                <Icon className="w-5 h-5" />
              </div>
            </div>
          );
        })}
      </div>

      <div className="card space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Plus className="w-5 h-5 text-primary" /> Create New User
        </h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const fd = new FormData(form);
            handleCreate({
              username: fd.get('username') as string,
              password: fd.get('password') as string,
              role: fd.get('role') as string,
            });
            form.reset();
          }}
          className="grid grid-cols-1 md:grid-cols-4 gap-3"
        >
          <input name="username" placeholder="Username *" className="input-base" required minLength={3} maxLength={50} />
          <input
            name="password"
            type="password"
            placeholder="Password (min 6) *"
            className="input-base"
            required
            minLength={6}
          />
          <select name="role" className="select-base" defaultValue="staff">
            <option value="staff">Staff</option>
            <option value="admin">Admin</option>
          </select>
          <button type="submit" className="btn-primary">
            Add User
          </button>
        </form>
        <p className="text-xs text-slate-500">
          Usernames may contain letters, numbers, dots, dashes and underscores. Passwords are stored salted and hashed.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">All Users</h2>
            <span className="text-xs text-slate-400">{users.length} users</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-left text-slate-400">
                  <th className="py-3 px-3">User</th>
                  <th className="py-3 px-3">Role</th>
                  <th className="py-3 px-3">Last Login</th>
                  <th className="py-3 px-3 text-right">Status</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isSelf = u.id === user?.id;
                  const isRoot = u.username === 'admin';
                  const protectedAccount = isSelf || isRoot;

                  return (
                    <tr key={u.id} className="border-b border-slate-800/50 hover:bg-slate-900/50">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <span className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-sm">
                            {u.username?.[0]?.toUpperCase() || '?'}
                          </span>
                          <div>
                            <div className="text-white font-medium">
                              {u.username}
                              {isSelf && <span className="text-xs text-slate-500 ml-2">(you)</span>}
                            </div>
                            <div className="text-xs text-slate-500">
                              Created {new Date(u.created_at).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span className={u.role === 'admin' ? 'badge-danger' : 'badge-info'}>
                          {u.role === 'admin' ? 'Admin' : 'Staff'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-400 text-xs">
                        {u.last_login ? new Date(u.last_login).toLocaleString() : 'Never'}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => handleUpdate(u.id, { is_active: !u.is_active })}
                          disabled={isSelf}
                          title={isSelf ? 'You cannot deactivate yourself' : 'Toggle status'}
                          className={`text-xs font-medium px-3 py-1 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                            u.is_active
                              ? 'bg-success/10 text-success hover:bg-success/20'
                              : 'bg-warning/10 text-warning hover:bg-warning/20'
                          }`}
                        >
                          {u.is_active ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex gap-2 justify-end">
                          <button
                            className="btn-secondary px-3 py-1.5"
                            onClick={() => handleUpdate(u.id, { role: u.role === 'admin' ? 'staff' : 'admin' })}
                            title={isSelf ? 'You cannot change your own role' : 'Toggle role'}
                            disabled={isSelf}
                          >
                            <Wrench className="w-3.5 h-3.5" />
                          </button>
                          <button
                            className="btn-secondary px-3 py-1.5 text-errorLight"
                            onClick={() => handleDelete(u.id)}
                            disabled={protectedAccount}
                            title={
                              isSelf
                                ? 'You cannot delete your own account'
                                : isRoot
                                  ? 'Cannot delete the root admin'
                                  : 'Delete'
                            }
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">
                      No users found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
}
