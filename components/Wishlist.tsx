/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import { Product } from '../types';

interface WishlistProps {
  items: Product[];
  onBackToShop: () => void;
  onProductClick: (product: Product) => void;
  onRemoveFromWishlist: (productId: string) => void;
  onAddToCart: (product: Product) => void;
  onClearWishlist: () => void;
}

const Wishlist: React.FC<WishlistProps> = ({
  items,
  onBackToShop,
  onProductClick,
  onRemoveFromWishlist,
  onAddToCart,
  onClearWishlist,
}) => {
  return (
    <section id="wishlist" className="pt-32 pb-32 px-6 md:px-12 min-h-screen bg-[#F5F2EB] animate-fade-in-up">
      <div className="max-w-5xl mx-auto">
        <button
          type="button"
          onClick={onBackToShop}
          className="group flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-[#A8A29E] hover:text-[#2C2A26] transition-colors mb-12"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 group-hover:-translate-x-1 transition-transform">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Back to Shop
        </button>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-8 mb-14 border-b border-[#D6D1C7]">
          <div>
            <span className="block text-xs font-medium uppercase tracking-[0.2em] text-[#A8A29E] mb-3">
              Saved Objects
            </span>
            <h1 className="text-4xl md:text-5xl font-serif text-[#2C2A26]">
              Your Wishlist
            </h1>
          </div>
          <div className="flex items-center gap-6 text-sm text-[#5D5A53]">
            <span className="tabular-nums">
              {items.length} {items.length === 1 ? 'item' : 'items'}
            </span>
            {items.length > 0 && (
              <button
                type="button"
                onClick={onClearWishlist}
                className="text-xs uppercase tracking-widest text-[#A8A29E] hover:text-[#2C2A26] underline underline-offset-4 transition-colors"
              >
                Clear List
              </button>
            )}
          </div>
        </div>

        {items.length === 0 ? (
          <div className="py-24 flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-6">
            <div className="w-16 h-16 rounded-full bg-[#EBE7DE] flex items-center justify-center text-[#5D5A53]">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.25} stroke="currentColor" className="w-7 h-7">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
              </svg>
            </div>
            <h2 className="text-2xl font-serif text-[#2C2A26]">Nothing saved yet</h2>
            <p className="text-[#5D5A53] font-light leading-relaxed">
              Explore our collection and tap the heart icon on any piece you would like to keep close for later.
            </p>
            <button
              type="button"
              onClick={onBackToShop}
              className="mt-2 px-8 py-4 bg-[#2C2A26] text-[#F5F2EB] text-xs uppercase tracking-widest font-medium hover:bg-[#433E38] transition-colors"
            >
              Explore Collection
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12">
            {items.map((product) => (
              <article key={product.id} className="flex flex-col gap-4 group">
                <div
                  className="relative w-full max-w-[230px] mx-auto aspect-square overflow-hidden bg-[#EBE7DE] cursor-pointer"
                  onClick={() => onProductClick(product)}
                >
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover transition-transform duration-1000 ease-in-out group-hover:scale-105 sepia-[0.1]"
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveFromWishlist(product.id);
                    }}
                    aria-label={`Remove ${product.name} from wishlist`}
                    aria-pressed={true}
                    className="absolute top-2.5 right-2.5 z-10 w-10 h-10 flex items-center justify-center rounded-full bg-[#F5F2EB]/90 backdrop-blur-sm text-[#2C2A26] hover:bg-white transition-all duration-200 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2C2A26]"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                    </svg>
                  </button>
                </div>

                <div className="flex flex-col flex-1 justify-between gap-4">
                  <div className="cursor-pointer" onClick={() => onProductClick(product)}>
                    <div className="flex items-baseline justify-between gap-4 mb-1">
                      <h2 className="text-2xl font-serif font-medium text-[#2C2A26] group-hover:opacity-75 transition-opacity">
                        {product.name}
                      </h2>
                      <span className="text-base font-medium text-[#2C2A26] tabular-nums shrink-0">
                        ₹{product.price}
                      </span>
                    </div>
                    <p className="text-xs uppercase tracking-widest text-[#A8A29E] mb-2">
                      {product.category}
                      {product.availability === 'Out of Stock' ? ' · Out of Stock' : ''}
                    </p>
                    <p className="text-sm font-light text-[#5D5A53] leading-relaxed">
                      {product.description}
                    </p>
                  </div>

                  <div className="flex items-center gap-4 pt-2">
                    <button
                      type="button"
                      disabled={product.availability === 'Out of Stock'}
                      onClick={() => onAddToCart(product)}
                      className="flex-1 py-3.5 px-5 bg-[#2C2A26] text-[#F5F2EB] text-xs uppercase tracking-widest font-medium hover:bg-[#433E38] transition-colors whitespace-nowrap disabled:bg-[#A8A29E] disabled:cursor-not-allowed"
                    >
                      {product.availability === 'Out of Stock' ? 'Out of Stock' : 'Add to Cart'}
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemoveFromWishlist(product.id)}
                      className="py-3.5 px-4 border border-[#D6D1C7] text-[#5D5A53] text-xs uppercase tracking-widest hover:border-[#2C2A26] hover:text-[#2C2A26] transition-colors whitespace-nowrap"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default Wishlist;
