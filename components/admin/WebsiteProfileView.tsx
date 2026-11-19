/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { DatabaseBackup, Trash2, Upload } from 'lucide-react';

interface WebsiteProfileViewProps {
  token: string;
  onNotify: (type: 'success' | 'error', message: string) => void;
  onStorefrontUpdated: () => Promise<void>;
  onUploadImage: (file: File) => Promise<string>;
  onDownloadBackup: () => Promise<void>;
}

const WebsiteProfileView: React.FC<WebsiteProfileViewProps> = ({
  token,
  onNotify,
  onStorefrontUpdated,
  onUploadImage,
  onDownloadBackup,
}) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBg, setUploadingBg] = useState(false);

  const [currentWebsiteName, setCurrentWebsiteName] = useState('Aura');
  const [websiteName, setWebsiteName] = useState('Aura');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [heroBackgroundUrl, setHeroBackgroundUrl] = useState<string | null>(null);
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactAddress, setContactAddress] = useState('');

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetch('/api/admin/settings/website', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.error || 'Failed to load website profile.');
      const ws = data.websiteSettings;
      setCurrentWebsiteName(ws.websiteName || 'Aura');
      setWebsiteName(ws.websiteName || 'Aura');
      setLogoUrl(ws.logoUrl || null);
      setHeroBackgroundUrl(ws.heroBackgroundUrl || null);
      setContactEmail(ws.contactEmail || '');
      setContactPhone(ws.contactPhone || '');
      setContactAddress(ws.contactAddress || '');
    } catch (err: any) {
      onNotify('error', err?.message || 'Unable to load website profile.');
    } finally {
      setLoading(false);
    }
  }, [token, onNotify]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleUploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const url = await onUploadImage(file);
      setLogoUrl(url);
      onNotify('success', 'Logo uploaded. Click Save Changes to publish.');
    } catch (err: any) {
      onNotify('error', err?.message || 'Failed to upload logo.');
    } finally {
      setUploadingLogo(false);
      e.target.value = '';
    }
  };

  const handleUploadHeroBg = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingBg(true);
    try {
      const url = await onUploadImage(file);
      setHeroBackgroundUrl(url);
      onNotify('success', 'Homepage background uploaded. Click Save Changes to publish.');
    } catch (err: any) {
      onNotify('error', err?.message || 'Failed to upload background image.');
    } finally {
      setUploadingBg(false);
      e.target.value = '';
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!websiteName.trim()) {
      onNotify('error', 'Website Name cannot be empty.');
      return;
    }
    setSaving(true);
    try {
      const resp = await fetch('/api/admin/settings/website', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          websiteName: websiteName.trim(),
          logoUrl,
          heroBackgroundUrl,
          contactEmail: contactEmail.trim(),
          contactPhone: contactPhone.trim(),
          contactAddress: contactAddress.trim(),
        }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.error || 'Failed to save website profile.');
      setCurrentWebsiteName(data.websiteSettings.websiteName);
      onNotify('success', 'Website branding and homepage appearance updated across the storefront.');
      await onStorefrontUpdated();
    } catch (err: any) {
      onNotify('error', err?.message || 'Unable to save website profile.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="h-80 bg-white border border-[#E5E5E5] animate-pulse" />;
  }

  return (
    <form onSubmit={handleSave} className="max-w-4xl space-y-8">
      {/* A. Website Name & Contact Info */}
      <div className="bg-white border border-[#E5E5E5] p-6 md:p-8 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E5E5E5] pb-4">
          <div>
            <h2 className="text-base font-semibold text-[#0A0A0A]">A. Website Name & Contact</h2>
            <p className="text-xs text-[#737373] mt-0.5">
              Current Website Name: <span className="font-semibold text-[#0A0A0A]">{currentWebsiteName}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onDownloadBackup}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-[#D4D4D4] text-xs font-medium uppercase tracking-wider text-[#0A0A0A] hover:border-[#0A0A0A]"
          >
            <DatabaseBackup className="w-3.5 h-3.5" />
            Export DB Backup
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-[#525252] mb-1.5">
              Edit Website Name *
            </label>
            <input
              type="text"
              required
              value={websiteName}
              onChange={(e) => setWebsiteName(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-[#D4D4D4] text-sm focus:outline-none focus:border-[#0A0A0A]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-[#525252] mb-1.5">
              Contact Email (Used in Footer & Emails) *
            </label>
            <input
              type="email"
              required
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-[#D4D4D4] text-sm focus:outline-none focus:border-[#0A0A0A]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-[#525252] mb-1.5">
              Contact Phone
            </label>
            <input
              type="text"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-[#D4D4D4] text-sm tabular-nums focus:outline-none focus:border-[#0A0A0A]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-[#525252] mb-1.5">
              Business Location / Address
            </label>
            <input
              type="text"
              value={contactAddress}
              onChange={(e) => setContactAddress(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-[#D4D4D4] text-sm focus:outline-none focus:border-[#0A0A0A]"
            />
          </div>
        </div>
      </div>

      {/* B. Website Logo */}
      <div className="bg-white border border-[#E5E5E5] p-6 md:p-8 space-y-5">
        <div className="border-b border-[#E5E5E5] pb-4">
          <h2 className="text-base font-semibold text-[#0A0A0A]">B. Website Logo</h2>
          <p className="text-xs text-[#737373] mt-0.5">
            Automatically updates in the navigation bar, footer, and customer emails.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-6">
          <div className="w-40 h-24 border border-[#E5E5E5] bg-[#FAFAFA] flex items-center justify-center p-3 shrink-0">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="Website Logo Preview"
                referrerPolicy="no-referrer"
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <span className="text-xs text-[#A3A3A3]">No Logo Uploaded</span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#0A0A0A] text-white text-xs font-medium uppercase tracking-wider hover:bg-[#262626] cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              {uploadingLogo
                ? 'Uploading...'
                : logoUrl
                  ? 'Replace Existing Logo'
                  : 'Upload New Logo'}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={handleUploadLogo}
                disabled={uploadingLogo}
                className="hidden"
              />
            </label>

            {logoUrl && (
              <button
                type="button"
                onClick={() => setLogoUrl(null)}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 border border-[#DC2626] text-[#DC2626] text-xs font-medium uppercase tracking-wider hover:bg-[#DC2626] hover:text-white transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Remove Logo
              </button>
            )}
          </div>
        </div>
      </div>

      {/* C. Home Page Background Image */}
      <div className="bg-white border border-[#E5E5E5] p-6 md:p-8 space-y-5">
        <div className="border-b border-[#E5E5E5] pb-4">
          <h2 className="text-base font-semibold text-[#0A0A0A]">C. Home Page Background Image</h2>
          <p className="text-xs text-[#737373] mt-0.5">
            Automatically updates the hero background image on the customer-facing homepage.
          </p>
        </div>

        <div className="space-y-4">
          <div className="w-full h-52 border border-[#E5E5E5] bg-[#171717] overflow-hidden flex items-center justify-center">
            {heroBackgroundUrl ? (
              <img
                src={heroBackgroundUrl}
                alt="Homepage Background Preview"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-xs text-[#A3A3A3]">
                No Background Image (Solid Minimal Backdrop Active)
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#0A0A0A] text-white text-xs font-medium uppercase tracking-wider hover:bg-[#262626] cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              {uploadingBg
                ? 'Uploading...'
                : heroBackgroundUrl
                  ? 'Replace Existing Background Image'
                  : 'Upload New Background Image'}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleUploadHeroBg}
                disabled={uploadingBg}
                className="hidden"
              />
            </label>

            {heroBackgroundUrl && (
              <button
                type="button"
                onClick={() => setHeroBackgroundUrl(null)}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 border border-[#DC2626] text-[#DC2626] text-xs font-medium uppercase tracking-wider hover:bg-[#DC2626] hover:text-white transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Remove Background Image
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Save Changes */}
      <div className="flex items-center justify-end">
        <button
          type="submit"
          disabled={saving || uploadingLogo || uploadingBg}
          className="px-8 py-3 bg-[#0A0A0A] text-white text-xs font-medium uppercase tracking-widest hover:bg-[#262626] transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving Changes...' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
};

export default WebsiteProfileView;
