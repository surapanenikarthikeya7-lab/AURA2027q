/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Package, Search, ShoppingBag, Zap } from 'lucide-react';
import type { Product, WebsiteSettings } from '../../types';

interface PortalHomeViewProps {
  products: Product[];
  websiteSettings: WebsiteSettings;
  loading?: boolean;
  addingProductId: string | null;
  selectedCategory?: string;
  onCategoryChange?: (category: string) => void;
  onAddToCart: (product: Product) => Promise<void>;
  onBuyNow: (product: Product) => void;
}

const PortalHomeView: React.FC<PortalHomeViewProps> = ({
  products,
  websiteSettings,
  loading = false,
  addingProductId,
  selectedCategory: controlledCategory,
  onCategoryChange,
  onAddToCart,
  onBuyNow,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [internalCategory, setInternalCategory] = useState('All');
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  const selectedCategory = controlledCategory ?? internalCategory;
  const setSelectedCategory = (next: string) => {
    if (onCategoryChange) {
      onCategoryChange(next);
    } else {
      setInternalCategory(next);
    }
  };

  const categories = useMemo(() => {
    const cats = products.map((p) => p.category).filter(Boolean);
    return ['All', ...Array.from(new Set(cats))];
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products.filter((p) => {
      if (selectedCategory !== 'All' && p.category !== selectedCategory) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    });
  }, [products, selectedCategory, searchQuery]);

  const scrollToCatalog = () => {
    const el = document.getElementById('portal-catalog-grid');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="space-y-8">
      {/* Hero Banner using Admin Website Profile Settings */}
      <section className="relative w-full min-h-[260px] md:min-h-[300px] border border-[#E5E5E5] bg-[#171717] overflow-hidden flex items-end">
        {websiteSettings.heroBackgroundUrl && !heroImgFailed ? (
          <img
            src={websiteSettings.heroBackgroundUrl}
            alt={`${websiteSettings.websiteName} showcase backdrop`}
            referrerPolicy="no-referrer"
            onError={() => setHeroImgFailed(true)}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 w-full h-full bg-gradient-to-br from-[#262626] via-[#171717] to-[#0A0A0A]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/45 to-black/25" />

        <div className="relative z-10 w-full p-6 md:p-10 flex flex-col sm:flex-row sm:items-end justify-between gap-6">
          <div className="max-w-xl">
            <div className="flex items-center gap-3 mb-3">
              {websiteSettings.logoUrl && (
                <img
                  src={websiteSettings.logoUrl}
                  alt={websiteSettings.websiteName}
                  referrerPolicy="no-referrer"
                  className="h-8 w-auto max-w-[120px] object-contain bg-white/95 p-1"
                />
              )}
              <span className="text-xs font-medium uppercase tracking-[0.18em] text-white/80">
                {websiteSettings.websiteName} Collection
              </span>
            </div>
            <h1 className="text-2xl md:text-4xl font-semibold tracking-tight text-white">
              Quiet objects for everyday calm.
            </h1>
            <p className="text-sm text-white/80 mt-2 leading-relaxed">
              Browse available essentials, save items to your persistent cart, or check out instantly with UPI.
            </p>
          </div>

          <button
            type="button"
            onClick={scrollToCatalog}
            className="self-start sm:self-end px-5 py-2.5 bg-white text-[#0A0A0A] text-xs font-medium uppercase tracking-wider hover:bg-[#E5E5E5] transition-colors whitespace-nowrap shrink-0"
          >
            Browse Catalog
          </button>
        </div>
      </section>

      {/* Search & Category Filter Bar */}
      <div
        id="portal-catalog-grid"
        className="bg-white border border-[#E5E5E5] p-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
      >
        <div className="flex flex-wrap items-center gap-2">
          {categories.map((cat) => {
            const active = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 text-xs font-medium uppercase tracking-wider transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-[#0A0A0A] text-white'
                    : 'bg-[#F5F5F5] text-[#525252] hover:text-[#0A0A0A]'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-[#737373] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search products..."
            aria-label="Search products"
            className="w-full pl-9 pr-3.5 py-2 border border-[#D4D4D4] text-xs text-[#0A0A0A] placeholder-[#A3A3A3] focus:outline-none focus:border-[#0A0A0A]"
          />
        </div>
      </div>

      {/* Product Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((idx) => (
            <div
              key={idx}
              className="h-96 bg-white border border-[#E5E5E5] animate-pulse"
            />
          ))}
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="bg-white border border-[#E5E5E5] p-12 text-center">
          <p className="text-sm font-medium text-[#0A0A0A] mb-1">No matching products found</p>
          <p className="text-xs text-[#737373] mb-4">
            Try clearing your search or switching product categories.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('All');
            }}
            className="px-4 py-2 bg-[#0A0A0A] text-white text-xs font-medium uppercase tracking-wider"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((product) => {
            const isOutOfStock = product.availability === 'Out of Stock';
            const isAdding = addingProductId === product.id;
            const imgBroken = failedImages[product.id];

            return (
              <article
                key={product.id}
                className="bg-white border border-[#E5E5E5] flex flex-col justify-between transition-colors hover:border-[#A3A3A3]"
              >
                <div>
                  <div className="aspect-[4/3] w-full bg-[#F5F5F5] border-b border-[#E5E5E5] overflow-hidden">
                    {product.imageUrl && !imgBroken ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        referrerPolicy="no-referrer"
                        onError={() =>
                          setFailedImages((prev) => ({ ...prev, [product.id]: true }))
                        }
                        className={`w-full h-full object-cover transition-transform duration-300 hover:scale-[1.02] ${
                          isOutOfStock ? 'opacity-65 grayscale' : ''
                        }`}
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-[#737373] gap-2 p-4">
                        <Package className="w-8 h-8 stroke-[1.25]" />
                        <span className="text-xs font-medium text-center">
                          {product.name}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="p-5">
                    <div className="flex items-center justify-between gap-3 text-[11px] uppercase tracking-wider text-[#737373] mb-1.5">
                      <span>{product.category}</span>
                      <span
                        className={
                          isOutOfStock ? 'text-[#DC2626] font-medium' : 'text-[#16A34A] font-medium'
                        }
                      >
                        {product.availability || 'Available'}
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between gap-3 mb-2">
                      <h2 className="text-base font-semibold text-[#0A0A0A] truncate">
                        {product.name}
                      </h2>
                      <span className="text-base font-semibold font-mono tabular-nums text-[#0A0A0A] shrink-0">
                        ₹{product.price}
                      </span>
                    </div>

                    <p className="text-xs text-[#525252] leading-relaxed line-clamp-2">
                      {product.description}
                    </p>
                  </div>
                </div>

                <div className="px-5 pb-5 pt-2 grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    disabled={isOutOfStock || isAdding}
                    onClick={() => onAddToCart(product)}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 border border-[#0A0A0A] text-[#0A0A0A] text-xs font-medium uppercase tracking-wider hover:bg-[#0A0A0A] hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    <ShoppingBag className="w-3.5 h-3.5" />
                    {isAdding ? 'Adding...' : isOutOfStock ? 'Unavailable' : 'Add to Cart'}
                  </button>

                  <button
                    type="button"
                    disabled={isOutOfStock}
                    onClick={() => onBuyNow(product)}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 bg-[#0A0A0A] text-white text-xs font-medium uppercase tracking-wider hover:bg-[#262626] transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    {isOutOfStock ? 'Out of Stock' : 'Buy Now'}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PortalHomeView;
