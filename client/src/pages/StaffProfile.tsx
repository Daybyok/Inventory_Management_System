import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Shield, User, Lock, Save, Calendar, UserCheck, Clock } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { ROUTES } from '@/constants/routes';
import api from '@/api/index';

export default function StaffProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      try {
        const data = await api.getProfile();
        setProfile(data.user);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, []);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess(false);

    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    setIsChangingPassword(true);
    try {
      await api.changePassword({ oldPassword, newPassword });
      setPasswordSuccess(true);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPasswordError(err.message || 'Failed to change password');
    } finally {
      setIsChangingPassword(false);
    }
  };

  if (loading) {
    return (
      <main className="max-w-3xl mx-auto px-4 md:px-6 py-8">
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="max-w-3xl mx-auto px-4 md:px-6 py-8">
        <div className="card border-red-500/30 bg-red-500/10 text-red-400 p-4">{error}</div>
      </main>
    );
  }

  return (
    <main className="max-w-3xl mx-auto px-4 md:px-6 py-8">
      <div className="flex items-center gap-3 mb-8">
        <Link to={ROUTES.DASHBOARD} className="btn-secondary flex items-center gap-2 px-3 py-2">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>
        <h1 className="text-2xl font-bold">My Profile</h1>
      </div>

      <div className="space-y-8">
        <div className="card space-y-6">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-blue-400" /> Account Information
          </h2>

          <div className="space-y-5">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-2">Username</label>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center text-primary text-xl font-bold">
                  {(profile?.username || user?.username || '?').charAt(0).toUpperCase()}
                </div>
                <input
                  className="input-base flex-1 text-white"
                  value={profile?.username || user?.username || ''}
                  readOnly
                  disabled
                />
              </div>
              <p className="text-xs text-slate-500 mt-1">Your account username (read-only)</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2">Role</label>
                <span className="badge-info text-xs">
                  {profile?.role === 'admin' ? (
                    <span className="flex items-center gap-1">
                      <Shield className="w-3 h-3" /> Admin
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" /> Staff
                    </span>
                  )}
                </span>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2">Status</label>
                <span
                  className={`text-xs px-3 py-1.5 rounded-lg border inline-block ${
                    profile?.is_active
                      ? 'bg-success/10 text-success border-success/20'
                      : 'bg-warning/10 text-warning border-warning/20'
                  }`}
                >
                  {profile?.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-2">Account Created</label>
              <div className="flex items-center gap-2 text-sm text-white">
                <Calendar className="w-4 h-4 text-slate-500" />
                <span>
                  {profile?.created_at
                    ? new Date(profile.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })
                    : 'N/A'}
                </span>
              </div>
            </div>

            {profile?.last_login && (
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2">Last Login</label>
                <div className="flex items-center gap-2 text-sm text-white">
                  <Clock className="w-4 h-4 text-slate-500" />
                  <span>{new Date(profile.last_login).toLocaleString()}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="card space-y-6">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Lock className="w-5 h-5 text-blue-400" /> Change Password
          </h2>

          {passwordSuccess && (
            <div className="bg-success/10 border border-success/20 text-success px-4 py-3 rounded-lg text-sm">
              Password changed successfully!
            </div>
          )}

          {passwordError && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg text-sm">
              {passwordError}
            </div>
          )}

          <form onSubmit={handleChangePassword} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input
              type="password"
              className="input-base"
              placeholder="Current Password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              disabled={isChangingPassword}
              autoComplete="current-password"
            />
            <input
              type="password"
              className="input-base"
              placeholder="New Password (min 6)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={isChangingPassword}
              autoComplete="new-password"
            />
            <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <input
                type="password"
                className="input-base"
                placeholder="Confirm New Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isChangingPassword}
                autoComplete="new-password"
              />
              <button
                type="submit"
                disabled={isChangingPassword || !oldPassword || !newPassword}
                className="btn-primary flex items-center justify-center gap-2 disabled:cursor-not-allowed"
              >
                {isChangingPassword ? (
                  <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </form>
          <p className="text-xs text-slate-500">
            Changing your password signs out your other active sessions. Admins can manage account access.
          </p>
        </div>
      </div>
    </main>
  );
}
