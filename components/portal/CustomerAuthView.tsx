/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { ArrowLeft, KeyRound, Lock, Mail, Phone, User } from 'lucide-react';
import { auth, googleAuthProvider } from '../../src/lib/firebase';
import type { CustomerSession } from './portalTypes';

interface CustomerAuthViewProps {
  websiteName: string;
  logoUrl: string | null;
  initialMode?: 'login' | 'register';
  onAuthenticated: (session: CustomerSession) => void;
  onBrowseHome?: () => void;
}

type AuthMode = 'login' | 'register' | 'forgot';

const CustomerAuthView: React.FC<CustomerAuthViewProps> = ({
  websiteName,
  logoUrl,
  initialMode = 'login',
  onAuthenticated,
  onBrowseHome,
}) => {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Login form
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Registration form
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');

  // Forgot password form
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetStep, setResetStep] = useState<'request' | 'confirm'>('request');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [fallbackResetCode, setFallbackResetCode] = useState<string | null>(null);

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setError(null);
    setNotice(null);
    if (next === 'forgot') {
      setResetStep('request');
      setFallbackResetCode(null);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      const resp = await fetch('/api/customer/auth/login', {
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
      onAuthenticated({ token: data.token, customer: data.customer });
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
      const resp = await fetch('/api/customer/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(data.error || 'Google authentication failed.');
      }
      onAuthenticated({ token: data.token, customer: data.customer });
    } catch (err: any) {
      if (
        err?.code === 'auth/popup-closed-by-user' ||
        err?.code === 'auth/cancelled-popup-request'
      ) {
        setError('Google sign-in popup was closed before completion.');
      } else {
        setError(err?.message || 'Google sign-in failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (regPassword !== regConfirmPassword) {
      setError('Password and Confirm Password must match.');
      return;
    }

    setLoading(true);
    try {
      const resp = await fetch('/api/customer/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: regName.trim(),
          email: regEmail.trim(),
          phone: regPhone.trim(),
          password: regPassword,
        }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(data.error || 'Unable to create customer account.');
      }
      onAuthenticated({ token: data.token, customer: data.customer });
    } catch (err: any) {
      setError(err?.message || 'Registration failed.');
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
      const resp = await fetch('/api/customer/auth/forgot-password', {
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
      const resp = await fetch('/api/customer/auth/reset-password', {
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
      <header className="h-16 px-6 md:px-10 border-b border-[#E5E5E5] bg-white flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {logoUrl && (
            <img
              src={logoUrl}
              alt={websiteName}
              referrerPolicy="no-referrer"
              className="h-7 w-auto object-contain shrink-0"
            />
          )}
          <span className="text-lg font-semibold tracking-tight truncate">
            {websiteName}
          </span>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {onBrowseHome && (
            <button
              type="button"
              onClick={onBrowseHome}
              className="inline-flex items-center gap-2 px-3.5 py-2 border border-[#D4D4D4] text-xs font-medium uppercase tracking-wider text-[#0A0A0A] hover:border-[#0A0A0A] whitespace-nowrap"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Home Page
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white border border-[#E5E5E5] p-8 md:p-10">
          <div className="mb-8">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#737373] mb-2">
              Customer Portal
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-[#0A0A0A]">
              {mode === 'login' && 'Sign In to Your Account'}
              {mode === 'register' && 'Create Customer Account'}
              {mode === 'forgot' && 'Reset Password'}
            </h1>
          </div>

          {mode !== 'forgot' && (
            <div className="grid grid-cols-2 border border-[#E5E5E5] bg-[#F5F5F5] p-1 mb-7">
              <button
                type="button"
                onClick={() => switchMode('login')}
                className={`py-2 text-xs font-medium uppercase tracking-wider transition-colors ${
                  mode === 'login'
                    ? 'bg-[#0A0A0A] text-white'
                    : 'text-[#525252] hover:text-[#0A0A0A]'
                }`}
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => switchMode('register')}
                className={`py-2 text-xs font-medium uppercase tracking-wider transition-colors ${
                  mode === 'register'
                    ? 'bg-[#0A0A0A] text-white'
                    : 'text-[#525252] hover:text-[#0A0A0A]'
                }`}
              >
                Register
              </button>
            </div>
          )}

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
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label
                  htmlFor="customer-login-email"
                  className="block text-xs font-medium uppercase tracking-wider text-[#525252] mb-2"
                >
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#737373] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="customer-login-email"
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full pl-10 pr-4 py-2.5 border border-[#D4D4D4] text-sm text-[#0A0A0A] placeholder-[#A3A3A3] focus:outline-none focus:border-[#0A0A0A]"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label
                    htmlFor="customer-login-password"
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
                    id="customer-login-password"
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full pl-10 pr-4 py-2.5 border border-[#D4D4D4] text-sm text-[#0A0A0A] placeholder-[#A3A3A3] focus:outline-none focus:border-[#0A0A0A]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-[#0A0A0A] text-white text-xs font-medium uppercase tracking-widest hover:bg-[#262626] transition-colors disabled:opacity-50"
              >
                {loading ? 'Signing In...' : 'Sign In'}
              </button>

              <div className="relative py-1">
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
                className="w-full py-2.5 border border-[#D4D4D4] bg-white text-[#0A0A0A] text-xs font-medium uppercase tracking-wider hover:border-[#0A0A0A] transition-colors flex items-center justify-center gap-2.5 disabled:opacity-50"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Continue with Google
              </button>
            </form>
          )}

          {mode === 'register' && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label
                  htmlFor="customer-reg-name"
                  className="block text-xs font-medium uppercase tracking-wider text-[#525252] mb-1.5"
                >
                  Full Name *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-[#737373] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="customer-reg-name"
                    type="text"
                    required
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="Your full name"
                    className="w-full pl-10 pr-3.5 py-2.5 border border-[#D4D4D4] text-sm text-[#0A0A0A] placeholder-[#A3A3A3] focus:outline-none focus:border-[#0A0A0A]"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="customer-reg-email"
                  className="block text-xs font-medium uppercase tracking-wider text-[#525252] mb-1.5"
                >
                  Email Address *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#737373] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="customer-reg-email"
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full pl-10 pr-3.5 py-2.5 border border-[#D4D4D4] text-sm text-[#0A0A0A] placeholder-[#A3A3A3] focus:outline-none focus:border-[#0A0A0A]"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="customer-reg-phone"
                  className="block text-xs font-medium uppercase tracking-wider text-[#525252] mb-1.5"
                >
                  Phone Number
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-[#737373] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="customer-reg-phone"
                    type="tel"
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full pl-10 pr-3.5 py-2.5 border border-[#D4D4D4] text-sm text-[#0A0A0A] placeholder-[#A3A3A3] tabular-nums focus:outline-none focus:border-[#0A0A0A]"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="customer-reg-password"
                  className="block text-xs font-medium uppercase tracking-wider text-[#525252] mb-1.5"
                >
                  Password *
                </label>
                <input
                  id="customer-reg-password"
                  type="password"
                  required
                  minLength={6}
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full px-3.5 py-2.5 border border-[#D4D4D4] text-sm text-[#0A0A0A] placeholder-[#A3A3A3] focus:outline-none focus:border-[#0A0A0A]"
                />
              </div>

              <div>
                <label
                  htmlFor="customer-reg-confirm-password"
                  className="block text-xs font-medium uppercase tracking-wider text-[#525252] mb-1.5"
                >
                  Confirm Password *
                </label>
                <input
                  id="customer-reg-confirm-password"
                  type="password"
                  required
                  minLength={6}
                  value={regConfirmPassword}
                  onChange={(e) => setRegConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className="w-full px-3.5 py-2.5 border border-[#D4D4D4] text-sm text-[#0A0A0A] placeholder-[#A3A3A3] focus:outline-none focus:border-[#0A0A0A]"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 mt-2 bg-[#0A0A0A] text-white text-xs font-medium uppercase tracking-widest hover:bg-[#262626] transition-colors disabled:opacity-50"
              >
                {loading ? 'Creating Account...' : 'Create Customer Account'}
              </button>

              <div className="relative py-1">
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
                className="w-full py-2.5 border border-[#D4D4D4] bg-white text-[#0A0A0A] text-xs font-medium uppercase tracking-wider hover:border-[#0A0A0A] transition-colors flex items-center justify-center gap-2.5 disabled:opacity-50"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Continue with Google
              </button>
            </form>
          )}

          {mode === 'forgot' && (
            <div className="space-y-5">
              {resetStep === 'request' ? (
                <form onSubmit={handleForgotRequest} className="space-y-4">
                  <p className="text-xs text-[#525252] leading-relaxed">
                    Enter the email address registered with your customer account to receive a password reset verification code.
                  </p>
                  <div>
                    <label
                      htmlFor="customer-forgot-email"
                      className="block text-xs font-medium uppercase tracking-wider text-[#525252] mb-1.5"
                    >
                      Email Address
                    </label>
                    <input
                      id="customer-forgot-email"
                      type="email"
                      required
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full px-3.5 py-2.5 border border-[#D4D4D4] text-sm text-[#0A0A0A] focus:outline-none focus:border-[#0A0A0A]"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 bg-[#0A0A0A] text-white text-xs font-medium uppercase tracking-widest hover:bg-[#262626] transition-colors disabled:opacity-50"
                  >
                    {loading ? 'Sending Code...' : 'Send Reset Code'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleResetConfirm} className="space-y-4">
                  <div>
                    <label
                      htmlFor="customer-reset-code"
                      className="block text-xs font-medium uppercase tracking-wider text-[#525252] mb-1.5"
                    >
                      6-Digit Verification Code
                    </label>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-[#737373] absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        id="customer-reset-code"
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
                      htmlFor="customer-new-password"
                      className="block text-xs font-medium uppercase tracking-wider text-[#525252] mb-1.5"
                    >
                      New Password
                    </label>
                    <input
                      id="customer-new-password"
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

export default CustomerAuthView;
