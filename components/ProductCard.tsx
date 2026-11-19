/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import React from 'react';
import { Product } from '../types';

interface ProductCardProps {
  product: Product;
  onClick: (product: Product) => void;
  onQuickView: (product: Product) => void;
  isWishlisted: boolean;
  onToggleWishlist: (productId: string) => void;
}

const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onClick,
  onQuickView,
  isWishlisted,
  onToggleWishlist,
}) => {
  return (
    <div className="group flex flex-col items-center gap-3 cursor-pointer" onClick={() => onClick(product)}>
      <div className="relative w-full aspect-square overflow-hidden bg-[#EBE7DE]">
        <img 
          src={product.imageUrl} 
          alt={product.name}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover transition-transform duration-1000 ease-in-out group-hover:scale-110 sepia-[0.1]"
        />

        {/* Wishlist Heart Toggle */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleWishlist(product.id);
          }}
          aria-label={isWishlisted ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`}
          aria-pressed={isWishlisted}
          className="absolute top-2 right-2 z-10 w-10 h-10 flex items-center justify-center rounded-full bg-[#F5F2EB]/90 backdrop-blur-sm text-[#2C2A26] hover:bg-white transition-all duration-200 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2C2A26]"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill={isWishlisted ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth={1.5}
            className={`w-4 h-4 transition-transform duration-200 ${isWishlisted ? 'scale-105' : 'group-hover:scale-105'}`}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
            />
          </svg>
        </button>
        
        {/* Hover overlay with interactive Quick View button */}
        <div className="absolute inset-0 bg-[#2C2A26]/0 group-hover:bg-[#2C2A26]/10 transition-colors duration-300 flex items-center justify-center pointer-events-none">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onQuickView(product);
              }}
              className="pointer-events-auto opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 focus:translate-y-0 bg-[#F5F2EB]/95 hover:bg-white text-[#2C2A26] px-4 py-2 rounded-full text-[10px] uppercase tracking-widest font-medium shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2C2A26]"
            >
              Quick View
            </button>
        </div>
      </div>
      
      <div className="text-center">
        <h3 className="text-base font-serif font-medium text-[#2C2A26] mb-0.5 group-hover:opacity-70 transition-opacity">{product.name}</h3>
        <p className="text-[11px] font-light text-[#5D5A53] mb-1 tracking-wide uppercase">
          {product.category}
          {product.availability === 'Out of Stock' ? ' · Out of Stock' : ''}
        </p>
        <span className="text-sm font-medium text-[#2C2A26] block tabular-nums">₹{product.price}</span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onQuickView(product);
          }}
          className="mt-1.5 text-[11px] uppercase tracking-widest text-[#5D5A53] hover:text-[#2C2A26] underline underline-offset-4 transition-colors"
        >
          Quick View
        </button>
      </div>
    </div>
  );
};

export default ProductCard;
