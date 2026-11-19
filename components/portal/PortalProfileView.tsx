/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Camera, Check, Edit3, ShieldCheck, Trash2, User } from 'lucide-react';
import type { CustomerProfile } from '../../types';

interface PortalProfileViewProps {
  token: string;
  customer: CustomerProfile;
  onProfileUpdated: (nextCustomer: CustomerProfile) => void;
  onNotify: (type: 'success' | 'error', message: string) => void;
}

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

const PortalProfileView: React.FC<PortalProfileViewProps> = ({
  token,
  customer,
  onProfileUpdated,
  onNotify,
}) => {
  // Edit Name state
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(customer.name);
  const [savingName, setSavingName] = useState(false);

  // Profile Picture (DP) state
  const [previewAvatarUrl, setPreviewAvatarUrl] = useState<string | null>(
    customer.profilePictureUrl
  );
  const [pendingAvatarDataUrl, setPendingAvatarDataUrl] = useState<string | null>(null);
  const [pendingAvatarFilename, setPendingAvatarFilename] = useState<string>('avatar.png');
  const [avatarRemoved, setAvatarRemoved] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false);

  // Default Address state
  const [addressInput, setAddressInput] = useState(customer.address || '');
  const [savingAddress, setSavingAddress] = useState(false);

  // Email & Phone Verification state
  const [verifyType, setVerifyType] = useState<'email' | 'phone' | null>(null);
  const [verifyNewValue, setVerifyNewValue] = useState('');
  const [verifyStep, setVerifyStep] = useState<'input' | 'code'>('input');
  const [verifyCodeInput, setVerifyCodeInput] = useState('');
  const [verifyNotice, setVerifyNotice] = useState<string | null>(null);
  const [verifyFallbackCode, setVerifyFallbackCode] = useState<string | null>(null);
  const [verifyingContact, setVerifyingContact] = useState(false);

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = nameInput.trim();
    if (trimmed.length < 2) {
      onNotify('error', 'Display name must be at least 2 characters.');
      return;
    }

    setSavingName(true);
    try {
      const resp = await fetch('/api/customer/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.error || 'Failed to update name.');
      onProfileUpdated(data.customer);
      setEditingName(false);
      onNotify('success', 'Customer name updated across your account.');
    } catch (err: any) {
      onNotify('error', err?.message || 'Unable to update name.');
    } finally {
      setSavingName(false);
    }
  };

  const handleSelectAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_IMAGE_TYPES.includes(file.type.toLowerCase())) {
      onNotify('error', 'Only JPG, JPEG, PNG, and WebP images are supported.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      onNotify('error', 'Profile picture must be 5 MB or smaller.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      setPreviewAvatarUrl(dataUrl);
      setPendingAvatarDataUrl(dataUrl);
      setPendingAvatarFilename(file.name);
      setAvatarRemoved(false);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatarPreview = () => {
    setPreviewAvatarUrl(null);
    setPendingAvatarDataUrl(null);
    setAvatarRemoved(true);
  };

  const handleSaveAvatar = async () => {
    setSavingAvatar(true);
    try {
      let nextUrl: string | null = customer.profilePictureUrl;

      if (avatarRemoved) {
        nextUrl = null;
      } else if (pendingAvatarDataUrl) {
        const uploadResp = await fetch('/api/customer/upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            dataUrl: pendingAvatarDataUrl,
            filename: pendingAvatarFilename,
          }),
        });
        const uploadData = await uploadResp.json().catch(() => ({}));
        if (!uploadResp.ok) {
          throw new Error(uploadData.error || 'Profile picture upload failed.');
        }
        nextUrl = uploadData.url;
      }

      const saveResp = await fetch('/api/customer/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ profilePictureUrl: nextUrl }),
      });
      const saveData = await saveResp.json().catch(() => ({}));
      if (!saveResp.ok) throw new Error(saveData.error || 'Failed to save profile picture.');

      onProfileUpdated(saveData.customer);
      setPreviewAvatarUrl(saveData.customer.profilePictureUrl);
      setPendingAvatarDataUrl(null);
      setAvatarRemoved(false);
      onNotify('success', 'Profile picture saved.');
    } catch (err: any) {
      onNotify('error', err?.message || 'Unable to save profile picture.');
    } finally {
      setSavingAvatar(false);
    }
  };

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingAddress(true);
    try {
      const resp = await fetch('/api/customer/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ address: addressInput.trim() }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.error || 'Failed to update shipping address.');
      onProfileUpdated(data.customer);
      onNotify('success', 'Default shipping address saved.');
    } catch (err: any) {
      onNotify('error', err?.message || 'Unable to update shipping address.');
    } finally {
      setSavingAddress(false);
    }
  };

  const startContactVerification = (type: 'email' | 'phone') => {
    setVerifyType(type);
    setVerifyNewValue('');
    setVerifyStep('input');
    setVerifyCodeInput('');
    setVerifyNotice(null);
    setVerifyFallbackCode(null);
  };

  const handleRequestVerificationCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyType) return;
    setVerifyingContact(true);
    setVerifyNotice(null);
    setVerifyFallbackCode(null);
    try {
      const resp = await fetch('/api/customer/profile/request-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          type: verifyType,
          newValue: verifyNewValue.trim(),
        }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.error || 'Verification request failed.');
      setVerifyNotice(data.message || 'Verification code generated.');
      if (data.fallbackCode) {
        setVerifyFallbackCode(data.fallbackCode);
      }
      setVerifyStep('code');
    } catch (err: any) {
      onNotify('error', err?.message || 'Could not send verification code.');
    } finally {
      setVerifyingContact(false);
    }
  };

  const handleConfirmVerificationCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyType) return;
    setVerifyingContact(true);
    try {
      const resp = await fetch('/api/customer/profile/confirm-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          type: verifyType,
          code: verifyCodeInput.trim(),
        }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.error || 'Verification code invalid.');
      onProfileUpdated(data.customer);
      onNotify(
        'success',
        verifyType === 'email'
          ? 'Email address verified and updated.'
          : 'Phone number verified and updated.'
      );
      setVerifyType(null);
    } catch (err: any) {
      onNotify('error', err?.message || 'Could not confirm verification code.');
    } finally {
      setVerifyingContact(false);
    }
  };

  const hasUnsavedAvatarChanges = Boolean(pendingAvatarDataUrl) || avatarRemoved;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[#0A0A0A]">Customer Profile</h2>
        <p className="text-xs text-[#737373]">
          Manage your display name, profile picture (DP), and verified contact details.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Profile Picture (DP) Card */}
        <div className="lg:col-span-5 bg-white border border-[#E5E5E5] p-6 space-y-5">
          <div>
            <h3 className="text-sm font-semibold text-[#0A0A0A]">Profile Picture</h3>
            <p className="text-xs text-[#737373] mt-0.5">
              Supports JPG, JPEG, PNG, and WebP up to 5 MB.
            </p>
          </div>

          <div className="flex items-center gap-5">
            <div className="w-24 h-24 rounded-full bg-[#F5F5F5] border border-[#E5E5E5] overflow-hidden flex items-center justify-center shrink-0">
              {previewAvatarUrl ? (
                <img
                  src={previewAvatarUrl}
                  alt={customer.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-9 h-9 text-[#737373] stroke-[1.5]" />
              )}
            </div>

            <div className="space-y-2.5 flex-1">
              <label className="inline-flex items-center gap-2 px-3.5 py-2 border border-[#D4D4D4] text-xs font-medium uppercase tracking-wider text-[#0A0A0A] hover:border-[#0A0A0A] cursor-pointer">
                <Camera className="w-3.5 h-3.5" />
                {previewAvatarUrl ? 'Change Picture' : 'Upload Picture'}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  onChange={handleSelectAvatarFile}
                  className="hidden"
                />
              </label>

              {previewAvatarUrl && (
                <div>
                  <button
                    type="button"
                    onClick={handleRemoveAvatarPreview}
                    className="inline-flex items-center gap-1.5 text-xs text-[#991B1B] hover:underline"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Remove Picture
                  </button>
                </div>
              )}
            </div>
          </div>

          {hasUnsavedAvatarChanges && (
            <div className="flex items-center gap-2 pt-3 border-t border-[#E5E5E5]">
              <button
                type="button"
                disabled={savingAvatar}
                onClick={handleSaveAvatar}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0A0A0A] text-white text-xs font-medium uppercase tracking-wider hover:bg-[#262626] disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5" />
                {savingAvatar ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPreviewAvatarUrl(customer.profilePictureUrl);
                  setPendingAvatarDataUrl(null);
                  setAvatarRemoved(false);
                }}
                className="px-4 py-2 border border-[#D4D4D4] text-xs font-medium uppercase tracking-wider text-[#525252] hover:border-[#0A0A0A]"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {/* Account Details & Name Editing */}
        <div className="lg:col-span-7 bg-white border border-[#E5E5E5] p-6 space-y-6">
          {/* Edit Display Name */}
          <div className="pb-5 border-b border-[#E5E5E5]">
            <div className="flex items-center justify-between gap-4 mb-2">
              <span className="text-xs font-medium uppercase tracking-wider text-[#737373]">
                Customer Name
              </span>
              {!editingName && (
                <button
                  type="button"
                  onClick={() => {
                    setNameInput(customer.name);
                    setEditingName(true);
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[#0A0A0A] hover:underline"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Edit Name
                </button>
              )}
            </div>

            {!editingName ? (
              <p className="text-base font-semibold text-[#0A0A0A]">{customer.name}</p>
            ) : (
              <form onSubmit={handleSaveName} className="space-y-3 mt-2">
                <input
                  type="text"
                  required
                  minLength={2}
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="Enter display name"
                  className="w-full px-3.5 py-2 border border-[#D4D4D4] text-sm text-[#0A0A0A] focus:outline-none focus:border-[#0A0A0A]"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={savingName}
                    className="px-4 py-2 bg-[#0A0A0A] text-white text-xs font-medium uppercase tracking-wider hover:bg-[#262626] disabled:opacity-50"
                  >
                    {savingName ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNameInput(customer.name);
                      setEditingName(false);
                    }}
                    className="px-4 py-2 border border-[#D4D4D4] text-xs font-medium uppercase tracking-wider text-[#525252] hover:border-[#0A0A0A]"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Verified Email Address */}
          <div className="pb-5 border-b border-[#E5E5E5]">
            <div className="flex items-center justify-between gap-4 mb-1.5">
              <span className="text-xs font-medium uppercase tracking-wider text-[#737373]">
                Email Address
              </span>
              <button
                type="button"
                onClick={() => startContactVerification('email')}
                className="inline-flex items-center gap-1 text-xs font-medium text-[#0A0A0A] hover:underline"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                Change with Verification
              </button>
            </div>
            <p className="text-sm font-medium text-[#0A0A0A]">{customer.email}</p>
          </div>

          {/* Verified Phone Number */}
          <div className="pb-5 border-b border-[#E5E5E5]">
            <div className="flex items-center justify-between gap-4 mb-1.5">
              <span className="text-xs font-medium uppercase tracking-wider text-[#737373]">
                Phone Number
              </span>
              <button
                type="button"
                onClick={() => startContactVerification('phone')}
                className="inline-flex items-center gap-1 text-xs font-medium text-[#0A0A0A] hover:underline"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                Change with Verification
              </button>
            </div>
            <p className="text-sm font-medium text-[#0A0A0A] tabular-nums">
              {customer.phone || 'Not provided'}
            </p>
          </div>

          {/* Default Shipping Address */}
          <form onSubmit={handleSaveAddress} className="pb-5 border-b border-[#E5E5E5] space-y-3">
            <label
              htmlFor="customer-default-address"
              className="block text-xs font-medium uppercase tracking-wider text-[#737373]"
            >
              Default Shipping Address
            </label>
            <textarea
              id="customer-default-address"
              rows={2}
              value={addressInput}
              onChange={(e) => setAddressInput(e.target.value)}
              placeholder="Save your preferred shipping address for faster checkout"
              className="w-full px-3.5 py-2 border border-[#D4D4D4] text-sm text-[#0A0A0A] focus:outline-none focus:border-[#0A0A0A]"
            />
            <button
              type="submit"
              disabled={savingAddress}
              className="px-4 py-2 border border-[#D4D4D4] text-xs font-medium uppercase tracking-wider text-[#0A0A0A] hover:border-[#0A0A0A] disabled:opacity-50"
            >
              {savingAddress ? 'Saving...' : 'Save Address'}
            </button>
          </form>

          {/* Account Creation Date & Metrics */}
          <div className="grid grid-cols-3 gap-4 text-xs">
            <div>
              <span className="block text-[11px] uppercase tracking-wider text-[#737373]">
                Member Since
              </span>
              <span className="font-mono tabular-nums text-[#0A0A0A] font-medium">
                {new Date(customer.createdAt).toLocaleDateString()}
              </span>
            </div>
            <div>
              <span className="block text-[11px] uppercase tracking-wider text-[#737373]">
                Orders Placed
              </span>
              <span className="font-mono tabular-nums text-[#0A0A0A] font-medium">
                {customer.ordersCount}
              </span>
            </div>
            <div>
              <span className="block text-[11px] uppercase tracking-wider text-[#737373]">
                Verified Spend
              </span>
              <span className="font-mono tabular-nums text-[#0A0A0A] font-medium">
                ₹{customer.totalSpent}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Secure Email / Phone Change Verification Modal */}
      {verifyType && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E5E5E5] w-full max-w-md p-6 md:p-8 space-y-5">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-[#737373]">
                Security Verification
              </p>
              <h3 className="text-lg font-semibold text-[#0A0A0A] mt-0.5">
                {verifyType === 'email'
                  ? 'Verify New Email Address'
                  : 'Verify New Phone Number'}
              </h3>
            </div>

            {verifyNotice && (
              <div className="p-3.5 border border-[#16A34A]/30 bg-[#F0FDF4] text-xs text-[#166534]">
                {verifyNotice}
                {verifyFallbackCode && (
                  <div className="mt-2 font-mono font-semibold text-sm text-[#0A0A0A]">
                    Verification Code: {verifyFallbackCode}
                  </div>
                )}
              </div>
            )}

            {verifyStep === 'input' ? (
              <form onSubmit={handleRequestVerificationCode} className="space-y-4">
                <div>
                  <label
                    htmlFor="verify-contact-input"
                    className="block text-xs font-medium uppercase tracking-wider text-[#525252] mb-1.5"
                  >
                    {verifyType === 'email' ? 'New Email Address' : 'New Phone Number'}
                  </label>
                  <input
                    id="verify-contact-input"
                    type={verifyType === 'email' ? 'email' : 'tel'}
                    required
                    value={verifyNewValue}
                    onChange={(e) => setVerifyNewValue(e.target.value)}
                    placeholder={
                      verifyType === 'email' ? 'new@example.com' : '+91 98765 43210'
                    }
                    className="w-full px-3.5 py-2.5 border border-[#D4D4D4] text-sm text-[#0A0A0A] focus:outline-none focus:border-[#0A0A0A]"
                  />
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setVerifyType(null)}
                    className="px-4 py-2 border border-[#D4D4D4] text-xs font-medium uppercase tracking-wider text-[#525252]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={verifyingContact}
                    className="px-4 py-2 bg-[#0A0A0A] text-white text-xs font-medium uppercase tracking-wider disabled:opacity-50"
                  >
                    {verifyingContact ? 'Sending...' : 'Send Verification Code'}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleConfirmVerificationCode} className="space-y-4">
                <div>
                  <label
                    htmlFor="verify-code-input"
                    className="block text-xs font-medium uppercase tracking-wider text-[#525252] mb-1.5"
                  >
                    Enter 6-Digit Verification Code
                  </label>
                  <input
                    id="verify-code-input"
                    type="text"
                    required
                    value={verifyCodeInput}
                    onChange={(e) => setVerifyCodeInput(e.target.value)}
                    placeholder="123456"
                    className="w-full px-3.5 py-2.5 border border-[#D4D4D4] font-mono text-sm text-[#0A0A0A] focus:outline-none focus:border-[#0A0A0A]"
                  />
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setVerifyType(null)}
                    className="px-4 py-2 border border-[#D4D4D4] text-xs font-medium uppercase tracking-wider text-[#525252]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={verifyingContact}
                    className="px-4 py-2 bg-[#0A0A0A] text-white text-xs font-medium uppercase tracking-wider disabled:opacity-50"
                  >
                    {verifyingContact ? 'Verifying...' : 'Verify & Update'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PortalProfileView;
