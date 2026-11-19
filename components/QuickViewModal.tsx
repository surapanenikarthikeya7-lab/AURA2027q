/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useEffect } from 'react';
import { Product } from '../types';

interface QuickViewModalProps {
  product: Product | null;
  onClose: () => void;
  onAddToCart: (product: Product) => void;
  onViewFullDetails: (product: Product) => void;
  isWishlisted: boolean;
  onToggleWishlist: (productId: string) => void;
}

const QuickViewModal: React.FC<QuickViewModalProps> = ({
  product,
  onClose,
  onAddToCart,
  onViewFullDetails,
  isWishlisted,
  onToggleWishlist,
}) => {
  useEffect(() => {
    if (!product) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [product, onClose]);

  if (!product) return null;

  return (
    <div
      className="fixed inset-0 z-[65] flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-view-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#2C2A26]/45 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Panel */}
      <div className="relative z-10 w-full max-w-3xl bg-[#F5F2EB] border border-[#D6D1C7] shadow-2xl grid grid-cols-1 md:grid-cols-2 overflow-hidden animate-slide-up-fade max-h-[90vh] overflow-y-auto md:overflow-hidden">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close quick view"
          className="absolute top-3 right-3 z-20 w-10 h-10 flex items-center justify-center rounded-full bg-[#F5F2EB]/90 text-[#2C2A26] hover:bg-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2C2A26]"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Left: Product Image */}
        <div className="w-full aspect-square md:aspect-auto md:h-full bg-[#EBE7DE] overflow-hidden">
          <img
            src={product.imageUrl}
            alt={product.name}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover sepia-[0.08]"
          />
        </div>

        {/* Right: Brief Details & Add to Cart */}
        <div className="p-7 md:p-9 flex flex-col justify-between gap-6">
          <div>
            <span className="block text-xs font-medium uppercase tracking-[0.2em] text-[#A8A29E] mb-2">
              {product.category}
              {product.availability === 'Out of Stock' ? ' · Out of Stock' : ''}
            </span>
            <h2 id="quick-view-title" className="text-3xl font-serif text-[#2C2A26] mb-1">
              {product.name}
            </h2>
            <p className="text-sm font-serif italic text-[#5D5A53] mb-4">
              {product.tagline}
            </p>
            <p className="text-xl font-light text-[#2C2A26] tabular-nums pb-5 mb-5 border-b border-[#D6D1C7]">
              ₹{product.price}
            </p>
            <p className="text-sm md:text-base text-[#5D5A53] font-light leading-relaxed mb-5">
              {product.description}
            </p>
            <ul className="space-y-1.5 text-xs text-[#5D5A53]">
              {product.features.map((feature, idx) => (
                <li key={idx} className="flex items-center gap-2.5">
                  <span className="w-1 h-1 bg-[#2C2A26] rounded-full shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col gap-3 pt-2">
            <button
              type="button"
              disabled={product.availability === 'Out of Stock'}
              onClick={() => {
                onAddToCart(product);
                onClose();
              }}
              className="w-full py-4 bg-[#2C2A26] text-[#F5F2EB] uppercase tracking-widest text-xs font-medium hover:bg-[#433E38] transition-colors disabled:bg-[#A8A29E] disabled:cursor-not-allowed"
            >
              {product.availability === 'Out of Stock'
                ? 'Out of Stock'
                : `Add to Cart — ₹${product.price}`}
            </button>

            <div className="flex items-center justify-between gap-4 pt-1">
              <button
                type="button"
                onClick={() => onToggleWishlist(product.id)}
                aria-pressed={isWishlisted}
                className="flex items-center gap-2 text-xs uppercase tracking-widest text-[#5D5A53] hover:text-[#2C2A26] transition-colors py-1"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill={isWishlisted ? 'currentColor' : 'none'}
                  stroke="currentColor"
                  strokeWidth={1.5}
                  className="w-4 h-4"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
                  />
                </svg>
                {isWishlisted ? 'Saved' : 'Save'}
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onViewFullDetails(product);
                }}
                className="text-xs uppercase tracking-widest text-[#5D5A53] hover:text-[#2C2A26] underline underline-offset-4 transition-colors py-1"
              >
                Full Details
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuickViewModal;
