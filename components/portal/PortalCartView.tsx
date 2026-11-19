/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Check,
  Copy,
  Minus,
  Plus,
  ShoppingBag,
  Trash2,
} from 'lucide-react';
import type { CustomerProfile, Product, WebsiteSettings } from '../../types';
import type { PortalCartData } from './portalTypes';

interface PortalCartViewProps {
  token: string;
  customer: CustomerProfile;
  cart: PortalCartData;
  websiteSettings: WebsiteSettings;
  buyNowProduct: Product | null;
  onClearBuyNow: () => void;
  onCartUpdated: (nextCart: PortalCartData) => void;
  onOrderBooked: (orderNumber: string) => void;
  onBrowseShop: () => void;
  onNotify: (type: 'success' | 'error', message: string) => void;
}

const PortalCartView: React.FC<PortalCartViewProps> = ({
  token,
  customer,
  cart,
  websiteSettings,
  buyNowProduct,
  onClearBuyNow,
  onCartUpdated,
  onOrderBooked,
  onBrowseShop,
  onNotify,
}) => {
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [checkoutMode, setCheckoutMode] = useState<'cart' | 'buy_now' | null>(
    buyNowProduct ? 'buy_now' : null
  );
  const [buyNowQty, setBuyNowQty] = useState(1);

  const [phone, setPhone] = useState(customer.phone || '');
  const [shippingAddress, setShippingAddress] = useState(customer.address || '');
  const [transactionId, setTransactionId] = useState('');
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [upiCopied, setUpiCopied] = useState(false);

  useEffect(() => {
    if (buyNowProduct) {
      setCheckoutMode('buy_now');
      setBuyNowQty(1);
    }
  }, [buyNowProduct]);

  useEffect(() => {
    setPhone((prev) => prev || customer.phone || '');
    setShippingAddress((prev) => prev || customer.address || '');
  }, [customer.phone, customer.address]);

  const handleSetQuantity = async (productId: string, nextQty: number) => {
    setUpdatingId(productId);
    try {
      const resp = await fetch(
        `/api/customer/cart/${encodeURIComponent(productId)}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ quantity: nextQty }),
        }
      );
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.error || 'Failed to update quantity.');
      onCartUpdated(data);
    } catch (err: any) {
      onNotify('error', err?.message || 'Unable to update cart quantity.');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleRemoveItem = async (productId: string) => {
    setUpdatingId(productId);
    try {
      const resp = await fetch(
        `/api/customer/cart/${encodeURIComponent(productId)}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.error || 'Failed to remove item.');
      onCartUpdated(data);
      onNotify('success', 'Product removed from cart.');
    } catch (err: any) {
      onNotify('error', err?.message || 'Unable to remove item.');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleClearCart = async () => {
    setClearing(true);
    try {
      const resp = await fetch('/api/customer/cart', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.error || 'Failed to clear cart.');
      onCartUpdated(data);
      onNotify('success', 'Cart cleared.');
    } catch (err: any) {
      onNotify('error', err?.message || 'Unable to clear cart.');
    } finally {
      setClearing(false);
    }
  };

  const handleCopyUpi = async () => {
    if (!websiteSettings.upiId) return;
    try {
      await navigator.clipboard.writeText(websiteSettings.upiId);
      setUpiCopied(true);
      setTimeout(() => setUpiCopied(false), 2000);
    } catch {
      // Clipboard unavailable in restricted browser context
    }
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim() || phone.replace(/\D/g, '').length < 7) {
      onNotify('error', 'Please enter a valid phone number.');
      return;
    }
    if (!shippingAddress.trim()) {
      onNotify('error', 'Please enter a complete shipping address.');
      return;
    }
    if (transactionId.trim().length < 6) {
      onNotify('error', 'UPI Transaction ID is compulsory (minimum 6 characters).');
      return;
    }

    setSubmittingOrder(true);
    try {
      const isBuyNow = checkoutMode === 'buy_now' && buyNowProduct;
      const resp = await fetch('/api/customer/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          phone: phone.trim(),
          shippingAddress: shippingAddress.trim(),
          transactionId: transactionId.trim(),
          fromCart: !isBuyNow,
          items: isBuyNow
            ? [{ id: buyNowProduct.id, quantity: buyNowQty }]
            : undefined,
        }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(data.error || 'Could not place order.');
      }

      if (!isBuyNow) {
        onCartUpdated({ items: [], subtotal: 0, totalCount: 0 });
      }
      onClearBuyNow();
      setCheckoutMode(null);
      setTransactionId('');
      onNotify(
        'success',
        `Order #${data.order.orderNumber} placed. Confirmation email processed.`
      );
      onOrderBooked(data.order.orderNumber);
    } catch (err: any) {
      onNotify('error', err?.message || 'Failed to confirm order.');
    } finally {
      setSubmittingOrder(false);
    }
  };

  if (checkoutMode) {
    const isBuyNow = checkoutMode === 'buy_now' && buyNowProduct;
    const lineItems = isBuyNow
      ? [
          {
            id: buyNowProduct.id,
            name: buyNowProduct.name,
            imageUrl: buyNowProduct.imageUrl,
            price: buyNowProduct.price,
            quantity: buyNowQty,
          },
        ]
      : cart.items.map((item) => ({
          id: item.productId,
          name: item.product.name,
          imageUrl: item.product.imageUrl,
          price: item.product.price,
          quantity: item.quantity,
        }));

    const checkoutTotal = lineItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => {
              onClearBuyNow();
              setCheckoutMode(null);
            }}
            className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-[#525252] hover:text-[#0A0A0A]"
          >
            <ArrowLeft className="w-4 h-4" />
            {isBuyNow ? 'Back to Cart' : 'Edit Cart Items'}
          </button>
          <span className="text-xs font-mono tabular-nums text-[#737373]">
            Total Payable: ₹{checkoutTotal}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <form
            onSubmit={handlePlaceOrder}
            className="lg:col-span-7 bg-white border border-[#E5E5E5] p-6 space-y-6"
          >
            <div>
              <h2 className="text-lg font-semibold text-[#0A0A0A]">
                {isBuyNow ? 'Instant Checkout' : 'Cart Checkout'}
              </h2>
              <p className="text-xs text-[#737373] mt-1">
                Confirm your delivery information and submit your UPI Transaction ID.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs border-y border-[#E5E5E5] py-4 bg-[#FAFAFA] px-4">
              <div>
                <span className="block text-[11px] uppercase tracking-wider text-[#737373]">
                  Customer Name
                </span>
                <span className="font-medium text-[#0A0A0A]">{customer.name}</span>
              </div>
              <div>
                <span className="block text-[11px] uppercase tracking-wider text-[#737373]">
                  Order Email
                </span>
                <span className="font-medium text-[#0A0A0A]">{customer.email}</span>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="portal-checkout-phone"
                  className="block text-xs font-medium uppercase tracking-wider text-[#525252] mb-1.5"
                >
                  Phone Number *
                </label>
                <input
                  id="portal-checkout-phone"
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full px-3.5 py-2.5 border border-[#D4D4D4] text-sm text-[#0A0A0A] tabular-nums focus:outline-none focus:border-[#0A0A0A]"
                />
              </div>

              <div>
                <label
                  htmlFor="portal-checkout-address"
                  className="block text-xs font-medium uppercase tracking-wider text-[#525252] mb-1.5"
                >
                  Full Shipping Address *
                </label>
                <textarea
                  id="portal-checkout-address"
                  rows={3}
                  required
                  value={shippingAddress}
                  onChange={(e) => setShippingAddress(e.target.value)}
                  placeholder="House / Flat No., Street, Landmark, City, Postal Code"
                  className="w-full px-3.5 py-2.5 border border-[#D4D4D4] text-sm text-[#0A0A0A] focus:outline-none focus:border-[#0A0A0A]"
                />
              </div>
            </div>

            {/* Live Admin UPI Payment Box */}
            <div className="border border-[#D4D4D4] bg-[#FAFAFA] p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#E5E5E5]">
                <div>
                  <span className="block text-[11px] uppercase tracking-wider text-[#737373]">
                    Pay via UPI ID
                  </span>
                  <div className="text-base font-mono font-semibold text-[#0A0A0A] mt-0.5 select-all">
                    {websiteSettings.upiId}
                  </div>
                  <span className="text-xs text-[#525252]">
                    Receiver: {websiteSettings.upiReceiverName}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyUpi}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-[#D4D4D4] bg-white text-xs font-medium uppercase tracking-wider text-[#0A0A0A] hover:border-[#0A0A0A] self-start sm:self-auto"
                >
                  {upiCopied ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copy UPI ID
                    </>
                  )}
                </button>
              </div>

              <div>
                <label
                  htmlFor="portal-checkout-txn"
                  className="block text-xs font-medium uppercase tracking-wider text-[#525252] mb-1.5"
                >
                  UPI Transaction ID (Compulsory) *
                </label>
                <input
                  id="portal-checkout-txn"
                  type="text"
                  required
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value)}
                  placeholder="Enter 12-digit UTR / UPI Transaction ID"
                  className="w-full px-3.5 py-2.5 border border-[#D4D4D4] bg-white text-sm font-mono text-[#0A0A0A] focus:outline-none focus:border-[#0A0A0A]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submittingOrder || lineItems.length === 0}
              className="w-full py-3.5 bg-[#0A0A0A] text-white text-xs font-medium uppercase tracking-widest hover:bg-[#262626] transition-colors disabled:opacity-50"
            >
              {submittingOrder
                ? 'Confirming Order...'
                : `Confirm & Book Order — ₹${checkoutTotal}`}
            </button>
          </form>

          {/* Checkout Summary */}
          <div className="lg:col-span-5 bg-white border border-[#E5E5E5] p-6 space-y-5">
            <h3 className="text-sm font-semibold text-[#0A0A0A]">Order Summary</h3>

            <div className="divide-y divide-[#E5E5E5]">
              {lineItems.map((item) => (
                <div key={item.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      referrerPolicy="no-referrer"
                      className="w-12 h-12 object-cover bg-[#F5F5F5] border border-[#E5E5E5] shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-[#0A0A0A] truncate">
                        {item.name}
                      </p>
                      <p className="text-[11px] text-[#737373] font-mono tabular-nums">
                        ₹{item.price} × {item.quantity}
                      </p>
                      {isBuyNow && (
                        <div className="flex items-center gap-2 mt-1.5">
                          <button
                            type="button"
                            onClick={() => setBuyNowQty((q) => Math.max(1, q - 1))}
                            className="w-6 h-6 border border-[#D4D4D4] flex items-center justify-center hover:border-[#0A0A0A]"
                            aria-label="Decrease quantity"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="text-xs font-mono tabular-nums w-4 text-center">
                            {buyNowQty}
                          </span>
                          <button
                            type="button"
                            onClick={() => setBuyNowQty((q) => q + 1)}
                            className="w-6 h-6 border border-[#D4D4D4] flex items-center justify-center hover:border-[#0A0A0A]"
                            aria-label="Increase quantity"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <span className="text-xs font-mono font-medium tabular-nums text-[#0A0A0A] shrink-0">
                    ₹{item.price * item.quantity}
                  </span>
                </div>
              ))}
            </div>

            <div className="border-t border-[#E5E5E5] pt-4 space-y-2 text-xs">
              <div className="flex justify-between text-[#525252]">
                <span>Subtotal</span>
                <span className="font-mono tabular-nums">₹{checkoutTotal}</span>
              </div>
              <div className="flex justify-between text-[#525252]">
                <span>Shipping</span>
                <span>Free</span>
              </div>
              <div className="flex justify-between text-sm font-semibold text-[#0A0A0A] pt-2 border-t border-[#E5E5E5]">
                <span>Total Amount</span>
                <span className="font-mono tabular-nums">₹{checkoutTotal}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[#0A0A0A]">Shopping Cart</h2>
          <p className="text-xs text-[#737373]">
            Cart items are saved to your account and sync live product pricing.
          </p>
        </div>

        {cart.items.length > 0 && (
          <button
            type="button"
            disabled={clearing}
            onClick={handleClearCart}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-[#D4D4D4] text-xs font-medium uppercase tracking-wider text-[#525252] hover:text-[#DC2626] hover:border-[#DC2626] transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {clearing ? 'Clearing...' : 'Clear Cart'}
          </button>
        )}
      </div>

      {cart.items.length === 0 ? (
        <div className="bg-white border border-[#E5E5E5] p-12 text-center">
          <ShoppingBag className="w-8 h-8 text-[#A3A3A3] mx-auto mb-3 stroke-[1.5]" />
          <p className="text-sm font-medium text-[#0A0A0A] mb-1">Your cart is empty</p>
          <p className="text-xs text-[#737373] mb-5">
            Add products from the Home Page to save them here.
          </p>
          <button
            type="button"
            onClick={onBrowseShop}
            className="px-5 py-2.5 bg-[#0A0A0A] text-white text-xs font-medium uppercase tracking-wider hover:bg-[#262626]"
          >
            Browse Products
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Cart Item List */}
          <div className="lg:col-span-8 bg-white border border-[#E5E5E5] divide-y divide-[#E5E5E5]">
            {cart.items.map((item) => {
              const busy = updatingId === item.productId;
              const isOutOfStock = item.product.availability === 'Out of Stock';

              return (
                <div
                  key={item.id}
                  className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <img
                      src={item.product.imageUrl}
                      alt={item.product.name}
                      referrerPolicy="no-referrer"
                      className="w-20 h-20 object-cover bg-[#F5F5F5] border border-[#E5E5E5] shrink-0"
                    />
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-[#0A0A0A] truncate">
                        {item.product.name}
                      </h3>
                      <p className="text-xs text-[#737373] mt-0.5">
                        {item.product.category}
                        {isOutOfStock && (
                          <span className="text-[#DC2626] font-medium"> · Out of Stock</span>
                        )}
                      </p>
                      <p className="text-xs font-mono tabular-nums text-[#525252] mt-1">
                        Unit Price: ₹{item.product.price}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-6 shrink-0">
                    <div className="flex items-center border border-[#D4D4D4]">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          handleSetQuantity(item.productId, item.quantity - 1)
                        }
                        aria-label={`Decrease quantity for ${item.product.name}`}
                        className="w-8 h-8 flex items-center justify-center text-[#0A0A0A] hover:bg-[#F5F5F5] disabled:opacity-40"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-10 text-center text-xs font-mono tabular-nums font-medium">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        disabled={busy || isOutOfStock}
                        onClick={() =>
                          handleSetQuantity(item.productId, item.quantity + 1)
                        }
                        aria-label={`Increase quantity for ${item.product.name}`}
                        className="w-8 h-8 flex items-center justify-center text-[#0A0A0A] hover:bg-[#F5F5F5] disabled:opacity-40"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="text-right min-w-[76px]">
                      <div className="text-sm font-mono font-semibold tabular-nums text-[#0A0A0A]">
                        ₹{item.lineTotal}
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleRemoveItem(item.productId)}
                      aria-label={`Remove ${item.product.name}`}
                      className="p-2 text-[#737373] hover:text-[#DC2626] transition-colors disabled:opacity-40"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Summary Panel */}
          <div className="lg:col-span-4 bg-white border border-[#E5E5E5] p-6 space-y-5">
            <h3 className="text-sm font-semibold text-[#0A0A0A]">Cart Summary</h3>
            <div className="space-y-3 text-xs border-b border-[#E5E5E5] pb-4">
              <div className="flex justify-between text-[#525252]">
                <span>Items</span>
                <span className="font-mono tabular-nums">{cart.totalCount}</span>
              </div>
              <div className="flex justify-between text-[#525252]">
                <span>Subtotal</span>
                <span className="font-mono tabular-nums">₹{cart.subtotal}</span>
              </div>
              <div className="flex justify-between text-[#525252]">
                <span>Shipping</span>
                <span>Free</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-[#0A0A0A]">Total Amount</span>
              <span className="text-lg font-mono font-semibold tabular-nums text-[#0A0A0A]">
                ₹{cart.subtotal}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setCheckoutMode('cart')}
              disabled={cart.items.some((i) => i.product.availability === 'Out of Stock')}
              className="w-full py-3 bg-[#0A0A0A] text-white text-xs font-medium uppercase tracking-widest hover:bg-[#262626] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Proceed to Checkout
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PortalCartView;
