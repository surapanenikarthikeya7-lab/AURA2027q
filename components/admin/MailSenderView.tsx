/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Mail, Send } from 'lucide-react';
import type { EmailSettingsDto, OrderNotificationRecord } from './adminTypes';

interface MailSenderViewProps {
  token: string;
  onNotify: (type: 'success' | 'error', message: string) => void;
}

const MailSenderView: React.FC<MailSenderViewProps> = ({ token, onNotify }) => {
  const [settings, setSettings] = useState<EmailSettingsDto | null>(null);
  const [notifications, setNotifications] = useState<OrderNotificationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);

  const [senderName, setSenderName] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [provider, setProvider] = useState<'smtp' | 'resend'>('smtp');
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [smtpPass, setSmtpPass] = useState('');
  const [resendApiKey, setResendApiKey] = useState('');
  const [testEmail, setTestEmail] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [cfgResp, notifResp] = await Promise.all([
        fetch('/api/admin/settings/email', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/admin/notifications', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      const cfgData = await cfgResp.json().catch(() => ({}));
      const notifData = await notifResp.json().catch(() => ({}));
      if (!cfgResp.ok) throw new Error(cfgData.error || 'Failed to load mail settings.');

      const s: EmailSettingsDto = cfgData.emailSettings;
      setSettings(s);
      setSenderName(s.senderName || '');
      setSenderEmail(s.senderEmail || '');
      setProvider(s.provider === 'resend' ? 'resend' : 'smtp');
      setSmtpHost(s.smtpHost || '');
      setSmtpPort(String(s.smtpPort || 587));
      setSmtpUser(s.smtpUser || '');
      setSmtpSecure(Boolean(s.smtpSecure));
      setNotifications(notifData.notifications || []);
    } catch (err: any) {
      onNotify('error', err?.message || 'Unable to load mail sender configuration.');
    } finally {
      setLoading(false);
    }
  }, [token, onNotify]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const resp = await fetch('/api/admin/settings/email', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          senderName: senderName.trim(),
          senderEmail: senderEmail.trim(),
          provider,
          smtpHost: smtpHost.trim(),
          smtpPort: Number(smtpPort || 587),
          smtpUser: smtpUser.trim(),
          smtpSecure,
          ...(smtpPass.trim() ? { smtpPass: smtpPass.trim() } : {}),
          ...(resendApiKey.trim() ? { resendApiKey: resendApiKey.trim() } : {}),
        }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.error || 'Failed to save mail settings.');
      setSettings(data.emailSettings);
      setSmtpPass('');
      setResendApiKey('');
      onNotify('success', 'Mail Sender configuration saved securely on the server.');
    } catch (err: any) {
      onNotify('error', err?.message || 'Unable to save mail settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testEmail.trim()) {
      onNotify('error', 'Enter a recipient email address for the test email.');
      return;
    }
    setSendingTest(true);
    try {
      const resp = await fetch('/api/admin/settings/email/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ testEmail: testEmail.trim() }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.error || 'Test email request failed.');

      if (data.deliveryStatus === 'sent') {
        onNotify('success', `Test email delivered to ${data.recipientEmail}.`);
      } else if (data.deliveryStatus === 'failed') {
        onNotify('error', data.errorMessage || 'Test email delivery failed.');
      } else {
        onNotify(
          'success',
          'Test email formatted and logged in notification history (configure SMTP/Resend credentials for live inbox delivery).'
        );
      }
      await loadData();
    } catch (err: any) {
      onNotify('error', err?.message || 'Unable to send test email.');
    } finally {
      setSendingTest(false);
    }
  };

  if (loading) {
    return <div className="h-72 bg-white border border-[#E5E5E5] animate-pulse" />;
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Mail Sender Configuration Form */}
        <form
          onSubmit={handleSave}
          className="lg:col-span-7 bg-white border border-[#E5E5E5] p-6 md:p-8 space-y-5"
        >
          <div className="border-b border-[#E5E5E5] pb-4">
            <h2 className="text-base font-semibold text-[#0A0A0A]">Mail Sender Configuration</h2>
            <p className="text-xs text-[#737373] mt-1">
              Credentials are encrypted server-side and never exposed to client code.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-[#525252] mb-1.5">
                Sender Name *
              </label>
              <input
                type="text"
                required
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                placeholder="Aura Quiet Living"
                className="w-full px-3.5 py-2.5 border border-[#D4D4D4] text-sm focus:outline-none focus:border-[#0A0A0A]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-[#525252] mb-1.5">
                Sender Email Address *
              </label>
              <input
                type="email"
                required
                value={senderEmail}
                onChange={(e) => setSenderEmail(e.target.value)}
                placeholder="orders@yourdomain.com"
                className="w-full px-3.5 py-2.5 border border-[#D4D4D4] text-sm focus:outline-none focus:border-[#0A0A0A]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-[#525252] mb-1.5">
              Email Service Provider
            </label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value === 'resend' ? 'resend' : 'smtp')}
              className="w-full px-3.5 py-2.5 border border-[#D4D4D4] bg-white text-sm focus:outline-none focus:border-[#0A0A0A]"
            >
              <option value="smtp">SMTP Server (Gmail, Zoho, Postmark, Custom)</option>
              <option value="resend">Resend API</option>
            </select>
          </div>

          {provider === 'smtp' ? (
            <div className="space-y-4 pt-2 border-t border-[#E5E5E5]">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium uppercase tracking-wider text-[#525252] mb-1.5">
                    SMTP Host
                  </label>
                  <input
                    type="text"
                    value={smtpHost}
                    onChange={(e) => setSmtpHost(e.target.value)}
                    placeholder="smtp.gmail.com"
                    className="w-full px-3.5 py-2.5 border border-[#D4D4D4] text-sm focus:outline-none focus:border-[#0A0A0A]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wider text-[#525252] mb-1.5">
                    SMTP Port
                  </label>
                  <input
                    type="number"
                    value={smtpPort}
                    onChange={(e) => setSmtpPort(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-[#D4D4D4] text-sm font-mono tabular-nums focus:outline-none focus:border-[#0A0A0A]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wider text-[#525252] mb-1.5">
                    SMTP Username
                  </label>
                  <input
                    type="text"
                    value={smtpUser}
                    onChange={(e) => setSmtpUser(e.target.value)}
                    placeholder="orders@gmail.com"
                    className="w-full px-3.5 py-2.5 border border-[#D4D4D4] text-sm focus:outline-none focus:border-[#0A0A0A]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wider text-[#525252] mb-1.5">
                    SMTP Password {settings?.hasSmtpPass ? '(Configured)' : ''}
                  </label>
                  <input
                    type="password"
                    value={smtpPass}
                    onChange={(e) => setSmtpPass(e.target.value)}
                    placeholder={
                      settings?.hasSmtpPass ? 'Leave blank to keep existing' : 'Enter SMTP password'
                    }
                    className="w-full px-3.5 py-2.5 border border-[#D4D4D4] text-sm focus:outline-none focus:border-[#0A0A0A]"
                  />
                </div>
              </div>

              <label className="inline-flex items-center gap-2 text-xs text-[#525252] cursor-pointer">
                <input
                  type="checkbox"
                  checked={smtpSecure}
                  onChange={(e) => setSmtpSecure(e.target.checked)}
                  className="accent-[#0A0A0A]"
                />
                Use SSL/TLS immediately (Port 465)
              </label>
            </div>
          ) : (
            <div className="pt-2 border-t border-[#E5E5E5]">
              <label className="block text-xs font-medium uppercase tracking-wider text-[#525252] mb-1.5">
                Resend API Key {settings?.hasResendKey ? '(Configured)' : ''}
              </label>
              <input
                type="password"
                value={resendApiKey}
                onChange={(e) => setResendApiKey(e.target.value)}
                placeholder={
                  settings?.hasResendKey ? 'Leave blank to keep existing key' : 're_...'
                }
                className="w-full px-3.5 py-2.5 border border-[#D4D4D4] text-sm font-mono focus:outline-none focus:border-[#0A0A0A]"
              />
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-[#0A0A0A] text-white text-xs font-medium uppercase tracking-wider hover:bg-[#262626] transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>

        {/* Right Column: Test Email + Automated Triggers */}
        <div className="lg:col-span-5 space-y-6">
          <form onSubmit={handleSendTest} className="bg-white border border-[#E5E5E5] p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-[#0A0A0A]" />
              <h3 className="text-sm font-semibold text-[#0A0A0A]">Send Test Email</h3>
            </div>
            <p className="text-xs text-[#737373]">
              Verify your Mail Sender configuration by dispatching a test message.
            </p>
            <input
              type="email"
              required
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="recipient@gmail.com"
              className="w-full px-3.5 py-2.5 border border-[#D4D4D4] text-sm focus:outline-none focus:border-[#0A0A0A]"
            />
            <button
              type="submit"
              disabled={sendingTest}
              className="inline-flex items-center justify-center gap-2 w-full py-2.5 bg-[#0A0A0A] text-white text-xs font-medium uppercase tracking-wider hover:bg-[#262626] disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              {sendingTest ? 'Sending Test...' : 'Send Test Email'}
            </button>
          </form>

          <div className="bg-white border border-[#E5E5E5] p-6 space-y-3">
            <h3 className="text-sm font-semibold text-[#0A0A0A]">Automated Customer Emails</h3>
            <p className="text-xs text-[#737373]">
              Sent automatically with website logo, customer name, products, order ID, amount, status, and contact details:
            </p>
            <ul className="space-y-2 text-xs text-[#404040] pt-1">
              <li>1. Order Confirmation — On checkout booking</li>
              <li>2. Payment Confirmation — On UPI payment verification</li>
              <li>3. Order Cancellation — When an order is cancelled</li>
              <li>4. Order Status Update — On workflow status changes</li>
              <li>5. Refund Notification — When refund is initiated/completed</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Email Dispatch Log */}
      <div className="bg-white border border-[#E5E5E5] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E5E5E5] flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[#0A0A0A]">
            Recent Email Notifications ({notifications.length})
          </h3>
        </div>
        {notifications.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#737373]">
            No email notifications logged yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E5E5E5] bg-[#FAFAFA] text-[11px] font-medium uppercase tracking-wider text-[#737373]">
                  <th className="py-3 px-6">Order / Ref</th>
                  <th className="py-3 px-4">Event</th>
                  <th className="py-3 px-4">Recipient</th>
                  <th className="py-3 px-4">Subject</th>
                  <th className="py-3 px-4">Delivery</th>
                  <th className="py-3 px-6 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E5E5] text-xs">
                {notifications.map((n) => (
                  <tr key={n.id} className="hover:bg-[#FAFAFA]">
                    <td className="py-3 px-6 font-mono text-[#0A0A0A]">#{n.orderNumber}</td>
                    <td className="py-3 px-4 capitalize text-[#404040]">
                      {n.eventType.replace(/_/g, ' ')}
                    </td>
                    <td className="py-3 px-4 text-[#525252]">{n.recipientEmail}</td>
                    <td className="py-3 px-4 text-[#0A0A0A] max-w-xs truncate">{n.subject}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`font-medium uppercase ${
                          n.deliveryStatus === 'sent'
                            ? 'text-[#16A34A]'
                            : n.deliveryStatus === 'failed'
                              ? 'text-[#DC2626]'
                              : 'text-[#D97706]'
                        }`}
                      >
                        {n.deliveryStatus}
                      </span>
                      {n.errorMessage && (
                        <div className="text-[11px] text-[#DC2626] truncate max-w-[180px]">
                          {n.errorMessage}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-6 text-right text-[#737373] tabular-nums whitespace-nowrap">
                      {new Date(n.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default MailSenderView;
