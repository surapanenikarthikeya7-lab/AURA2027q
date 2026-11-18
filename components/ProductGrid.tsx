/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import React, { useState, useMemo } from 'react';
import { PRODUCTS } from '../constants';
import { Product } from '../types';
import ProductCard from './ProductCard';
import QuickViewModal from './QuickViewModal';

const categories = ['All', 'Audio', 'Wearable', 'Mobile', 'Home'];

type SortOption = 'featured' | 'price-asc' | 'price-desc' | 'name-asc' | 'name-desc';

interface ProductGridProps {
  onProductClick: (product: Product) => void;
  onAddToCart: (product: Product) => void;
  wishlistIds: string[];
  onToggleWishlist: (productId: string) => void;
}

const ProductGrid: React.FC<ProductGridProps> = ({
  onProductClick,
  onAddToCart,
  wishlistIds,
  onToggleWishlist,
}) => {
  const [activeCategory, setActiveCategory] = useState('All');
  const [sortBy, setSortBy] = useState<SortOption>('featured');
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);

  const filteredAndSortedProducts = useMemo(() => {
    const filtered = activeCategory === 'All'
      ? PRODUCTS
      : PRODUCTS.filter(p => p.category === activeCategory);

    if (sortBy === 'featured') return filtered;

    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'price-asc':
          return a.price - b.price;
        case 'price-desc':
          return b.price - a.price;
        case 'name-asc':
          return a.name.localeCompare(b.name);
        case 'name-desc':
          return b.name.localeCompare(a.name);
        default:
          return 0;
      }
    });
  }, [activeCategory, sortBy]);

  return (
    <section id="products" className="py-24 px-6 md:px-12 bg-[#F5F2EB]">
      <div className="max-w-6xl mx-auto">
        
        {/* Header Area */}
        <div className="flex flex-col items-center text-center mb-14 space-y-6">
          <h2 className="text-4xl md:text-5xl font-serif text-[#2C2A26]">The Collection</h2>
          
          {/* Filter & Sort Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-5 border-t border-[#D6D1C7]/60 w-full">
            <div className="flex flex-wrap justify-center sm:justify-start gap-6 md:gap-8">
              {categories.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  className={`text-sm uppercase tracking-widest pb-1 border-b transition-all duration-300 whitespace-nowrap shrink-0 ${
                    activeCategory === cat 
                      ? 'border-[#2C2A26] text-[#2C2A26]' 
                      : 'border-transparent text-[#A8A29E] hover:text-[#2C2A26]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <label
                htmlFor="collection-sort"
                className="text-xs uppercase tracking-widest text-[#A8A29E] whitespace-nowrap"
              >
                Sort by
              </label>
              <div className="relative">
                <select
                  id="collection-sort"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="appearance-none bg-[#F5F2EB] border border-[#D6D1C7] text-[#2C2A26] text-xs uppercase tracking-widest pl-3.5 pr-9 py-2 cursor-pointer transition-colors hover:border-[#2C2A26] focus:outline-none focus-visible:border-[#2C2A26]"
                >
                  <option value="featured">Featured</option>
                  <option value="price-asc">Price: Low to High</option>
                  <option value="price-desc">Price: High to Low</option>
                  <option value="name-asc">Name: A to Z</option>
                  <option value="name-desc">Name: Z to A</option>
                </select>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  aria-hidden="true"
                  className="w-3.5 h-3.5 text-[#5D5A53] pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* 5-Column Compact Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-6 gap-y-10">
          {filteredAndSortedProducts.map(product => (
            <ProductCard
              key={product.id}
              product={product}
              onClick={onProductClick}
              onQuickView={setQuickViewProduct}
              isWishlisted={wishlistIds.includes(product.id)}
              onToggleWishlist={onToggleWishlist}
            />
          ))}
        </div>
      </div>

      <QuickViewModal
        product={quickViewProduct}
        onClose={() => setQuickViewProduct(null)}
        onAddToCart={onAddToCart}
        onViewFullDetails={onProductClick}
        isWishlisted={quickViewProduct ? wishlistIds.includes(quickViewProduct.id) : false}
        onToggleWishlist={onToggleWishlist}
      />
    </section>
  );
};

export default ProductGrid;
