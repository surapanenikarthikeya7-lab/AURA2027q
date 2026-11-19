/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { ArrowLeft, KeyRound, Lock, Mail, UserCheck } from 'lucide-react';
import { auth, googleAuthProvider } from '../../src/lib/firebase';
import type { AdminAuthSession } from './adminTypes';

interface AdminAuthViewProps {
  websiteName: string;
  logoUrl: string | null;
  onAuthenticated: (session: AdminAuthSession) => void;
  onBackToStore: () => void;
}

type AuthMode = 'login' | 'forgot';

const AdminAuthView: React.FC<AdminAuthViewProps> = ({
  websiteName,
  logoUrl,
  onAuthenticated,
  onBackToStore,
}) => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Login form
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Forgot password form
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetStep, setResetStep] = useState<'request' | 'confirm'>('request');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [fallbackResetCode, setFallbackResetCode] = useState<string | null>(null);

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setError(null);
    setNotice(null);
    if (nextMode === 'forgot') {
      setResetStep('request');
      setFallbackResetCode(null);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      const resp = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: loginEmail.trim(),
          password: loginPassword,
        }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(data.error || 'Unable to sign in.');
      }
      onAuthenticated({ token: data.token, admin: data.admin });
    } catch (err: any) {
      setError(err?.message || 'Sign in failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleAuthProvider);
      const idToken = await result.user.getIdToken();
      const resp = await fetch('/api/admin/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(data.error || 'Google authentication failed.');
      }
      onAuthenticated({ token: data.token, admin: data.admin });
    } catch (err: any) {
      setError(err?.message || 'Google sign-in was cancelled or denied.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      const resp = await fetch('/api/admin/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail.trim() }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(data.error || 'Unable to send reset code.');
      }
      setNotice(data.message || 'Verification code issued.');
      if (data.fallbackCode) {
        setFallbackResetCode(data.fallbackCode);
      }
      setResetStep('confirm');
    } catch (err: any) {
      setError(err?.message || 'Failed to initiate password reset.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      const resp = await fetch('/api/admin/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: forgotEmail.trim(),
          code: resetCode.trim(),
          newPassword,
        }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(data.error || 'Unable to reset password.');
      }
      setNotice(data.message || 'Password updated. Please sign in.');
      setMode('login');
      setLoginEmail(forgotEmail.trim());
      setLoginPassword('');
      setResetCode('');
      setNewPassword('');
    } catch (err: any) {
      setError(err?.message || 'Password reset failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#0A0A0A] flex flex-col">
      {/* Top Bar */}
      <header className="h-16 px-6 md:px-10 border-b border-[#E5E5E5] bg-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          {logoUrl && (
            <img
              src={logoUrl}
              alt={websiteName}
              referrerPolicy="no-referrer"
              className="h-7 w-auto object-contain"
            />
          )}
          <span className="text-lg font-semibold tracking-tight">{websiteName} Admin</span>
        </div>
        <button
          type="button"
          onClick={onBackToStore}
          className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-[#525252] hover:text-[#0A0A0A] transition-colors whitespace-nowrap"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home Page
        </button>
      </header>

      {/* Main Auth Card */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white border border-[#E5E5E5] p-8 md:p-10">
          <div className="mb-8">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#737373] mb-2">
              Authorized Access Only
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-[#0A0A0A]">
              {mode === 'login' ? 'Admin Portal Sign In' : 'Reset Admin Password'}
            </h1>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-6 p-3.5 border border-[#DC2626]/30 bg-[#FEF2F2] text-xs text-[#991B1B]"
            >
              {error}
            </div>
          )}

          {notice && (
            <div className="mb-6 p-3.5 border border-[#16A34A]/30 bg-[#F0FDF4] text-xs text-[#166534]">
              {notice}
              {fallbackResetCode && (
                <div className="mt-2 font-mono font-semibold text-sm text-[#0A0A0A]">
                  Verification Code: {fallbackResetCode}
                </div>
              )}
            </div>
          )}

          {mode === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-5">
              <div>
                <label
                  htmlFor="admin-login-email"
                  className="block text-xs font-medium uppercase tracking-wider text-[#525252] mb-2"
                >
                  Admin Gmail / Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#737373] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="admin-login-email"
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="admin@gmail.com"
                    className="w-full pl-10 pr-4 py-2.5 border border-[#D4D4D4] text-sm text-[#0A0A0A] placeholder-[#A3A3A3] focus:outline-none focus:border-[#0A0A0A]"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label
                    htmlFor="admin-login-password"
                    className="block text-xs font-medium uppercase tracking-wider text-[#525252]"
                  >
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => switchMode('forgot')}
                    className="text-xs text-[#525252] hover:text-[#0A0A0A] underline underline-offset-4"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#737373] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="admin-login-password"
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Enter password"
                    className="w-full pl-10 pr-4 py-2.5 border border-[#D4D4D4] text-sm text-[#0A0A0A] placeholder-[#A3A3A3] focus:outline-none focus:border-[#0A0A0A]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-[#0A0A0A] text-white text-xs font-medium uppercase tracking-widest hover:bg-[#262626] transition-colors disabled:opacity-50"
              >
                {loading ? 'Signing In...' : 'Login to Admin Portal'}
              </button>

              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[#E5E5E5]" />
                </div>
                <div className="relative flex justify-center text-[11px] uppercase tracking-widest">
                  <span className="bg-white px-3 text-[#737373]">Or</span>
                </div>
              </div>

              <button
                type="button"
                disabled={loading}
                onClick={handleGoogleSignIn}
                className="w-full py-2.5 border border-[#D4D4D4] bg-white text-[#0A0A0A] text-xs font-medium uppercase tracking-wider hover:border-[#0A0A0A] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <UserCheck className="w-4 h-4" />
                Sign in with Google
              </button>
            </form>
          )}

          {mode === 'forgot' && (
            <div className="space-y-5">
              {resetStep === 'request' ? (
                <form onSubmit={handleForgotRequest} className="space-y-4">
                  <p className="text-xs text-[#525252] leading-relaxed">
                    Enter your registered administrator email address to receive a password reset verification code.
                  </p>
                  <div>
                    <label
                      htmlFor="admin-forgot-email"
                      className="block text-xs font-medium uppercase tracking-wider text-[#525252] mb-1.5"
                    >
                      Admin Email
                    </label>
                    <input
                      id="admin-forgot-email"
                      type="email"
                      required
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="admin@gmail.com"
                      className="w-full px-3.5 py-2.5 border border-[#D4D4D4] text-sm text-[#0A0A0A] focus:outline-none focus:border-[#0A0A0A]"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 bg-[#0A0A0A] text-white text-xs font-medium uppercase tracking-widest hover:bg-[#262626] transition-colors disabled:opacity-50"
                  >
                    {loading ? 'Sending Code...' : 'Send Verification Code'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleResetConfirm} className="space-y-4">
                  <div>
                    <label
                      htmlFor="admin-reset-code"
                      className="block text-xs font-medium uppercase tracking-wider text-[#525252] mb-1.5"
                    >
                      6-Digit Verification Code
                    </label>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-[#737373] absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        id="admin-reset-code"
                        type="text"
                        required
                        value={resetCode}
                        onChange={(e) => setResetCode(e.target.value)}
                        placeholder="123456"
                        className="w-full pl-10 pr-4 py-2.5 border border-[#D4D4D4] text-sm font-mono text-[#0A0A0A] focus:outline-none focus:border-[#0A0A0A]"
                      />
                    </div>
                  </div>
                  <div>
                    <label
                      htmlFor="admin-new-password"
                      className="block text-xs font-medium uppercase tracking-wider text-[#525252] mb-1.5"
                    >
                      New Password
                    </label>
                    <input
                      id="admin-new-password"
                      type="password"
                      required
                      minLength={6}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimum 6 characters"
                      className="w-full px-3.5 py-2.5 border border-[#D4D4D4] text-sm text-[#0A0A0A] focus:outline-none focus:border-[#0A0A0A]"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 bg-[#0A0A0A] text-white text-xs font-medium uppercase tracking-widest hover:bg-[#262626] transition-colors disabled:opacity-50"
                  >
                    {loading ? 'Updating Password...' : 'Update Password'}
                  </button>
                </form>
              )}

              <button
                type="button"
                onClick={() => switchMode('login')}
                className="w-full text-center text-xs text-[#525252] hover:text-[#0A0A0A] underline underline-offset-4 pt-2"
              >
                Return to Sign In
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminAuthView;
