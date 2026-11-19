/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowUpRight,
  DatabaseBackup,
  Package,
  ShoppingBag,
  Users,
  Wallet,
} from 'lucide-react';
import type { AdminSection, DashboardData } from './adminTypes';

interface DashboardOverviewViewProps {
  token: string;
  onNavigate: (section: AdminSection) => void;
  onNotify: (type: 'success' | 'error', message: string) => void;
  onDownloadBackup: () => Promise<void>;
}

const DashboardOverviewView: React.FC<DashboardOverviewViewProps> = ({
  token,
  onNavigate,
  onNotify,
  onDownloadBackup,
}) => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetch('/api/admin/dashboard', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(json.error || 'Failed to load dashboard.');
      setData(json);
    } catch (err: any) {
      onNotify('error', err?.message || 'Unable to load dashboard overview.');
    } finally {
      setLoading(false);
    }
  }, [token, onNotify]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-white border border-[#E5E5E5] animate-pulse" />
          ))}
        </div>
        <div className="h-64 bg-white border border-[#E5E5E5] animate-pulse" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-white border border-[#E5E5E5] p-8 text-center">
        <p className="text-sm text-[#525252] mb-4">Unable to load dashboard metrics.</p>
        <button
          type="button"
          onClick={loadDashboard}
          className="px-4 py-2 bg-[#0A0A0A] text-white text-xs uppercase tracking-wider"
        >
          Retry
        </button>
      </div>
    );
  }

  const maxDayRevenue = Math.max(
    1,
    ...data.revenueOverview.map((d) => d.revenue)
  );

  return (
    <div className="space-y-8">
      {/* Quick Action Bar */}
      <div className="bg-white border border-[#E5E5E5] p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-[#0A0A0A]">Quick Actions</h2>
          <p className="text-xs text-[#737373]">
            Manage store inventory, verify customer UPI payments, or export database backups.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => onNavigate('products')}
            className="px-4 py-2 bg-[#0A0A0A] text-white text-xs font-medium uppercase tracking-wider hover:bg-[#262626] whitespace-nowrap"
          >
            Add / Edit Products
          </button>
          <button
            type="button"
            onClick={() => onNavigate('orders')}
            className="px-4 py-2 border border-[#D4D4D4] text-xs font-medium uppercase tracking-wider text-[#0A0A0A] hover:border-[#0A0A0A] whitespace-nowrap"
          >
            Review Orders
          </button>
          <button
            type="button"
            onClick={() => onNavigate('payment')}
            className="px-4 py-2 border border-[#D4D4D4] text-xs font-medium uppercase tracking-wider text-[#0A0A0A] hover:border-[#0A0A0A] whitespace-nowrap"
          >
            UPI Settings
          </button>
          <button
            type="button"
            onClick={onDownloadBackup}
            className="inline-flex items-center gap-1.5 px-4 py-2 border border-[#D4D4D4] text-xs font-medium uppercase tracking-wider text-[#0A0A0A] hover:border-[#0A0A0A] whitespace-nowrap"
          >
            <DatabaseBackup className="w-3.5 h-3.5" />
            Database Backup
          </button>
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E5E5E5] p-5">
          <div className="flex items-center justify-between text-xs uppercase tracking-wider text-[#737373] mb-3">
            <span>Total Revenue</span>
            <Wallet className="w-4 h-4 text-[#0A0A0A]" />
          </div>
          <div className="text-2xl font-semibold font-mono tabular-nums text-[#0A0A0A]">
            ₹{data.stats.totalRevenue}
          </div>
          <p className="text-xs text-[#737373] mt-1.5 tabular-nums">
            ₹{data.stats.pendingVerificationAmount} awaiting verification
          </p>
        </div>

        <div className="bg-white border border-[#E5E5E5] p-5">
          <div className="flex items-center justify-between text-xs uppercase tracking-wider text-[#737373] mb-3">
            <span>Total Orders</span>
            <ShoppingBag className="w-4 h-4 text-[#0A0A0A]" />
          </div>
          <div className="text-2xl font-semibold font-mono tabular-nums text-[#0A0A0A]">
            {data.stats.totalOrders}
          </div>
          <p className="text-xs text-[#737373] mt-1.5 tabular-nums">
            {data.stats.pendingOrders} pending · {data.stats.confirmedOrders} confirmed ·{' '}
            {data.stats.cancelledOrders} cancelled
          </p>
        </div>

        <div className="bg-white border border-[#E5E5E5] p-5">
          <div className="flex items-center justify-between text-xs uppercase tracking-wider text-[#737373] mb-3">
            <span>Total Products</span>
            <Package className="w-4 h-4 text-[#0A0A0A]" />
          </div>
          <div className="text-2xl font-semibold font-mono tabular-nums text-[#0A0A0A]">
            {data.stats.totalProducts}
          </div>
          <p className="text-xs text-[#737373] mt-1.5">Active storefront catalog</p>
        </div>

        <div className="bg-white border border-[#E5E5E5] p-5">
          <div className="flex items-center justify-between text-xs uppercase tracking-wider text-[#737373] mb-3">
            <span>Total Customers</span>
            <Users className="w-4 h-4 text-[#0A0A0A]" />
          </div>
          <div className="text-2xl font-semibold font-mono tabular-nums text-[#0A0A0A]">
            {data.stats.totalCustomers}
          </div>
          <p className="text-xs text-[#737373] mt-1.5">Registered from checkouts</p>
        </div>
      </div>

      {/* Order Status Breakdown Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-[#E5E5E5] p-5 flex items-center justify-between">
          <div>
            <span className="block text-xs uppercase tracking-wider text-[#737373]">
              Pending Orders
            </span>
            <span className="text-xl font-semibold font-mono tabular-nums text-[#D97706]">
              {data.stats.pendingOrders}
            </span>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('orders')}
            className="text-xs text-[#0A0A0A] hover:underline inline-flex items-center gap-1"
          >
            Review <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="bg-white border border-[#E5E5E5] p-5 flex items-center justify-between">
          <div>
            <span className="block text-xs uppercase tracking-wider text-[#737373]">
              Confirmed Orders
            </span>
            <span className="text-xl font-semibold font-mono tabular-nums text-[#16A34A]">
              {data.stats.confirmedOrders}
            </span>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('orders')}
            className="text-xs text-[#0A0A0A] hover:underline inline-flex items-center gap-1"
          >
            View <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="bg-white border border-[#E5E5E5] p-5 flex items-center justify-between">
          <div>
            <span className="block text-xs uppercase tracking-wider text-[#737373]">
              Cancelled Orders
            </span>
            <span className="text-xl font-semibold font-mono tabular-nums text-[#DC2626]">
              {data.stats.cancelledOrders}
            </span>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('orders')}
            className="text-xs text-[#0A0A0A] hover:underline inline-flex items-center gap-1"
          >
            Inspect <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Revenue Overview (Last 7 Days) + Latest Products */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-[#E5E5E5] p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm font-semibold text-[#0A0A0A]">Revenue Overview</h3>
              <p className="text-xs text-[#737373]">
                Verified revenue across the last 7 days (₹ INR)
              </p>
            </div>
            <span className="text-xs font-mono tabular-nums text-[#525252]">
              Total: ₹{data.stats.totalRevenue}
            </span>
          </div>

          <div className="grid grid-cols-7 gap-3 items-end h-44 pt-4 border-b border-[#E5E5E5]">
            {data.revenueOverview.map((day) => {
              const heightPct =
                day.revenue > 0 ? Math.max(10, Math.round((day.revenue / maxDayRevenue) * 100)) : 4;
              return (
                <div key={day.date} className="flex flex-col items-center gap-2 h-full justify-end">
                  <span className="text-[10px] font-mono tabular-nums text-[#525252]">
                    {day.revenue > 0 ? `₹${day.revenue}` : '—'}
                  </span>
                  <div
                    className={`w-full max-w-[36px] transition-all ${
                      day.revenue > 0 ? 'bg-[#0A0A0A]' : 'bg-[#E5E5E5]'
                    }`}
                    style={{ height: `${heightPct}%` }}
                    title={`${day.date}: ₹${day.revenue} (${day.orders} orders)`}
                  />
                </div>
              );
            })}
          </div>
          <div className="grid grid-cols-7 gap-3 pt-2 text-center">
            {data.revenueOverview.map((day) => (
              <div key={day.date} className="text-[10px] font-mono text-[#737373] tabular-nums">
                {day.date.slice(5)}
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-5 bg-white border border-[#E5E5E5] p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-semibold text-[#0A0A0A]">Latest Products</h3>
            <button
              type="button"
              onClick={() => onNavigate('products')}
              className="text-xs text-[#525252] hover:text-[#0A0A0A] underline underline-offset-4"
            >
              Manage All
            </button>
          </div>
          <div className="divide-y divide-[#E5E5E5]">
            {data.latestProducts.map((p) => (
              <div key={p.id} className="py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={p.imageUrl}
                    alt={p.name}
                    referrerPolicy="no-referrer"
                    className="w-10 h-10 object-cover bg-[#F5F5F5] border border-[#E5E5E5] shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-[#0A0A0A] truncate">{p.name}</p>
                    <p className="text-[11px] text-[#737373]">
                      {p.category} · {p.availability || 'Available'}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-mono tabular-nums font-medium text-[#0A0A0A] shrink-0">
                  ₹{p.price}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Orders Table */}
      <div className="bg-white border border-[#E5E5E5] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E5E5E5] flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[#0A0A0A]">Recent Orders</h3>
          <button
            type="button"
            onClick={() => onNavigate('orders')}
            className="text-xs text-[#525252] hover:text-[#0A0A0A] underline underline-offset-4"
          >
            View All Orders
          </button>
        </div>

        {data.recentOrders.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#737373]">
            No customer orders placed yet. Orders submitted at checkout will appear here automatically.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E5E5E5] bg-[#FAFAFA] text-[11px] font-medium uppercase tracking-wider text-[#737373]">
                  <th className="py-3 px-6">Order ID</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Payment</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-6 text-right">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E5E5] text-xs">
                {data.recentOrders.map((o) => (
                  <tr key={o.id} className="hover:bg-[#FAFAFA]">
                    <td className="py-3 px-6 font-mono font-medium text-[#0A0A0A]">
                      #{o.orderNumber}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-[#0A0A0A]">{o.customerName}</div>
                      <div className="text-[#737373]">{o.customerEmail}</div>
                    </td>
                    <td className="py-3 px-4 text-[#404040]">{o.paymentStatus}</td>
                    <td className="py-3 px-4 text-[#404040]">{o.orderStatus}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-medium text-[#0A0A0A]">
                      ₹{o.totalAmount}
                    </td>
                    <td className="py-3 px-6 text-right text-[#737373] tabular-nums">
                      {new Date(o.createdAt).toLocaleDateString()}
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

export default DashboardOverviewView;
