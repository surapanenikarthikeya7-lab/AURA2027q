/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, Download, Eye, Search, X, XCircle } from 'lucide-react';
import type { OrderRecord } from './adminTypes';

interface CustomerOrdersViewProps {
  token: string;
  onNotify: (type: 'success' | 'error', message: string) => void;
}

const ORDER_STATUS_OPTIONS = [
  'Pending',
  'Payment Verification',
  'Confirmed',
  'Processing',
  'Completed',
  'Cancelled',
  'Refund Initiated',
  'Refunded',
];

const PAYMENT_STATUS_OPTIONS = [
  'All',
  'Verification Pending',
  'Paid',
  'Failed',
  'Refund Initiated',
  'Refunded',
];

function getStatusColorClass(status: string): string {
  switch (status) {
    case 'Paid':
    case 'Verified':
    case 'Confirmed':
    case 'Completed':
      return 'text-[#16A34A]';
    case 'Verification Pending':
    case 'Pending Verification':
    case 'Payment Verification':
    case 'Pending':
    case 'Processing':
    case 'Refund Initiated':
      return 'text-[#D97706]';
    case 'Cancelled':
    case 'Failed':
    case 'Rejected':
    case 'Refunded':
      return 'text-[#DC2626]';
    default:
      return 'text-[#525252]';
  }
}

const CustomerOrdersView: React.FC<CustomerOrdersViewProps> = ({ token, onNotify }) => {
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<OrderRecord | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<number | null>(null);

  const buildFilterQuery = useCallback(() => {
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.set('q', searchQuery.trim());
    if (paymentStatusFilter !== 'All') params.set('paymentStatus', paymentStatusFilter);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    return params.toString();
  }, [searchQuery, paymentStatusFilter, dateFrom, dateTo]);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const qs = buildFilterQuery();
      const resp = await fetch(`/api/admin/orders${qs ? `?${qs}` : ''}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.error || 'Failed to load orders.');
      setOrders(data.orders || []);
    } catch (err: any) {
      onNotify('error', err?.message || 'Unable to load customer orders.');
    } finally {
      setLoading(false);
    }
  }, [token, buildFilterQuery, onNotify]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const openOrderDetails = async (orderId: number) => {
    try {
      const resp = await fetch(`/api/admin/orders/${orderId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.error || 'Failed to fetch order details.');
      setSelectedOrder(data.order);
    } catch (err: any) {
      onNotify('error', err?.message || 'Unable to load order details.');
    }
  };

  const handleVerifyPayment = async (orderId: number, action: 'verify' | 'reject') => {
    setUpdatingOrderId(orderId);
    try {
      const resp = await fetch(`/api/admin/orders/${orderId}/verify-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.error || 'Payment verification failed.');
      onNotify(
        'success',
        action === 'verify'
          ? `Payment verified for #${data.order.orderNumber}. Confirmation email processed.`
          : `Payment rejected for #${data.order.orderNumber}.`
      );
      await loadOrders();
      if (selectedOrder?.id === orderId) {
        await openOrderDetails(orderId);
      }
    } catch (err: any) {
      onNotify('error', err?.message || 'Unable to update payment status.');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleStatusChange = async (orderId: number, orderStatus: string) => {
    setUpdatingOrderId(orderId);
    try {
      const resp = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ orderStatus }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.error || 'Failed to update order status.');
      onNotify(
        'success',
        `Order #${data.order.orderNumber} updated to "${orderStatus}". Customer email processed.`
      );
      await loadOrders();
      if (selectedOrder?.id === orderId) {
        await openOrderDetails(orderId);
      }
    } catch (err: any) {
      onNotify('error', err?.message || 'Unable to update order status.');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleExport = async (format: 'csv' | 'xls') => {
    try {
      const qs = buildFilterQuery();
      const url = `/api/admin/orders/export?format=${format}${qs ? `&${qs}` : ''}`;
      const resp = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) {
        throw new Error('Failed to export orders.');
      }
      const blob = await resp.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = `orders-${new Date().toISOString().slice(0, 10)}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objUrl);
      onNotify('success', `Exported orders as ${format.toUpperCase()}.`);
    } catch (err: any) {
      onNotify('error', err?.message || 'Export failed.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Search, Filters & Export Bar */}
      <div className="bg-white border border-[#E5E5E5] p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          <div className="md:col-span-4">
            <label className="block text-[11px] font-medium uppercase tracking-wider text-[#737373] mb-1.5">
              Search Customer or Order ID
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-[#737373] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Name, Order ID, Email, or Txn Ref..."
                className="w-full pl-9 pr-3 py-2 border border-[#D4D4D4] text-sm focus:outline-none focus:border-[#0A0A0A]"
              />
            </div>
          </div>

          <div className="md:col-span-3">
            <label className="block text-[11px] font-medium uppercase tracking-wider text-[#737373] mb-1.5">
              Payment Status
            </label>
            <select
              value={paymentStatusFilter}
              onChange={(e) => setPaymentStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-[#D4D4D4] bg-white text-sm focus:outline-none focus:border-[#0A0A0A]"
            >
              {PAYMENT_STATUS_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-[11px] font-medium uppercase tracking-wider text-[#737373] mb-1.5">
              From Date
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 border border-[#D4D4D4] text-sm focus:outline-none focus:border-[#0A0A0A]"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-[11px] font-medium uppercase tracking-wider text-[#737373] mb-1.5">
              To Date
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-2 border border-[#D4D4D4] text-sm focus:outline-none focus:border-[#0A0A0A]"
            />
          </div>

          <div className="md:col-span-1 flex justify-end">
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setPaymentStatusFilter('All');
                setDateFrom('');
                setDateTo('');
              }}
              className="w-full py-2 px-3 border border-[#D4D4D4] text-xs font-medium text-[#525252] hover:border-[#0A0A0A] hover:text-[#0A0A0A]"
            >
              Reset
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#E5E5E5]">
          <span className="text-xs text-[#737373] tabular-nums">
            Showing {orders.length} customer {orders.length === 1 ? 'order' : 'orders'}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleExport('csv')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-[#D4D4D4] text-xs font-medium uppercase tracking-wider text-[#0A0A0A] hover:border-[#0A0A0A] whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
            <button
              type="button"
              onClick={() => handleExport('xls')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#0A0A0A] text-white text-xs font-medium uppercase tracking-wider hover:bg-[#262626] whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              Export Excel
            </button>
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white border border-[#E5E5E5] overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3].map((r) => (
              <div key={r} className="h-12 bg-[#F5F5F5] animate-pulse" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="p-12 text-center text-sm text-[#525252]">
            No customer orders found matching the selected filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E5E5E5] bg-[#FAFAFA] text-[11px] font-medium uppercase tracking-wider text-[#737373]">
                  <th className="py-3 px-4">Order ID</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Items</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4 text-right">Amount (₹)</th>
                  <th className="py-3 px-4">Payment</th>
                  <th className="py-3 px-4">Order Status</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E5E5] text-xs">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-[#FAFAFA] transition-colors">
                    <td className="py-3.5 px-4 font-mono font-medium text-[#0A0A0A] whitespace-nowrap">
                      #{order.orderNumber}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-[#0A0A0A]">{order.customerName}</div>
                      <div className="text-[#737373] font-mono text-[11px]">
                        Ref: {order.transactionReference}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-[#404040] max-w-[200px]">
                      {order.items.map((i) => `${i.name} ×${i.quantity}`).join(', ')}
                    </td>
                    <td className="py-3.5 px-4 text-[#525252]">
                      <div>{order.customerEmail}</div>
                      <div className="tabular-nums text-[#737373]">{order.customerPhone || '—'}</div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums font-medium text-[#0A0A0A] whitespace-nowrap">
                      ₹{order.totalAmount}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className={`font-medium ${getStatusColorClass(order.paymentStatus)}`}>
                        {order.paymentStatus}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <select
                        value={order.orderStatus}
                        disabled={updatingOrderId === order.id}
                        onChange={(e) => handleStatusChange(order.id, e.target.value)}
                        aria-label={`Order status for ${order.orderNumber}`}
                        className="px-2 py-1.5 border border-[#D4D4D4] bg-white text-xs text-[#0A0A0A] focus:outline-none focus:border-[#0A0A0A]"
                      >
                        {ORDER_STATUS_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3.5 px-4 text-[#737373] tabular-nums whitespace-nowrap">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        {order.paymentStatus === 'Verification Pending' && (
                          <button
                            type="button"
                            disabled={updatingOrderId === order.id}
                            onClick={() => handleVerifyPayment(order.id, 'verify')}
                            className="px-2.5 py-1.5 bg-[#0A0A0A] text-white text-[11px] font-medium uppercase tracking-wider hover:bg-[#262626] disabled:opacity-50"
                          >
                            Verify Paid
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openOrderDetails(order.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-[#D4D4D4] text-[11px] font-medium text-[#0A0A0A] hover:border-[#0A0A0A]"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Details
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

      {/* Individual Order Details Modal */}
      {selectedOrder && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-[#E5E5E5] max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-[#E5E5E5] flex items-center justify-between sticky top-0 bg-white">
              <div>
                <p className="text-[11px] uppercase tracking-widest text-[#737373]">Order Details</p>
                <h3 className="text-lg font-semibold text-[#0A0A0A] font-mono">
                  #{selectedOrder.orderNumber}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                aria-label="Close order details"
                className="p-2 text-[#737373] hover:text-[#0A0A0A]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-5 border-b border-[#E5E5E5]">
                <div>
                  <span className="block text-[11px] uppercase tracking-wider text-[#737373]">
                    Customer
                  </span>
                  <p className="font-medium text-[#0A0A0A]">{selectedOrder.customerName}</p>
                  <p className="text-xs text-[#525252]">{selectedOrder.customerEmail}</p>
                  <p className="text-xs text-[#525252] tabular-nums">
                    {selectedOrder.customerPhone || 'No phone provided'}
                  </p>
                </div>
                <div>
                  <span className="block text-[11px] uppercase tracking-wider text-[#737373]">
                    Shipping Address
                  </span>
                  <p className="text-xs text-[#404040] leading-relaxed">
                    {selectedOrder.shippingAddress}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-5 border-b border-[#E5E5E5]">
                <div>
                  <span className="block text-[11px] uppercase tracking-wider text-[#737373]">
                    UPI Receiver ID
                  </span>
                  <p className="font-mono text-xs text-[#0A0A0A] mt-0.5">{selectedOrder.upiId}</p>
                </div>
                <div>
                  <span className="block text-[11px] uppercase tracking-wider text-[#737373]">
                    Transaction Reference
                  </span>
                  <p className="font-mono text-xs font-semibold text-[#0A0A0A] mt-0.5">
                    {selectedOrder.transactionReference}
                  </p>
                </div>
                <div>
                  <span className="block text-[11px] uppercase tracking-wider text-[#737373]">
                    Payment Verification
                  </span>
                  <p
                    className={`text-xs font-semibold mt-0.5 ${getStatusColorClass(
                      selectedOrder.paymentStatus
                    )}`}
                  >
                    {selectedOrder.paymentStatus}
                  </p>
                </div>
              </div>

              {/* Items */}
              <div>
                <span className="block text-[11px] uppercase tracking-wider text-[#737373] mb-3">
                  Ordered Items
                </span>
                <div className="border border-[#E5E5E5] divide-y divide-[#E5E5E5]">
                  {selectedOrder.items.map((item, idx) => (
                    <div key={`${item.id}-${idx}`} className="flex items-center justify-between p-3">
                      <div>
                        <p className="font-medium text-[#0A0A0A]">{item.name}</p>
                        <p className="text-xs text-[#737373] tabular-nums">
                          Qty {item.quantity} × ₹{item.price}
                        </p>
                      </div>
                      <span className="font-mono tabular-nums font-medium text-[#0A0A0A]">
                        ₹{item.price * item.quantity}
                      </span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between p-3 bg-[#FAFAFA] font-semibold">
                    <span>Total Amount</span>
                    <span className="font-mono tabular-nums">₹{selectedOrder.totalAmount}</span>
                  </div>
                </div>
              </div>

              {/* Admin Verification & Status Actions */}
              <div className="p-4 border border-[#E5E5E5] bg-[#FAFAFA] space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-[#0A0A0A]">
                      Payment & Order Controls
                    </p>
                    <p className="text-[11px] text-[#737373]">
                      Verify the UPI transaction reference in your bank/UPI app before marking Paid.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={
                        updatingOrderId === selectedOrder.id ||
                        selectedOrder.paymentStatus === 'Paid'
                      }
                      onClick={() => handleVerifyPayment(selectedOrder.id, 'verify')}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#0A0A0A] text-white text-xs font-medium uppercase tracking-wider hover:bg-[#262626] disabled:opacity-40"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Verify & Mark Paid
                    </button>
                    {selectedOrder.orderStatus !== 'Cancelled' && (
                      <button
                        type="button"
                        disabled={updatingOrderId === selectedOrder.id}
                        onClick={() => handleStatusChange(selectedOrder.id, 'Cancelled')}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-[#DC2626] text-[#DC2626] text-xs font-medium uppercase tracking-wider hover:bg-[#DC2626] hover:text-white disabled:opacity-40"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Cancel Order
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-[#E5E5E5]">
                  <label className="text-xs font-medium text-[#525252]">Update Order Status:</label>
                  <select
                    value={selectedOrder.orderStatus}
                    disabled={updatingOrderId === selectedOrder.id}
                    onChange={(e) => handleStatusChange(selectedOrder.id, e.target.value)}
                    className="px-3 py-1.5 border border-[#D4D4D4] bg-white text-xs focus:outline-none focus:border-[#0A0A0A]"
                  >
                    {ORDER_STATUS_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Order Email Notification Trail */}
              {selectedOrder.notifications && selectedOrder.notifications.length > 0 && (
                <div>
                  <span className="block text-[11px] uppercase tracking-wider text-[#737373] mb-2">
                    Customer Email History
                  </span>
                  <div className="border border-[#E5E5E5] divide-y divide-[#E5E5E5] text-xs">
                    {selectedOrder.notifications.map((n) => (
                      <div key={n.id} className="p-3 flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <p className="font-medium text-[#0A0A0A] truncate">{n.subject}</p>
                          <p className="text-[#737373]">
                            {n.eventType.replace(/_/g, ' ')} · {n.recipientEmail}
                          </p>
                        </div>
                        <span className="uppercase tracking-wider font-medium text-[#525252] shrink-0">
                          {n.deliveryStatus}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerOrdersView;
