/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Edit3, Plus, Search, Trash2, Upload, X } from 'lucide-react';
import type { Product } from '../../types';

interface ProductsManagementViewProps {
  token: string;
  onNotify: (type: 'success' | 'error', message: string) => void;
  onStorefrontUpdated: () => Promise<void>;
  onUploadImage: (file: File) => Promise<string>;
}

const PRESET_CATEGORIES = ['Audio', 'Wearable', 'Mobile', 'Home'];

interface ProductFormState {
  name: string;
  price: string;
  tagline: string;
  description: string;
  longDescription: string;
  category: string;
  availability: 'Available' | 'Out of Stock';
  imageUrl: string;
  featuresText: string;
}

const EMPTY_FORM: ProductFormState = {
  name: '',
  price: '',
  tagline: '',
  description: '',
  longDescription: '',
  category: 'Audio',
  availability: 'Available',
  imageUrl: '',
  featuresText: '',
};

const ProductsManagementView: React.FC<ProductsManagementViewProps> = ({
  token,
  onNotify,
  onStorefrontUpdated,
  onUploadImage,
}) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ProductFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const qs = searchQuery.trim() ? `?q=${encodeURIComponent(searchQuery.trim())}` : '';
      const resp = await fetch(`/api/admin/products${qs}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.error || 'Failed to load products.');
      setProducts(data.products || []);
    } catch (err: any) {
      onNotify('error', err?.message || 'Unable to load products.');
    } finally {
      setLoading(false);
    }
  }, [token, searchQuery, onNotify]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const startCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const startEdit = (p: Product) => {
    setEditingId(p.id);
    setForm({
      name: p.name,
      price: String(p.price),
      tagline: p.tagline || '',
      description: p.description,
      longDescription: p.longDescription || '',
      category: p.category || 'Audio',
      availability: p.availability === 'Out of Stock' ? 'Out of Stock' : 'Available',
      imageUrl: p.imageUrl,
      featuresText: (p.features || []).join(', '),
    });
    setShowForm(true);
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const url = await onUploadImage(file);
      setForm((prev) => ({ ...prev, imageUrl: url }));
      onNotify('success', 'Product image uploaded.');
    } catch (err: any) {
      onNotify('error', err?.message || 'Failed to upload image.');
    } finally {
      setUploadingImage(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    const numericPrice = Number(form.price);
    if (!form.name.trim()) {
      onNotify('error', 'Product name is required.');
      return;
    }
    if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
      onNotify('error', 'Enter a valid product price in ₹ INR.');
      return;
    }
    if (!form.description.trim()) {
      onNotify('error', 'Product details / description are required.');
      return;
    }
    if (!form.imageUrl.trim()) {
      onNotify('error', 'Please upload a product image or provide an image URL.');
      return;
    }

    setSaving(true);
    try {
      const features = form.featuresText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const payload = {
        name: form.name.trim(),
        price: Math.round(numericPrice),
        tagline: form.tagline.trim() || form.category.trim(),
        description: form.description.trim(),
        longDescription: form.longDescription.trim() || form.description.trim(),
        category: form.category.trim() || 'Audio',
        availability: form.availability,
        imageUrl: form.imageUrl.trim(),
        gallery: [form.imageUrl.trim()],
        features,
      };

      const url = editingId
        ? `/api/admin/products/${encodeURIComponent(editingId)}`
        : '/api/admin/products';
      const method = editingId ? 'PUT' : 'POST';

      const resp = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(data.error || 'Failed to save product.');
      }

      onNotify('success', editingId ? 'Product updated.' : 'Product added to catalog.');
      cancelForm();
      await Promise.all([loadProducts(), onStorefrontUpdated()]);
    } catch (err: any) {
      onNotify('error', err?.message || 'Unable to save product.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    try {
      const resp = await fetch(`/api/admin/products/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.error || 'Failed to delete product.');
      onNotify('success', 'Product deleted.');
      setDeleteConfirmId(null);
      if (editingId === id) {
        cancelForm();
      }
      await Promise.all([loadProducts(), onStorefrontUpdated()]);
    } catch (err: any) {
      onNotify('error', err?.message || 'Unable to delete product.');
    }
  };

  return (
    <div className="space-y-8">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-[#737373] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search products by name or category..."
            aria-label="Search products"
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#E5E5E5] text-sm text-[#0A0A0A] placeholder-[#A3A3A3] focus:outline-none focus:border-[#0A0A0A]"
          />
        </div>
        <button
          type="button"
          onClick={startCreate}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#0A0A0A] text-white text-xs font-medium uppercase tracking-wider hover:bg-[#262626] transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          Add New Product
        </button>
      </div>

      {/* Add / Edit Product Panel */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-white border border-[#E5E5E5] p-6 md:p-8 space-y-6"
        >
          <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-4">
            <h2 className="text-lg font-semibold text-[#0A0A0A]">
              {editingId ? 'Edit Product' : 'Add New Product'}
            </h2>
            <button
              type="button"
              onClick={cancelForm}
              aria-label="Cancel product editing"
              className="p-1.5 text-[#737373] hover:text-[#0A0A0A]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-[#525252] mb-2">
                Product Name *
              </label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Aura Solace"
                className="w-full px-3.5 py-2.5 border border-[#D4D4D4] text-sm focus:outline-none focus:border-[#0A0A0A]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-[#525252] mb-2">
                Product Price (₹ INR) *
              </label>
              <input
                type="number"
                min={1}
                required
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                placeholder="e.g. 1499"
                className="w-full px-3.5 py-2.5 border border-[#D4D4D4] text-sm tabular-nums focus:outline-none focus:border-[#0A0A0A]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-[#525252] mb-2">
                Product Category *
              </label>
              <div className="flex gap-2">
                <select
                  value={PRESET_CATEGORIES.includes(form.category) ? form.category : '__custom__'}
                  onChange={(e) => {
                    if (e.target.value !== '__custom__') {
                      setForm({ ...form, category: e.target.value });
                    }
                  }}
                  className="px-3.5 py-2.5 border border-[#D4D4D4] bg-white text-sm focus:outline-none focus:border-[#0A0A0A]"
                >
                  {PRESET_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                  <option value="__custom__">Custom</option>
                </select>
                <input
                  type="text"
                  required
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder="Category"
                  className="flex-1 px-3.5 py-2.5 border border-[#D4D4D4] text-sm focus:outline-none focus:border-[#0A0A0A]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-[#525252] mb-2">
                Product Availability *
              </label>
              <select
                value={form.availability}
                onChange={(e) =>
                  setForm({
                    ...form,
                    availability:
                      e.target.value === 'Out of Stock' ? 'Out of Stock' : 'Available',
                  })
                }
                className="w-full px-3.5 py-2.5 border border-[#D4D4D4] bg-white text-sm focus:outline-none focus:border-[#0A0A0A]"
              >
                <option value="Available">Available</option>
                <option value="Out of Stock">Out of Stock</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-[#525252] mb-2">
              Product Details / Description *
            </label>
            <textarea
              required
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Describe the materials, sensory qualities, and functionality..."
              className="w-full px-3.5 py-2.5 border border-[#D4D4D4] text-sm focus:outline-none focus:border-[#0A0A0A]"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-[#525252] mb-2">
                Tagline (Optional)
              </label>
              <input
                type="text"
                value={form.tagline}
                onChange={(e) => setForm({ ...form, tagline: e.target.value })}
                placeholder="Short editorial subtitle"
                className="w-full px-3.5 py-2.5 border border-[#D4D4D4] text-sm focus:outline-none focus:border-[#0A0A0A]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-[#525252] mb-2">
                Key Features (Comma Separated)
              </label>
              <input
                type="text"
                value={form.featuresText}
                onChange={(e) => setForm({ ...form, featuresText: e.target.value })}
                placeholder="e.g. Organic Acoustic Fabric, 50h Battery"
                className="w-full px-3.5 py-2.5 border border-[#D4D4D4] text-sm focus:outline-none focus:border-[#0A0A0A]"
              />
            </div>
          </div>

          {/* Image Upload & Preview */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
            <div className="md:col-span-8 space-y-3">
              <label className="block text-xs font-medium uppercase tracking-wider text-[#525252]">
                Product Image Upload *
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex items-center gap-2 px-4 py-2.5 border border-[#0A0A0A] text-xs font-medium uppercase tracking-wider text-[#0A0A0A] hover:bg-[#0A0A0A] hover:text-white transition-colors cursor-pointer">
                  <Upload className="w-4 h-4" />
                  {uploadingImage ? 'Uploading...' : 'Upload Image File'}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    onChange={handleImageFileChange}
                    disabled={uploadingImage}
                    className="hidden"
                  />
                </label>
                <span className="text-xs text-[#737373]">PNG, JPG, WEBP, or SVG up to 5 MB</span>
              </div>
              <input
                type="text"
                value={form.imageUrl}
                onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                placeholder="/uploads/... or https://..."
                className="w-full px-3.5 py-2.5 border border-[#D4D4D4] text-sm focus:outline-none focus:border-[#0A0A0A]"
              />
            </div>

            <div className="md:col-span-4">
              <div className="aspect-square w-36 border border-[#E5E5E5] bg-[#F5F5F5] flex items-center justify-center overflow-hidden">
                {form.imageUrl ? (
                  <img
                    src={form.imageUrl}
                    alt={form.name || 'Product preview'}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-xs text-[#A3A3A3]">Image Preview</span>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-[#E5E5E5]">
            <button
              type="submit"
              disabled={saving || uploadingImage}
              className="px-6 py-2.5 bg-[#0A0A0A] text-white text-xs font-medium uppercase tracking-wider hover:bg-[#262626] transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : editingId ? 'Update Product' : 'Add Product'}
            </button>

            {editingId && (
              <button
                type="button"
                onClick={() => setDeleteConfirmId(editingId)}
                className="px-5 py-2.5 border border-[#DC2626] text-[#DC2626] text-xs font-medium uppercase tracking-wider hover:bg-[#DC2626] hover:text-white transition-colors"
              >
                Delete Product
              </button>
            )}

            <button
              type="button"
              onClick={cancelForm}
              className="px-5 py-2.5 border border-[#D4D4D4] text-[#525252] text-xs font-medium uppercase tracking-wider hover:border-[#0A0A0A] hover:text-[#0A0A0A] transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Products Table */}
      <div className="bg-white border border-[#E5E5E5] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E5E5E5] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#0A0A0A]">
            Catalog Products ({products.length})
          </h2>
          <span className="text-xs text-[#737373]">
            Synced directly with storefront collection
          </span>
        </div>

        {loading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3].map((row) => (
              <div key={row} className="h-12 bg-[#F5F5F5] animate-pulse" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="p-12 text-center space-y-4">
            <p className="text-sm text-[#525252]">No products matched your search.</p>
            <button
              type="button"
              onClick={startCreate}
              className="px-5 py-2.5 bg-[#0A0A0A] text-white text-xs font-medium uppercase tracking-wider"
            >
              Add First Product
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E5E5E5] bg-[#FAFAFA] text-[11px] font-medium uppercase tracking-wider text-[#737373]">
                  <th className="py-3 px-6">Product</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Availability</th>
                  <th className="py-3 px-4 text-right">Price (₹)</th>
                  <th className="py-3 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E5E5] text-sm">
                {products.map((product) => (
                  <tr key={product.id} className="hover:bg-[#FAFAFA] transition-colors">
                    <td className="py-3.5 px-6">
                      <div className="flex items-center gap-3.5">
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          referrerPolicy="no-referrer"
                          className="w-11 h-11 object-cover bg-[#F5F5F5] border border-[#E5E5E5] shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="font-medium text-[#0A0A0A] truncate">
                            {product.name}
                          </div>
                          <div className="text-xs text-[#737373] truncate max-w-xs">
                            {product.description}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-[#525252]">{product.category}</td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`text-xs font-medium ${
                          product.availability === 'Out of Stock'
                            ? 'text-[#DC2626]'
                            : 'text-[#16A34A]'
                        }`}
                      >
                        {product.availability || 'Available'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-[#0A0A0A]">
                      ₹{product.price}
                    </td>
                    <td className="py-3.5 px-6 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(product)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#D4D4D4] text-xs font-medium text-[#0A0A0A] hover:border-[#0A0A0A] transition-colors"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(product.id)}
                          aria-label={`Delete ${product.name}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#E5E5E5] text-xs font-medium text-[#DC2626] hover:border-[#DC2626] transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-[#E5E5E5] max-w-sm w-full p-6 space-y-4">
            <h3 className="text-base font-semibold text-[#0A0A0A]">Confirm Deletion</h3>
            <p className="text-sm text-[#525252]">
              Are you sure you want to permanently remove this product from the store catalog?
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 border border-[#D4D4D4] text-xs font-medium uppercase tracking-wider text-[#525252]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteProduct(deleteConfirmId)}
                className="px-4 py-2 bg-[#DC2626] text-white text-xs font-medium uppercase tracking-wider hover:bg-[#B91C1C]"
              >
                Delete Product
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductsManagementView;
