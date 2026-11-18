
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import React, { useState, useMemo } from 'react';
import { Product } from '../types';

interface CheckoutProps {
  items: Product[];
  onBack: () => void;
  onOrderComplete: () => void;
}

interface OrderSummaryItem {
  product: Product;
  quantity: number;
}

interface FormState {
  email: string;
  newsletter: boolean;
  firstName: string;
  lastName: string;
  address: string;
  apartment: string;
  city: string;
  postalCode: string;
  cardNumber: string;
  expiry: string;
  cvc: string;
}

const Checkout: React.FC<CheckoutProps> = ({ items, onBack, onOrderComplete }) => {
  const [form, setForm] = useState<FormState>({
    email: '',
    newsletter: false,
    firstName: '',
    lastName: '',
    address: '',
    apartment: '',
    city: '',
    postalCode: '',
    cardNumber: '',
    expiry: '',
    cvc: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState<{
    orderNumber: string;
    items: OrderSummaryItem[];
    total: number;
    email: string;
    recipient: string;
    destination: string;
  } | null>(null);

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
  const shipping = 0; // Free shipping
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
  };

  const formatCardNumber = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 16);
    return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
  };

  const formatExpiry = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 4);
    if (digits.length >= 3) {
      return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    }
    return digits;
  };

  const validate = (): boolean => {
    const nextErrors: Partial<Record<keyof FormState, string>> = {};
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      nextErrors.email = 'Please enter a valid email address.';
    }
    if (!form.firstName.trim()) nextErrors.firstName = 'First name is required.';
    if (!form.lastName.trim()) nextErrors.lastName = 'Last name is required.';
    if (!form.address.trim()) nextErrors.address = 'Street address is required.';
    if (!form.city.trim()) nextErrors.city = 'City is required.';
    if (!form.postalCode.trim()) nextErrors.postalCode = 'Postal code is required.';

    const cardDigits = form.cardNumber.replace(/\s/g, '');
    if (cardDigits.length < 12) {
      nextErrors.cardNumber = 'Enter at least 12 digits for the demo card.';
    }
    if (!/^\d{2}\/\d{2}$/.test(form.expiry)) {
      nextErrors.expiry = 'Use MM/YY format.';
    }
    if (!/^\d{3,4}$/.test(form.cvc)) {
      nextErrors.cvc = 'Enter 3 or 4 digits.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0 || isSubmitting) return;
    if (!validate()) return;

    setIsSubmitting(true);
    const snapshotItems = groupedItems;
    const snapshotTotal = total;
    const orderNumber = `AUR-${Math.floor(1000 + Math.random() * 9000)}`;

    setTimeout(() => {
      setConfirmedOrder({
        orderNumber,
        items: snapshotItems,
        total: snapshotTotal,
        email: form.email.trim(),
        recipient: `${form.firstName.trim()} ${form.lastName.trim()}`,
        destination: `${form.address.trim()}${form.apartment.trim() ? `, ${form.apartment.trim()}` : ''}, ${form.city.trim()} ${form.postalCode.trim()}`,
      });
      setIsSubmitting(false);
      onOrderComplete();
    }, 600);
  };

  if (confirmedOrder) {
    return (
      <div className="min-h-screen pt-24 pb-24 px-6 bg-[#F5F2EB] animate-fade-in-up">
        <div className="max-w-2xl mx-auto bg-white/60 border border-[#D6D1C7] p-8 md:p-14">
          <span className="block text-xs font-medium uppercase tracking-[0.2em] text-[#A8A29E] mb-3">
            Order Confirmation
          </span>
          <h1 className="text-3xl md:text-4xl font-serif text-[#2C2A26] mb-3">
            Order #{confirmedOrder.orderNumber} Confirmed
          </h1>
          <p className="text-sm text-[#5D5A53] font-light leading-relaxed mb-8 pb-8 border-b border-[#D6D1C7]">
            Preparing shipment for {confirmedOrder.recipient}. A confirmation summary has been prepared for{' '}
            <span className="text-[#2C2A26] font-normal">{confirmedOrder.email}</span>.
          </p>

          <div className="space-y-6 mb-8 pb-8 border-b border-[#D6D1C7]">
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
                  <span className="text-[#2C2A26] tabular-nums">${product.price * quantity}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between mb-10">
            <span className="font-serif text-xl text-[#2C2A26]">Total Paid</span>
            <span className="font-serif text-2xl text-[#2C2A26] tabular-nums">${confirmedOrder.total} USD</span>
          </div>

          <button
            type="button"
            onClick={onBack}
            className="w-full py-4 bg-[#2C2A26] text-[#F5F2EB] uppercase tracking-widest text-xs font-medium hover:bg-[#433E38] transition-colors"
          >
            Continue Shopping
          </button>
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
            <p className="text-sm text-[#5D5A53] mb-12">Complete your delivery and demo payment details below. No real charge is made.</p>
            
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
                       placeholder="Email address"
                       aria-label="Email address"
                       className="w-full bg-transparent border-b border-[#D6D1C7] py-3 text-[#2C2A26] placeholder-[#A8A29E] outline-none focus:border-[#2C2A26] transition-colors"
                     />
                     {errors.email && <p className="text-xs text-[#991B1B] mt-1.5">{errors.email}</p>}
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
                          className="w-full bg-transparent border-b border-[#D6D1C7] py-3 text-[#2C2A26] placeholder-[#A8A29E] outline-none focus:border-[#2C2A26] transition-colors"
                        />
                        {errors.postalCode && <p className="text-xs text-[#991B1B] mt-1.5">{errors.postalCode}</p>}
                      </div>
                   </div>
                </div>
              </div>

               {/* Section 3: Payment (Demo) */}
              <div>
                <h2 className="text-xl font-serif text-[#2C2A26] mb-6">Payment</h2>
                <div className="p-6 border border-[#D6D1C7] bg-white/50 space-y-4">
                   <p className="text-sm text-[#5D5A53] mb-2">Demo payment details — no live transaction is processed.</p>
                   <div>
                     <input
                       type="text"
                       inputMode="numeric"
                       value={form.cardNumber}
                       onChange={(e) => updateField('cardNumber', formatCardNumber(e.target.value))}
                       placeholder="Card number (e.g. 4242 4242 4242 4242)"
                       aria-label="Card number"
                       className="w-full bg-transparent border-b border-[#D6D1C7] py-3 text-[#2C2A26] placeholder-[#A8A29E] outline-none focus:border-[#2C2A26] transition-colors tabular-nums"
                     />
                     {errors.cardNumber && <p className="text-xs text-[#991B1B] mt-1.5">{errors.cardNumber}</p>}
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                      <div>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={form.expiry}
                          onChange={(e) => updateField('expiry', formatExpiry(e.target.value))}
                          placeholder="Expiration (MM/YY)"
                          aria-label="Expiration date"
                          className="w-full bg-transparent border-b border-[#D6D1C7] py-3 text-[#2C2A26] placeholder-[#A8A29E] outline-none focus:border-[#2C2A26] transition-colors tabular-nums"
                        />
                        {errors.expiry && <p className="text-xs text-[#991B1B] mt-1.5">{errors.expiry}</p>}
                      </div>
                      <div>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={form.cvc}
                          onChange={(e) => updateField('cvc', e.target.value.replace(/\D/g, '').slice(0, 4))}
                          placeholder="Security code"
                          aria-label="Security code"
                          className="w-full bg-transparent border-b border-[#D6D1C7] py-3 text-[#2C2A26] placeholder-[#A8A29E] outline-none focus:border-[#2C2A26] transition-colors tabular-nums"
                        />
                        {errors.cvc && <p className="text-xs text-[#991B1B] mt-1.5">{errors.cvc}</p>}
                      </div>
                   </div>
                </div>
              </div>

              <div>
                <button 
                    type="submit"
                    disabled={items.length === 0 || isSubmitting}
                    className="w-full py-5 bg-[#2C2A26] text-[#F5F2EB] uppercase tracking-widest text-sm font-medium hover:bg-[#433E38] transition-colors disabled:bg-[#A8A29E] disabled:cursor-not-allowed"
                >
                    {isSubmitting ? 'Placing Order...' : `Pay Now — $${total}`}
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
                      <span className="text-sm text-[#5D5A53] tabular-nums">${product.price * quantity}</span>
                   </div>
                 ))}
              </div>
            )}

            <div className="border-t border-[#D6D1C7] pt-6 space-y-2">
              <div className="flex justify-between text-sm text-[#5D5A53]">
                 <span>Subtotal</span>
                 <span className="tabular-nums">${subtotal}</span>
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
                   <span className="text-xs text-[#A8A29E] mb-1">USD</span>
                   <span className="font-serif text-2xl text-[#2C2A26] tabular-nums">${total}</span>
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