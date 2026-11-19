/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import AdminPortal from './components/admin/AdminPortal';
import CustomerPortal from './components/portal/CustomerPortal';
import { PRODUCTS } from './constants';
import { Product, WebsiteSettings } from './types';

const DEFAULT_WEBSITE_SETTINGS: WebsiteSettings = {
  websiteName: 'Aura',
  logoUrl: null,
  heroBackgroundUrl:
    'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&q=80&w=2000',
  contactEmail: 'concierge@auraquietliving.com',
  contactPhone: '+91 92903 17064',
  contactAddress: 'Bengaluru, India',
  upiId: '9290317064@fam',
  upiReceiverName: 'Aura Quiet Living',
};

function App() {
  const [mode, setMode] = useState<'home' | 'admin'>(() => {
    if (typeof window !== 'undefined' && window.location.hash === '#admin') {
      return 'admin';
    }
    return 'home';
  });

  const [products, setProducts] = useState<Product[]>(PRODUCTS);
  const [websiteSettings, setWebsiteSettings] = useState<WebsiteSettings>(
    DEFAULT_WEBSITE_SETTINGS
  );

  const fetchStorefront = useCallback(async () => {
    try {
      const response = await fetch('/api/storefront', { cache: 'no-store' });
      if (!response.ok) return;
      const data = await response.json();
      if (Array.isArray(data.products)) {
        setProducts(data.products);
      }
      if (data.websiteSettings) {
        setWebsiteSettings((prev) => ({
          ...prev,
          ...data.websiteSettings,
        }));
      }
    } catch {
      // Preserve loaded catalog when offline or during transient reload
    }
  }, []);

  useEffect(() => {
    fetchStorefront();
  }, [fetchStorefront]);

  useEffect(() => {
    const onHashChange = () => {
      window.scrollTo({ top: 0, behavior: 'auto' });
      if (window.location.hash === '#admin') {
        setMode('admin');
      } else {
        setMode('home');
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    if (websiteSettings.websiteName) {
      document.title = `${websiteSettings.websiteName} — Quiet Living`;
    }
  }, [websiteSettings.websiteName]);

  const openAdmin = () => {
    window.scrollTo({ top: 0, behavior: 'auto' });
    try {
      window.history.pushState(null, '', '#admin');
    } catch {
      // Ignore SecurityError in restricted environments
    }
    setMode('admin');
  };

  const handleBackFromAdmin = () => {
    fetchStorefront();
    window.scrollTo({ top: 0, behavior: 'auto' });
    try {
      window.history.replaceState(null, '', '#');
    } catch {
      // Ignore SecurityError in restricted environments
    }
    setMode('home');
  };

  if (mode === 'admin') {
    return (
      <AdminPortal
        websiteName={websiteSettings.websiteName}
        logoUrl={websiteSettings.logoUrl}
        onBackToStore={handleBackFromAdmin}
        onStorefrontUpdated={fetchStorefront}
      />
    );
  }

  return (
    <CustomerPortal
      products={products}
      websiteSettings={websiteSettings}
      onRefreshStorefront={fetchStorefront}
      onOpenAdmin={openAdmin}
    />
  );
}

export default App;
