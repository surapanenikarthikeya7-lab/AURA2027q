/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { CreditCard } from 'lucide-react';

interface PaymentSettingsViewProps {
  token: string;
  onNotify: (type: 'success' | 'error', message: string) => void;
  onStorefrontUpdated: () => Promise<void>;
}

const UPI_REGEX = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;

const PaymentSettingsView: React.FC<PaymentSettingsViewProps> = ({
  token,
  onNotify,
  onStorefrontUpdated,
}) => {
  const [currentUpiId, setCurrentUpiId] = useState('');
  const [currentReceiver, setCurrentReceiver] = useState('');
  const [upiId, setUpiId] = useState('');
  const [upiReceiverName, setUpiReceiverName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetch('/api/admin/settings/payment', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.error || 'Failed to load payment settings.');
      setCurrentUpiId(data.upiId || '');
      setCurrentReceiver(data.upiReceiverName || '');
      setUpiId(data.upiId || '');
      setUpiReceiverName(data.upiReceiverName || '');
    } catch (err: any) {
      onNotify('error', err?.message || 'Unable to load payment settings.');
    } finally {
      setLoading(false);
    }
  }, [token, onNotify]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUpi = upiId.trim();
    const cleanReceiver = upiReceiverName.trim();
    if (!UPI_REGEX.test(cleanUpi)) {
      onNotify('error', 'Please enter a valid UPI ID (e.g. name@bank or 9290317064@fam).');
      return;
    }
    if (!cleanReceiver) {
      onNotify('error', 'Payment receiver name is required.');
      return;
    }

    setSaving(true);
    try {
      const resp = await fetch('/api/admin/settings/payment', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          upiId: cleanUpi,
          upiReceiverName: cleanReceiver,
        }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.error || 'Failed to save UPI settings.');
      setCurrentUpiId(data.upiId);
      setCurrentReceiver(data.upiReceiverName);
      onNotify('success', 'UPI payment settings updated and synced to customer checkout.');
      await onStorefrontUpdated();
    } catch (err: any) {
      onNotify('error', err?.message || 'Unable to save UPI settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="h-64 bg-white border border-[#E5E5E5] animate-pulse" />;
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Current Active UPI Banner */}
      <div className="bg-white border border-[#E5E5E5] p-6 flex items-start justify-between gap-4">
        <div>
          <span className="block text-[11px] font-medium uppercase tracking-wider text-[#737373] mb-1">
            Active Customer Checkout UPI ID
          </span>
          <p className="text-xl font-mono font-semibold text-[#0A0A0A] select-all">
            {currentUpiId}
          </p>
          <p className="text-xs text-[#525252] mt-1">
            Receiver Name: <span className="font-medium text-[#0A0A0A]">{currentReceiver}</span>
          </p>
        </div>
        <div className="w-10 h-10 bg-[#0A0A0A] text-white flex items-center justify-center shrink-0">
          <CreditCard className="w-5 h-5" />
        </div>
      </div>

      {/* Edit Form */}
      <form onSubmit={handleSave} className="bg-white border border-[#E5E5E5] p-6 md:p-8 space-y-6">
        <div className="border-b border-[#E5E5E5] pb-4">
          <h2 className="text-base font-semibold text-[#0A0A0A]">Update UPI Payment Settings</h2>
          <p className="text-xs text-[#737373] mt-1">
            Changes saved here immediately update the UPI ID shown during customer checkout.
          </p>
        </div>

        <div>
          <label
            htmlFor="upi-id-input"
            className="block text-xs font-medium uppercase tracking-wider text-[#525252] mb-2"
          >
            UPI Payment ID *
          </label>
          <input
            id="upi-id-input"
            type="text"
            required
            value={upiId}
            onChange={(e) => setUpiId(e.target.value)}
            placeholder="9290317064@fam"
            className="w-full px-3.5 py-2.5 border border-[#D4D4D4] text-sm font-mono text-[#0A0A0A] focus:outline-none focus:border-[#0A0A0A]"
          />
          <p className="text-[11px] text-[#737373] mt-1.5">
            Format: handle@provider (alphanumeric, dots, hyphens, or underscores before @).
          </p>
        </div>

        <div>
          <label
            htmlFor="upi-receiver-input"
            className="block text-xs font-medium uppercase tracking-wider text-[#525252] mb-2"
          >
            Payment Receiver Name *
          </label>
          <input
            id="upi-receiver-input"
            type="text"
            required
            value={upiReceiverName}
            onChange={(e) => setUpiReceiverName(e.target.value)}
            placeholder="Aura Quiet Living"
            className="w-full px-3.5 py-2.5 border border-[#D4D4D4] text-sm text-[#0A0A0A] focus:outline-none focus:border-[#0A0A0A]"
          />
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-[#0A0A0A] text-white text-xs font-medium uppercase tracking-wider hover:bg-[#262626] transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Updated UPI ID'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default PaymentSettingsView;
