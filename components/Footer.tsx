/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */


import React from 'react';

interface FooterProps {
  onLinkClick: (e: React.MouseEvent<HTMLAnchorElement>, targetId: string) => void;
  onOpenAdmin: () => void;
  onCategorySelect?: (category: string) => void;
  websiteName?: string;
  logoUrl?: string | null;
}

const Footer: React.FC<FooterProps> = ({
  onLinkClick,
  onOpenAdmin,
  onCategorySelect,
  websiteName = 'Aura',
  logoUrl = null,
}) => {
  const handleShopClick = (e: React.MouseEvent<HTMLAnchorElement>, category: string) => {
    if (onCategorySelect) {
      e.preventDefault();
      onCategorySelect(category);
      return;
    }
    onLinkClick(e, 'products');
  };

  return (
    <footer className="bg-[#EBE7DE] py-20 px-6 sm:px-10 text-[#5D5A53] border-t border-[#E5E5E5]">
      <div className="max-w-[1800px] mx-auto grid grid-cols-1 md:grid-cols-12 gap-12">
        
        <div className="md:col-span-6">
          <div className="flex items-center gap-3 mb-6">
            {logoUrl && (
              <img
                src={logoUrl}
                alt={websiteName}
                referrerPolicy="no-referrer"
                className="h-7 w-auto max-w-[120px] object-contain"
              />
            )}
            <h4 className="text-2xl font-serif text-[#2C2A26]">{websiteName}</h4>
          </div>
          <p className="max-w-xs font-light leading-relaxed">
            Designing technology that feels as natural as the world around it.
            Born from the earth, built for the{' '}
            <button
              type="button"
              onClick={onOpenAdmin}
              className="hover:text-[#2C2A26] transition-colors cursor-pointer focus-visible:outline-none focus-visible:underline"
              aria-label="Open Admin Portal"
            >
              mind
            </button>
            .
          </p>
        </div>

        <div className="md:col-span-3">
          <h4 className="font-medium text-[#2C2A26] mb-6 tracking-wide text-sm uppercase">Shop</h4>
          <ul className="space-y-4 font-light">
            <li><a href="#products" onClick={(e) => handleShopClick(e, 'All')} className="hover:text-[#2C2A26] transition-colors underline-offset-4 hover:underline">All Products</a></li>
            <li><a href="#products" onClick={(e) => handleShopClick(e, 'All')} className="hover:text-[#2C2A26] transition-colors underline-offset-4 hover:underline">New Arrivals</a></li>
            <li><a href="#products" onClick={(e) => handleShopClick(e, 'Audio')} className="hover:text-[#2C2A26] transition-colors underline-offset-4 hover:underline">Audio</a></li>
            <li><a href="#products" onClick={(e) => handleShopClick(e, 'Home')} className="hover:text-[#2C2A26] transition-colors underline-offset-4 hover:underline">Home</a></li>
          </ul>
        </div>
        
        <div className="md:col-span-3">
          <h4 className="font-medium text-[#2C2A26] mb-6 tracking-wide text-sm uppercase">Company</h4>
          <ul className="space-y-4 font-light">
            <li><a href="#about" onClick={(e) => onLinkClick(e, 'about')} className="hover:text-[#2C2A26] transition-colors underline-offset-4 hover:underline">Our Story</a></li>
            <li><a href="#about" onClick={(e) => onLinkClick(e, 'about')} className="hover:text-[#2C2A26] transition-colors underline-offset-4 hover:underline">Sustainability</a></li>
          </ul>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
