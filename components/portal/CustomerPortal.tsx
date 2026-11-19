/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { signOut } from 'firebase/auth';
import {
  Home,
  LogIn,
  LogOut,
  Menu,
  PackageCheck,
  ShoppingBag,
  User,
  X,
} from 'lucide-react';
import { auth } from '../../src/lib/firebase';
import type { CustomerProfile, Product, WebsiteSettings } from '../../types';
import Footer from '../Footer';
import Assistant from '../Assistant';
import CustomerAuthView from './CustomerAuthView';
import PortalHomeView from './PortalHomeView';
import PortalCartView from './PortalCartView';
import PortalOrdersView from './PortalOrdersView';
import PortalProfileView from './PortalProfileView';
import type {
  CustomerSession,
  PortalCartData,
  PortalSection,
} from './portalTypes';

const CUSTOMER_TOKEN_KEY = 'aura_customer_session_token';

interface CustomerPortalProps {
  products: Product[];
  websiteSettings: WebsiteSettings;
  onRefreshStorefront: () => Promise<void>;
  onOpenAdmin: () => void;
}

const NAV_ITEMS: Array<{
  id: PortalSection;
  label: string;
  icon: React.FC<{ className?: string }>;
}> = [
  { id: 'home', label: 'Home Page', icon: Home },
  { id: 'cart', label: 'Cart', icon: ShoppingBag },
  { id: 'orders', label: 'Orders You Booked', icon: PackageCheck },
  { id: 'profile', label: 'Profile', icon: User },
];

const EMPTY_CART: PortalCartData = { items: [], subtotal: 0, totalCount: 0 };

const CustomerPortal: React.FC<CustomerPortalProps> = ({
  products,
  websiteSettings,
  onRefreshStorefront,
  onOpenAdmin,
}) => {
  const [session, setSession] = useState<CustomerSession | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState<'login' | 'register' | null>(null);
  const [pendingAction, setPendingAction] = useState<
    | { type: 'section'; section: PortalSection }
    | { type: 'add_to_cart'; product: Product }
    | { type: 'buy_now'; product: Product }
    | null
  >(null);

  const [activeSection, setActiveSection] = useState<PortalSection>('home');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [cart, setCart] = useState<PortalCartData>(EMPTY_CART);
  const [addingProductId, setAddingProductId] = useState<string | null>(null);
  const [buyNowProduct, setBuyNowProduct] = useState<Product | null>(null);
  const [highlightedOrderNumber, setHighlightedOrderNumber] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  const notify = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  const loadCart = useCallback(async (token: string) => {
    try {
      const resp = await fetch('/api/customer/cart', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) return;
      const data = await resp.json();
      setCart(data);
    } catch {
      // Preserve last loaded cart on transient failure
    }
  }, []);

  useEffect(() => {
    let active = true;
    const bootstrap = async () => {
      await onRefreshStorefront();
      try {
        const storedToken = localStorage.getItem(CUSTOMER_TOKEN_KEY);
        if (!storedToken) {
          if (active) setCheckingSession(false);
          return;
        }
        const resp = await fetch('/api/customer/auth/me', {
          headers: { Authorization: `Bearer ${storedToken}` },
        });
        if (!resp.ok) {
          localStorage.removeItem(CUSTOMER_TOKEN_KEY);
          if (active) setCheckingSession(false);
          return;
        }
        const data = await resp.json();
        if (active) {
          setSession({ token: storedToken, customer: data.customer });
          await loadCart(storedToken);
          setCheckingSession(false);
        }
      } catch {
        if (active) setCheckingSession(false);
      }
    };
    bootstrap();
    return () => {
      active = false;
    };
  }, [loadCart, onRefreshStorefront]);

  const addItemWithToken = useCallback(
    async (token: string, product: Product) => {
      setAddingProductId(product.id);
      try {
        const resp = await fetch('/api/customer/cart', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ productId: product.id, quantity: 1 }),
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) throw new Error(data.error || 'Could not add product to cart.');
        setCart(data);
        notify('success', `${product.name} added to your cart.`);
      } catch (err: any) {
        notify('error', err?.message || 'Unable to add item to cart.');
      } finally {
        setAddingProductId(null);
      }
    },
    [notify]
  );

  const handleAuthenticated = async (nextSession: CustomerSession) => {
    try {
      localStorage.setItem(CUSTOMER_TOKEN_KEY, nextSession.token);
    } catch {
      // Ignore storage errors in restricted environments
    }
    setSession(nextSession);
    setShowAuthModal(null);
    await loadCart(nextSession.token);

    if (pendingAction) {
      const action = pendingAction;
      setPendingAction(null);
      if (action.type === 'section') {
        setActiveSection(action.section);
      } else if (action.type === 'add_to_cart') {
        await addItemWithToken(nextSession.token, action.product);
      } else if (action.type === 'buy_now') {
        setBuyNowProduct(action.product);
        setActiveSection('cart');
      }
    } else {
      setActiveSection('home');
    }
  };

  const handleLogout = async () => {
    if (session?.token) {
      try {
        await fetch('/api/customer/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.token}` },
        });
      } catch {
        // Ignore network failure during logout
      }
    }
    try {
      await signOut(auth);
    } catch {
      // Ignore Firebase client sign-out errors if user logged in via password
    }
    try {
      localStorage.removeItem(CUSTOMER_TOKEN_KEY);
    } catch {
      // Ignore storage failure
    }
    setSession(null);
    setCart(EMPTY_CART);
    setBuyNowProduct(null);
    setActiveSection('home');
    setMobileSidebarOpen(false);
    notify('success', 'You have logged out securely.');
  };

  const handleSectionSelect = async (section: PortalSection) => {
    setMobileSidebarOpen(false);
    await onRefreshStorefront();
    if (section !== 'home' && !session) {
      setPendingAction({ type: 'section', section });
      setShowAuthModal('login');
      return;
    }
    if (section === 'cart' && session) {
      await loadCart(session.token);
    }
    if (section !== 'cart') {
      setBuyNowProduct(null);
    }
    setActiveSection(section);
  };

  const handleAddToCartClick = async (product: Product) => {
    if (!session) {
      setPendingAction({ type: 'add_to_cart', product });
      setShowAuthModal('login');
      return;
    }
    await addItemWithToken(session.token, product);
  };

  const handleBuyNowClick = (product: Product) => {
    if (!session) {
      setPendingAction({ type: 'buy_now', product });
      setShowAuthModal('login');
      return;
    }
    setBuyNowProduct(product);
    setActiveSection('cart');
  };

  const handleProfileUpdated = (nextCustomer: CustomerProfile) => {
    setSession((prev) => (prev ? { ...prev, customer: nextCustomer } : null));
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center">
        <div className="text-xs uppercase tracking-widest text-[#737373]">
          Loading Customer Portal...
        </div>
      </div>
    );
  }

  if (showAuthModal) {
    return (
      <CustomerAuthView
        websiteName={websiteSettings.websiteName}
        logoUrl={websiteSettings.logoUrl}
        initialMode={showAuthModal}
        onAuthenticated={handleAuthenticated}
        onBrowseHome={() => {
          setPendingAction(null);
          setShowAuthModal(null);
          setActiveSection('home');
        }}
      />
    );
  }

  const activeLabel =
    NAV_ITEMS.find((item) => item.id === activeSection)?.label || 'Home Page';

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#0A0A0A] flex">
      {/* Mobile Sidebar Backdrop */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Black Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-[#0A0A0A] text-white flex flex-col justify-between transition-transform duration-200 shrink-0 ${
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div>
          {/* Top Website Logo & Website Name */}
          <div className="h-16 px-6 border-b border-white/10 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              {websiteSettings.logoUrl && (
                <img
                  src={websiteSettings.logoUrl}
                  alt={websiteSettings.websiteName}
                  referrerPolicy="no-referrer"
                  className="h-6 w-auto max-w-[80px] object-contain bg-white/95 p-0.5 shrink-0"
                />
              )}
              <span className="font-semibold tracking-tight text-sm truncate">
                {websiteSettings.websiteName}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(false)}
              aria-label="Close sidebar"
              className="lg:hidden p-1 text-white/70 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* 5 Sidebar Options */}
          <nav className="p-4 space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSectionSelect(item.id)}
                  className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 text-xs font-medium tracking-wide transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-white text-[#0A0A0A]'
                      : 'text-white/75 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </span>
                  {item.id === 'cart' && cart.totalCount > 0 && (
                    <span
                      className={`text-[11px] font-mono tabular-nums ${
                        isActive ? 'text-[#0A0A0A]' : 'text-white/80'
                      }`}
                    >
                      {cart.totalCount}
                    </span>
                  )}
                </button>
              );
            })}

            <div className="pt-4 mt-4 border-t border-white/10">
              {session ? (
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 text-xs font-medium tracking-wide text-white/75 hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap"
                >
                  <LogOut className="w-4 h-4 shrink-0" />
                  <span>Logout</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setMobileSidebarOpen(false);
                    setShowAuthModal('login');
                  }}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 text-xs font-medium tracking-wide text-white/75 hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap"
                >
                  <LogIn className="w-4 h-4 shrink-0" />
                  <span>Sign In / Register</span>
                </button>
              )}
            </div>
          </nav>
        </div>

        {/* Bottom Customer Identity */}
        <div className="p-5 border-t border-white/10 text-xs">
          {session ? (
            <button
              type="button"
              onClick={() => handleSectionSelect('profile')}
              className="w-full flex items-center gap-3 text-left hover:opacity-90 transition-opacity"
            >
              <div className="w-9 h-9 rounded-full bg-white/15 border border-white/20 overflow-hidden flex items-center justify-center shrink-0">
                {session.customer.profilePictureUrl ? (
                  <img
                    src={session.customer.profilePictureUrl}
                    alt={session.customer.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-4 h-4 text-white/80" />
                )}
              </div>
              <div className="min-w-0">
                <div className="font-medium text-white truncate">
                  {session.customer.name}
                </div>
                <div className="text-white/60 truncate mt-0.5">
                  {session.customer.email}
                </div>
              </div>
            </button>
          ) : (
            <div className="space-y-2">
              <div className="text-white/70">Guest Visitor</div>
              <button
                type="button"
                onClick={() => {
                  setMobileSidebarOpen(false);
                  setShowAuthModal('login');
                }}
                className="w-full py-2 bg-white text-[#0A0A0A] text-[11px] font-medium uppercase tracking-wider hover:bg-[#E5E5E5]"
              >
                Sign In
              </button>
            </div>
          )}
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
            {activeSection === 'home' ? (
              <div className="inline-flex items-center gap-2 text-base font-semibold tracking-tight text-[#0A0A0A] shrink-0">
                {websiteSettings.logoUrl && (
                  <img
                    src={websiteSettings.logoUrl}
                    alt={websiteSettings.websiteName}
                    referrerPolicy="no-referrer"
                    className="h-5 w-auto max-w-[80px] object-contain shrink-0"
                  />
                )}
                <span>{websiteSettings.websiteName}</span>
              </div>
            ) : (
              <div className="text-sm font-medium text-[#0A0A0A] truncate">
                <span>{activeLabel}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {!session && (
              <>
                <button
                  type="button"
                  onClick={() => setShowAuthModal('login')}
                  className="px-3.5 py-2 bg-[#0A0A0A] text-white text-xs font-medium uppercase tracking-wider hover:bg-[#262626] whitespace-nowrap"
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => setShowAuthModal('register')}
                  className="px-3.5 py-2 border border-[#D4D4D4] text-xs font-medium uppercase tracking-wider text-[#0A0A0A] hover:border-[#0A0A0A] whitespace-nowrap"
                >
                  Create Account
                </button>
              </>
            )}
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

        {/* Active Section */}
        <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto">
          {activeSection === 'home' && (
            <PortalHomeView
              products={products}
              websiteSettings={websiteSettings}
              addingProductId={addingProductId}
              selectedCategory={selectedCategory}
              onCategoryChange={setSelectedCategory}
              onAddToCart={handleAddToCartClick}
              onBuyNow={handleBuyNowClick}
            />
          )}

          {activeSection === 'cart' && session && (
            <PortalCartView
              token={session.token}
              customer={session.customer}
              cart={cart}
              websiteSettings={websiteSettings}
              buyNowProduct={buyNowProduct}
              onClearBuyNow={() => setBuyNowProduct(null)}
              onCartUpdated={setCart}
              onOrderBooked={(orderNum) => {
                setHighlightedOrderNumber(orderNum);
                setActiveSection('orders');
              }}
              onBrowseShop={() => setActiveSection('home')}
              onNotify={notify}
            />
          )}

          {activeSection === 'orders' && session && (
            <PortalOrdersView
              token={session.token}
              highlightedOrderNumber={highlightedOrderNumber}
              onBrowseShop={() => setActiveSection('home')}
              onNotify={notify}
            />
          )}

          {activeSection === 'profile' && session && (
            <PortalProfileView
              token={session.token}
              customer={session.customer}
              onProfileUpdated={handleProfileUpdated}
              onNotify={notify}
            />
          )}
        </main>

        {activeSection === 'home' && (
          <Footer
            websiteName={websiteSettings.websiteName}
            logoUrl={websiteSettings.logoUrl}
            onOpenAdmin={onOpenAdmin}
            onCategorySelect={(category) => {
              setSelectedCategory(category);
              const el = document.getElementById('portal-catalog-grid');
              if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }
            }}
            onLinkClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}
      </div>

      {activeSection === 'home' && <Assistant />}
    </div>
  );
};

export default CustomerPortal;
