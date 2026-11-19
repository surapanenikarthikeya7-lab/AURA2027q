/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Product } from '../types';

interface CheckoutProps {
  items: Product[];
  upiId: string;
  upiReceiverName: string;
  onBack: () => void;
  onOrderComplete: () => void;
}

interface OrderSummaryItem {
  product: Product;
  quantity: number;
}

interface FormState {
  email: string;
  phone: string;
  newsletter: boolean;
  firstName: string;
  lastName: string;
  address: string;
  apartment: string;
  city: string;
  postalCode: string;
  transactionId: string;
}

interface EmailNotification {
  status: 'sent' | 'preview';
  to: string;
  subject: string;
  body: string;
}

interface ConfirmedOrderState {
  orderNumber: string;
  status: 'confirmed' | 'cancelled';
  orderStatus: string;
  paymentStatus: string;
  items: OrderSummaryItem[];
  total: number;
  email: string;
  phone: string;
  recipient: string;
  destination: string;
  upiId: string;
  transactionId: string;
  emailNotification: EmailNotification;
}

const Checkout: React.FC<CheckoutProps> = ({
  items,
  upiId,
  upiReceiverName,
  onBack,
  onOrderComplete,
}) => {
  const [form, setForm] = useState<FormState>({
    email: '',
    phone: '',
    newsletter: false,
    firstName: '',
    lastName: '',
    address: '',
    apartment: '',
    city: '',
    postalCode: '',
    transactionId: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [upiCopied, setUpiCopied] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState<ConfirmedOrderState | null>(null);

  const groupedItems = useMemo<OrderSummaryItem[]>(() => {
    const map = new Map<string, OrderSummaryItem>();
    for (const item of items) {
      const existing = map.get(item.id);
      if (existing) {
        existing.quantity += 1;
      } else {
        map.set(item.id, { product: item, quantity: 1 });
      }
    }
    return Array.from(map.values());
  }, [items]);

  const subtotal = items.reduce((sum, item) => sum + item.price, 0);
  const shipping = 0;
  const total = subtotal + shipping;

  const updateField = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
    if (submitError) {
      setSubmitError(null);
    }
  };

  const handleCopyUpi = async () => {
    if (!upiId) return;
    try {
      await navigator.clipboard.writeText(upiId);
      setUpiCopied(true);
      setTimeout(() => setUpiCopied(false), 2000);
    } catch {
      // Clipboard API unavailable in restricted contexts
    }
  };

  const validate = (): boolean => {
    const nextErrors: Partial<Record<keyof FormState, string>> = {};
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      nextErrors.email = 'Please enter a valid email address.';
    }
    if (!form.phone.trim() || form.phone.replace(/\D/g, '').length < 7) {
      nextErrors.phone = 'Please enter a valid phone number.';
    }
    if (!form.firstName.trim()) nextErrors.firstName = 'First name is required.';
    if (!form.lastName.trim()) nextErrors.lastName = 'Last name is required.';
    if (!form.address.trim()) nextErrors.address = 'Street address is required.';
    if (!form.city.trim()) nextErrors.city = 'City is required.';
    if (!form.postalCode.trim()) nextErrors.postalCode = 'Postal code is required.';

    const txn = form.transactionId.trim();
    if (!txn) {
      nextErrors.transactionId = 'Transaction ID is compulsory to place your order.';
    } else if (txn.length < 6) {
      nextErrors.transactionId = 'Please enter a valid Transaction ID (at least 6 characters).';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0 || isSubmitting) return;
    if (!validate()) return;

    setIsSubmitting(true);
    setSubmitError(null);

    const snapshotItems = groupedItems;
    const recipient = `${form.firstName.trim()} ${form.lastName.trim()}`;
    const destination = `${form.address.trim()}${form.apartment.trim() ? `, ${form.apartment.trim()}` : ''}, ${form.city.trim()} ${form.postalCode.trim()}`;

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email.trim(),
          phone: form.phone.trim(),
          recipient,
          destination,
          transactionId: form.transactionId.trim(),
          items: snapshotItems.map(({ product, quantity }) => ({
            id: product.id,
            name: product.name,
            price: product.price,
            quantity,
          })),
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Could not confirm your order.');
      }

      setConfirmedOrder({
        orderNumber: data.order.orderNumber,
        status: 'confirmed',
        orderStatus: data.order.orderStatus,
        paymentStatus: data.order.paymentStatus,
        items: snapshotItems,
        total: data.order.totalAmount,
        email: data.order.customerEmail,
        phone: data.order.customerPhone,
        recipient: data.order.customerName,
        destination: data.order.shippingAddress,
        upiId: data.order.upiId,
        transactionId: data.order.transactionReference,
        emailNotification: data.emailNotification,
      });
      onOrderComplete();
    } catch (err: any) {
      setSubmitError(err?.message || 'Unable to place order right now.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!confirmedOrder || confirmedOrder.status === 'cancelled' || isCancelling) return;
    setIsCancelling(true);
    setSubmitError(null);

    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(confirmedOrder.orderNumber)}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Could not cancel order.');
      }
      setConfirmedOrder((prev) =>
        prev
          ? {
              ...prev,
              status: 'cancelled',
              orderStatus: data.order?.orderStatus || 'Cancelled',
              paymentStatus: data.order?.paymentStatus || prev.paymentStatus,
              emailNotification: data.emailNotification,
            }
          : null
      );
    } catch (err: any) {
      setSubmitError(err?.message || 'Unable to cancel order right now.');
    } finally {
      setIsCancelling(false);
    }
  };

  if (confirmedOrder) {
    const isCancelled = confirmedOrder.status === 'cancelled';

    return (
      <div className="min-h-screen pt-24 pb-24 px-6 bg-[#F5F2EB] animate-fade-in-up">
        <div className="max-w-2xl mx-auto bg-white/60 border border-[#D6D1C7] p-8 md:p-14">
          <span className="block text-xs font-medium uppercase tracking-[0.2em] text-[#A8A29E] mb-3">
            {isCancelled ? 'Order Cancellation' : 'Order Received'}
          </span>
          <h1 className="text-3xl md:text-4xl font-serif text-[#2C2A26] mb-3">
            {isCancelled
              ? `Order #${confirmedOrder.orderNumber} — Order has been cancelled`
              : `Order #${confirmedOrder.orderNumber} — Order is confirmed`}
          </h1>
          <p className="text-sm text-[#5D5A53] font-light leading-relaxed mb-8 pb-8 border-b border-[#D6D1C7]">
            {isCancelled
              ? `Your booking for ${confirmedOrder.recipient} has been cancelled.`
              : `Thank you, ${confirmedOrder.recipient}. Your payment reference has been submitted for verification (${confirmedOrder.paymentStatus}).`}
          </p>

          {/* Email Notification Status */}
          <div className="mb-8 p-5 border border-[#D6D1C7] bg-[#F5F2EB]">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <span className="text-xs font-medium uppercase tracking-widest text-[#2C2A26]">
                {confirmedOrder.emailNotification.status === 'sent'
                  ? 'Email Sent'
                  : 'Email Notification Prepared'}
              </span>
              <span className="text-xs text-[#5D5A53]">
                To: {confirmedOrder.emailNotification.to}
              </span>
            </div>
            <p className="text-sm font-medium text-[#2C2A26] mb-2">
              {confirmedOrder.emailNotification.subject}
            </p>
            <p className="text-xs text-[#5D5A53] whitespace-pre-line leading-relaxed border-t border-[#D6D1C7]/70 pt-3">
              {confirmedOrder.emailNotification.body}
            </p>
            {confirmedOrder.emailNotification.status === 'preview' && (
              <p className="text-[11px] text-[#A8A29E] mt-3">
                Configure SMTP or Resend credentials in Admin Mail Sender settings to deliver this email live.
              </p>
            )}
          </div>

          <div className="space-y-6 mb-8 pb-8 border-b border-[#D6D1C7]">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <span className="block text-xs uppercase tracking-widest text-[#A8A29E] mb-1">UPI ID</span>
                <p className="text-sm text-[#2C2A26] tabular-nums">{confirmedOrder.upiId}</p>
              </div>
              <div>
                <span className="block text-xs uppercase tracking-widest text-[#A8A29E] mb-1">Transaction ID</span>
                <p className="text-sm text-[#2C2A26] tabular-nums">{confirmedOrder.transactionId}</p>
              </div>
              <div>
                <span className="block text-xs uppercase tracking-widest text-[#A8A29E] mb-1">Payment Status</span>
                <p className="text-sm text-[#2C2A26]">{confirmedOrder.paymentStatus}</p>
              </div>
              <div>
                <span className="block text-xs uppercase tracking-widest text-[#A8A29E] mb-1">Phone</span>
                <p className="text-sm text-[#2C2A26] tabular-nums">{confirmedOrder.phone}</p>
              </div>
            </div>

            <div>
              <span className="block text-xs uppercase tracking-widest text-[#A8A29E] mb-1">Shipping To</span>
              <p className="text-sm text-[#2C2A26]">{confirmedOrder.destination}</p>
            </div>

            <div className="space-y-4">
              <span className="block text-xs uppercase tracking-widest text-[#A8A29E]">Items</span>
              {confirmedOrder.items.map(({ product, quantity }) => (
                <div key={product.id} className="flex items-center justify-between gap-4 text-sm">
                  <div className="flex items-center gap-3">
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      referrerPolicy="no-referrer"
                      className="w-12 h-12 object-cover bg-[#EBE7DE]"
                    />
                    <div>
                      <p className="font-serif text-[#2C2A26]">{product.name}</p>
                      <p className="text-xs text-[#A8A29E] tabular-nums">Qty {quantity}</p>
                    </div>
                  </div>
                  <span className="text-[#2C2A26] tabular-nums">₹{product.price * quantity}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between mb-8">
            <span className="font-serif text-xl text-[#2C2A26]">
              {isCancelled ? 'Order Total (Cancelled)' : 'Total'}
            </span>
            <span className="font-serif text-2xl text-[#2C2A26] tabular-nums">₹{confirmedOrder.total} INR</span>
          </div>

          {submitError && (
            <p className="text-xs text-[#991B1B] mb-4">{submitError}</p>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            {!isCancelled && (
              <button
                type="button"
                onClick={handleCancelOrder}
                disabled={isCancelling}
                className="flex-1 py-4 border border-[#991B1B] text-[#991B1B] uppercase tracking-widest text-xs font-medium hover:bg-[#991B1B] hover:text-[#F5F2EB] transition-colors disabled:opacity-50"
              >
                {isCancelling ? 'Cancelling...' : 'Cancel Order'}
              </button>
            )}
            <button
              type="button"
              onClick={onBack}
              className="flex-1 py-4 bg-[#2C2A26] text-[#F5F2EB] uppercase tracking-widest text-xs font-medium hover:bg-[#433E38] transition-colors"
            >
              Continue Shopping
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-24 px-6 bg-[#F5F2EB] animate-fade-in-up">
      <div className="max-w-6xl mx-auto">
        <button 
          type="button"
          onClick={onBack}
          className="group flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-[#A8A29E] hover:text-[#2C2A26] transition-colors mb-12"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 group-hover:-translate-x-1 transition-transform">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Back to Shop
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24">
          
          {/* Left Column: Form */}
          <form onSubmit={handleSubmit} noValidate>
            <h1 className="text-3xl font-serif text-[#2C2A26] mb-3">Checkout</h1>
            <p className="text-sm text-[#5D5A53] mb-12">Complete your delivery details and UPI payment reference to book your order.</p>
            
            <div className="space-y-12">
              {/* Section 1: Contact */}
              <div>
                <h2 className="text-xl font-serif text-[#2C2A26] mb-6">Contact Information</h2>
                <div className="space-y-4">
                   <div>
                     <input
                       type="email"
                       value={form.email}
                       onChange={(e) => updateField('email', e.target.value)}
                       placeholder="Email address (for order confirmation)"
                       aria-label="Email address"
                       required
                       className="w-full bg-transparent border-b border-[#D6D1C7] py-3 text-[#2C2A26] placeholder-[#A8A29E] outline-none focus:border-[#2C2A26] transition-colors"
                     />
                     {errors.email && <p className="text-xs text-[#991B1B] mt-1.5">{errors.email}</p>}
                   </div>
                   <div>
                     <input
                       type="tel"
                       value={form.phone}
                       onChange={(e) => updateField('phone', e.target.value)}
                       placeholder="Phone number (e.g. +91 98765 43210)"
                       aria-label="Phone number"
                       required
                       className="w-full bg-transparent border-b border-[#D6D1C7] py-3 text-[#2C2A26] placeholder-[#A8A29E] outline-none focus:border-[#2C2A26] transition-colors tabular-nums"
                     />
                     {errors.phone && <p className="text-xs text-[#991B1B] mt-1.5">{errors.phone}</p>}
                   </div>
                   <div className="flex items-center gap-2">
                     <input
                       type="checkbox"
                       id="newsletter"
                       checked={form.newsletter}
                       onChange={(e) => updateField('newsletter', e.target.checked)}
                       className="accent-[#2C2A26] cursor-pointer"
                     />
                     <label htmlFor="newsletter" className="text-sm text-[#5D5A53] cursor-pointer">Email me with news and offers</label>
                   </div>
                </div>
              </div>

              {/* Section 2: Shipping */}
              <div>
                <h2 className="text-xl font-serif text-[#2C2A26] mb-6">Shipping Address</h2>
                <div className="space-y-4">
                   <div className="grid grid-cols-2 gap-4">
                      <div>
                        <input
                          type="text"
                          value={form.firstName}
                          onChange={(e) => updateField('firstName', e.target.value)}
                          placeholder="First name"
                          aria-label="First name"
                          required
                          className="w-full bg-transparent border-b border-[#D6D1C7] py-3 text-[#2C2A26] placeholder-[#A8A29E] outline-none focus:border-[#2C2A26] transition-colors"
                        />
                        {errors.firstName && <p className="text-xs text-[#991B1B] mt-1.5">{errors.firstName}</p>}
                      </div>
                      <div>
                        <input
                          type="text"
                          value={form.lastName}
                          onChange={(e) => updateField('lastName', e.target.value)}
                          placeholder="Last name"
                          aria-label="Last name"
                          required
                          className="w-full bg-transparent border-b border-[#D6D1C7] py-3 text-[#2C2A26] placeholder-[#A8A29E] outline-none focus:border-[#2C2A26] transition-colors"
                        />
                        {errors.lastName && <p className="text-xs text-[#991B1B] mt-1.5">{errors.lastName}</p>}
                      </div>
                   </div>
                   <div>
                     <input
                       type="text"
                       value={form.address}
                       onChange={(e) => updateField('address', e.target.value)}
                       placeholder="Address"
                       aria-label="Address"
                       required
                       className="w-full bg-transparent border-b border-[#D6D1C7] py-3 text-[#2C2A26] placeholder-[#A8A29E] outline-none focus:border-[#2C2A26] transition-colors"
                     />
                     {errors.address && <p className="text-xs text-[#991B1B] mt-1.5">{errors.address}</p>}
                   </div>
                   <input
                     type="text"
                     value={form.apartment}
                     onChange={(e) => updateField('apartment', e.target.value)}
                     placeholder="Apartment, suite, etc. (optional)"
                     aria-label="Apartment, suite, etc. (optional)"
                     className="w-full bg-transparent border-b border-[#D6D1C7] py-3 text-[#2C2A26] placeholder-[#A8A29E] outline-none focus:border-[#2C2A26] transition-colors"
                   />
                   <div className="grid grid-cols-2 gap-4">
                      <div>
                        <input
                          type="text"
                          value={form.city}
                          onChange={(e) => updateField('city', e.target.value)}
                          placeholder="City"
                          aria-label="City"
                          required
                          className="w-full bg-transparent border-b border-[#D6D1C7] py-3 text-[#2C2A26] placeholder-[#A8A29E] outline-none focus:border-[#2C2A26] transition-colors"
                        />
                        {errors.city && <p className="text-xs text-[#991B1B] mt-1.5">{errors.city}</p>}
                      </div>
                      <div>
                        <input
                          type="text"
                          value={form.postalCode}
                          onChange={(e) => updateField('postalCode', e.target.value)}
                          placeholder="Postal code"
                          aria-label="Postal code"
                          required
                          className="w-full bg-transparent border-b border-[#D6D1C7] py-3 text-[#2C2A26] placeholder-[#A8A29E] outline-none focus:border-[#2C2A26] transition-colors"
                        />
                        {errors.postalCode && <p className="text-xs text-[#991B1B] mt-1.5">{errors.postalCode}</p>}
                      </div>
                   </div>
                </div>
              </div>

              {/* Section 3: Payment (UPI fetched from live website_settings) */}
              <div>
                <h2 className="text-xl font-serif text-[#2C2A26] mb-6">Payment</h2>
                <div className="p-6 border border-[#D6D1C7] bg-white/50 space-y-6">
                   <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#D6D1C7]">
                     <div>
                       <span className="block text-xs uppercase tracking-widest text-[#A8A29E] mb-1">
                         Pay via UPI ID
                       </span>
                       <p className="text-lg font-medium text-[#2C2A26] tracking-wide select-all">
                         {upiId || 'Loading UPI ID...'}
                       </p>
                       {upiReceiverName && (
                         <p className="text-xs text-[#5D5A53] mt-1">
                           Receiver: {upiReceiverName}
                         </p>
                       )}
                     </div>
                     <button
                       type="button"
                       onClick={handleCopyUpi}
                       disabled={!upiId}
                       className="self-start sm:self-auto px-4 py-2 border border-[#D6D1C7] text-xs uppercase tracking-widest text-[#2C2A26] hover:border-[#2C2A26] transition-colors whitespace-nowrap disabled:opacity-50"
                     >
                       {upiCopied ? 'Copied' : 'Copy UPI ID'}
                     </button>
                   </div>

                   <div>
                     <label
                       htmlFor="transaction-id"
                       className="block text-xs uppercase tracking-widest text-[#5D5A53] mb-2"
                     >
                       Transaction ID <span className="text-[#991B1B]">*</span>
                     </label>
                     <input
                       id="transaction-id"
                       type="text"
                       required
                       value={form.transactionId}
                       onChange={(e) => updateField('transactionId', e.target.value)}
                       placeholder="Enter UPI Transaction ID (compulsory)"
                       className="w-full bg-transparent border-b border-[#D6D1C7] py-3 text-[#2C2A26] placeholder-[#A8A29E] outline-none focus:border-[#2C2A26] transition-colors tabular-nums"
                     />
                     {errors.transactionId ? (
                       <p className="text-xs text-[#991B1B] mt-1.5">{errors.transactionId}</p>
                     ) : (
                       <p className="text-xs text-[#A8A29E] mt-2">
                         Complete the UPI payment to {upiId} and enter the Transaction ID above to place your order.
                       </p>
                     )}
                   </div>
                </div>
              </div>

              {submitError && (
                <p className="text-sm text-[#991B1B]">{submitError}</p>
              )}

              <div>
                <button 
                    type="submit"
                    disabled={items.length === 0 || isSubmitting}
                    className="w-full py-5 bg-[#2C2A26] text-[#F5F2EB] uppercase tracking-widest text-sm font-medium hover:bg-[#433E38] transition-colors disabled:bg-[#A8A29E] disabled:cursor-not-allowed"
                >
                    {isSubmitting ? 'Confirming Order...' : `Book Order — ₹${total}`}
                </button>
              </div>
            </div>
          </form>

          {/* Right Column: Summary */}
          <div className="lg:pl-12 lg:border-l border-[#D6D1C7]">
            <h2 className="text-xl font-serif text-[#2C2A26] mb-8">Order Summary</h2>
            
            {groupedItems.length === 0 ? (
              <p className="text-sm text-[#5D5A53] mb-8">Your cart is currently empty.</p>
            ) : (
              <div className="space-y-6 mb-8">
                 {groupedItems.map(({ product, quantity }) => (
                   <div key={product.id} className="flex gap-4">
                      <div className="w-16 h-16 bg-[#EBE7DE] relative shrink-0">
                         <img src={product.imageUrl} alt={product.name} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                         <span className="absolute -top-2 -right-2 w-5 h-5 bg-[#2C2A26] text-white text-[10px] flex items-center justify-center rounded-full tabular-nums">{quantity}</span>
                      </div>
                      <div className="flex-1">
                         <h3 className="font-serif text-[#2C2A26] text-base">{product.name}</h3>
                         <p className="text-xs text-[#A8A29E]">{product.category}</p>
                      </div>
                      <span className="text-sm text-[#5D5A53] tabular-nums">₹{product.price * quantity}</span>
                   </div>
                 ))}
              </div>
            )}

            <div className="border-t border-[#D6D1C7] pt-6 space-y-2">
              <div className="flex justify-between text-sm text-[#5D5A53]">
                 <span>Subtotal</span>
                 <span className="tabular-nums">₹{subtotal}</span>
              </div>
              <div className="flex justify-between text-sm text-[#5D5A53]">
                 <span>Shipping</span>
                 <span>Free</span>
              </div>
            </div>
            
            <div className="border-t border-[#D6D1C7] mt-6 pt-6">
               <div className="flex justify-between items-center">
                 <span className="font-serif text-xl text-[#2C2A26]">Total</span>
                 <div className="flex items-end gap-2">
                   <span className="text-xs text-[#A8A29E] mb-1">INR</span>
                   <span className="font-serif text-2xl text-[#2C2A26] tabular-nums">₹{total}</span>
                 </div>
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;