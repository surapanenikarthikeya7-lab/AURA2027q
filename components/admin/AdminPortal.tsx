/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { signOut } from 'firebase/auth';
import {
  ArrowLeft,
  CreditCard,
  Globe,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  Package,
  ShoppingBag,
  X,
} from 'lucide-react';
import { auth } from '../../src/lib/firebase';
import AdminAuthView from './AdminAuthView';
import DashboardOverviewView from './DashboardOverviewView';
import ProductsManagementView from './ProductsManagementView';
import CustomerOrdersView from './CustomerOrdersView';
import PaymentSettingsView from './PaymentSettingsView';
import MailSenderView from './MailSenderView';
import WebsiteProfileView from './WebsiteProfileView';
import type { AdminAuthSession, AdminSection } from './adminTypes';

const ADMIN_TOKEN_KEY = 'aura_admin_session_token';

interface AdminPortalProps {
  websiteName: string;
  logoUrl: string | null;
  onBackToStore: () => void;
  onStorefrontUpdated: () => Promise<void>;
}

const NAV_ITEMS: Array<{
  id: AdminSection;
  label: string;
  icon: React.FC<{ className?: string }>;
}> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'products', label: 'Products Management', icon: Package },
  { id: 'orders', label: 'Customer Orders', icon: ShoppingBag },
  { id: 'payment', label: 'Payment Settings', icon: CreditCard },
  { id: 'mail', label: 'Mail Sender', icon: Mail },
  { id: 'profile', label: 'Website Profile', icon: Globe },
];

const AdminPortal: React.FC<AdminPortalProps> = ({
  websiteName,
  logoUrl,
  onBackToStore,
  onStorefrontUpdated,
}) => {
  const [session, setSession] = useState<AdminAuthSession | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [activeSection, setActiveSection] = useState<AdminSection>('dashboard');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  const notify = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    let active = true;
    const verifyStoredSession = async () => {
      try {
        const storedToken = sessionStorage.getItem(ADMIN_TOKEN_KEY);
        if (!storedToken) {
          if (active) setCheckingSession(false);
          return;
        }
        const resp = await fetch('/api/admin/auth/me', {
          headers: { Authorization: `Bearer ${storedToken}` },
        });
        if (!resp.ok) {
          sessionStorage.removeItem(ADMIN_TOKEN_KEY);
          if (active) setCheckingSession(false);
          return;
        }
        const data = await resp.json();
        if (active) {
          setSession({ token: storedToken, admin: data.admin });
          setCheckingSession(false);
        }
      } catch {
        if (active) setCheckingSession(false);
      }
    };
    verifyStoredSession();
    return () => {
      active = false;
    };
  }, []);

  const handleAuthenticated = (nextSession: AdminAuthSession) => {
    try {
      sessionStorage.setItem(ADMIN_TOKEN_KEY, nextSession.token);
    } catch {
      // Ignore storage errors
    }
    setSession(nextSession);
    setActiveSection('dashboard');
  };

  const handleLogout = async () => {
    if (session?.token) {
      try {
        await fetch('/api/admin/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.token}` },
        });
      } catch {
        // Ignore network failure on logout
      }
    }
    try {
      await signOut(auth);
    } catch {
      // Ignore firebase signout error if signed in via local credentials
    }
    try {
      sessionStorage.removeItem(ADMIN_TOKEN_KEY);
    } catch {
      // Ignore storage error
    }
    setSession(null);
    setMobileSidebarOpen(false);
  };

  const handleUploadImage = useCallback(
    async (file: File): Promise<string> => {
      if (!session?.token) throw new Error('Not authenticated.');
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('Image file must be 5 MB or smaller.');
      }
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Failed to read image file.'));
        reader.readAsDataURL(file);
      });

      const resp = await fetch('/api/admin/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({ dataUrl, filename: file.name }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(data.error || 'Image upload failed.');
      }
      return data.url;
    },
    [session?.token]
  );

  const handleDownloadBackup = useCallback(async () => {
    if (!session?.token) return;
    try {
      const resp = await fetch('/api/admin/backup', {
        headers: { Authorization: `Bearer ${session.token}` },
      });
      if (!resp.ok) throw new Error('Backup export failed.');
      const blob = await resp.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = `aura-db-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objUrl);
      notify('success', 'Database backup downloaded.');
    } catch (err: any) {
      notify('error', err?.message || 'Unable to export backup.');
    }
  }, [session?.token, notify]);

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center">
        <div className="text-xs uppercase tracking-widest text-[#737373]">
          Verifying Admin Session...
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <AdminAuthView
        websiteName={websiteName}
        logoUrl={logoUrl}
        onAuthenticated={handleAuthenticated}
        onBackToStore={onBackToStore}
      />
    );
  }

  const activeLabel =
    NAV_ITEMS.find((item) => item.id === activeSection)?.label || 'Dashboard';

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#0A0A0A] flex">
      {/* Mobile Sidebar Backdrop */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-[#0A0A0A] text-white flex flex-col justify-between transition-transform duration-200 shrink-0 ${
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div>
          {/* Sidebar Brand */}
          <div className="h-16 px-6 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              {logoUrl && (
                <img
                  src={logoUrl}
                  alt={websiteName}
                  referrerPolicy="no-referrer"
                  className="h-6 w-auto max-w-[80px] object-contain bg-white/95 p-0.5"
                />
              )}
              <span className="font-semibold tracking-tight text-sm truncate">
                {websiteName} Admin
              </span>
            </div>
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(false)}
              className="lg:hidden p-1 text-white/70 hover:text-white"
              aria-label="Close sidebar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* 7 Sidebar Navigation Items */}
          <nav className="p-4 space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveSection(item.id);
                    setMobileSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-xs font-medium tracking-wide transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-white text-[#0A0A0A]'
                      : 'text-white/75 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}

            <div className="pt-4 mt-4 border-t border-white/10">
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 text-xs font-medium tracking-wide text-white/75 hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap"
              >
                <LogOut className="w-4 h-4 shrink-0" />
                <span>Logout</span>
              </button>
            </div>
          </nav>
        </div>

        {/* Bottom Admin Identity */}
        <div className="p-5 border-t border-white/10 text-xs">
          <div className="font-medium text-white truncate">{session.admin.name}</div>
          <div className="text-white/60 truncate mt-0.5">{session.admin.email}</div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="h-16 px-4 sm:px-8 bg-white border-b border-[#E5E5E5] flex items-center justify-between gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="Open navigation sidebar"
              className="lg:hidden p-2 text-[#0A0A0A] border border-[#E5E5E5]"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="text-sm font-medium text-[#0A0A0A] truncate">
              <span className="text-[#737373]">Admin Portal / </span>
              <span>{activeLabel}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onBackToStore}
              className="inline-flex items-center gap-2 px-3.5 py-2 border border-[#D4D4D4] text-xs font-medium uppercase tracking-wider text-[#0A0A0A] hover:border-[#0A0A0A] whitespace-nowrap"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              View Home Page
            </button>
          </div>
        </header>

        {/* Notification Banner */}
        {toast && (
          <div className="px-4 sm:px-8 pt-5">
            <div
              role="status"
              className={`px-4 py-3 border text-xs flex items-center justify-between gap-4 ${
                toast.type === 'success'
                  ? 'bg-[#F0FDF4] border-[#16A34A]/30 text-[#166534]'
                  : 'bg-[#FEF2F2] border-[#DC2626]/30 text-[#991B1B]'
              }`}
            >
              <span>{toast.message}</span>
              <button
                type="button"
                onClick={() => setToast(null)}
                aria-label="Dismiss notification"
                className="shrink-0 opacity-70 hover:opacity-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Active Page */}
        <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto">
          {activeSection === 'dashboard' && (
            <DashboardOverviewView
              token={session.token}
              onNavigate={setActiveSection}
              onNotify={notify}
              onDownloadBackup={handleDownloadBackup}
            />
          )}

          {activeSection === 'products' && (
            <ProductsManagementView
              token={session.token}
              onNotify={notify}
              onStorefrontUpdated={onStorefrontUpdated}
              onUploadImage={handleUploadImage}
            />
          )}

          {activeSection === 'orders' && (
            <CustomerOrdersView token={session.token} onNotify={notify} />
          )}

          {activeSection === 'payment' && (
            <PaymentSettingsView
              token={session.token}
              onNotify={notify}
              onStorefrontUpdated={onStorefrontUpdated}
            />
          )}

          {activeSection === 'mail' && (
            <MailSenderView token={session.token} onNotify={notify} />
          )}

          {activeSection === 'profile' && (
            <WebsiteProfileView
              token={session.token}
              onNotify={notify}
              onStorefrontUpdated={onStorefrontUpdated}
              onUploadImage={handleUploadImage}
              onDownloadBackup={handleDownloadBackup}
            />
          )}
        </main>
      </div>
    </div>
  );
};

export default AdminPortal;
