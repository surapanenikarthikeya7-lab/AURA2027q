/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  CheckCircle2,
  Clock,
  Eye,
  Package,
  Search,
  X,
  XCircle,
} from 'lucide-react';
import type { CustomerOrderRecord } from './portalTypes';

interface PortalOrdersViewProps {
  token: string;
  highlightedOrderNumber?: string | null;
  onBrowseShop: () => void;
  onNotify: (type: 'success' | 'error', message: string) => void;
}

const TRACKING_STEPS = ['Payment Verification', 'Confirmed', 'Processing', 'Completed'];

const CANCELLABLE_STATUSES = new Set([
  'Pending',
  'Payment Verification',
  'Confirmed',
  'Processing',
]);

const PortalOrdersView: React.FC<PortalOrdersViewProps> = ({
  token,
  highlightedOrderNumber,
  onBrowseShop,
  onNotify,
}) => {
  const [orders, setOrders] = useState<CustomerOrderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedOrder, setSelectedOrder] = useState<CustomerOrderRecord | null>(null);
  const [cancellingOrderNumber, setCancellingOrderNumber] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetch('/api/customer/orders', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.error || 'Failed to load orders.');
      const list: CustomerOrderRecord[] = Array.isArray(data.orders) ? data.orders : [];
      setOrders(list);

      if (highlightedOrderNumber) {
        const match = list.find((o) => o.orderNumber === highlightedOrderNumber);
        if (match) setSelectedOrder(match);
      }
    } catch (err: any) {
      onNotify('error', err?.message || 'Unable to load your booked orders.');
    } finally {
      setLoading(false);
    }
  }, [token, highlightedOrderNumber, onNotify]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const handleCancelOrder = async (orderNumber: string) => {
    setCancellingOrderNumber(orderNumber);
    try {
      const resp = await fetch(
        `/api/customer/orders/${encodeURIComponent(orderNumber)}/cancel`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        }
      );
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.error || 'Failed to cancel order.');
      onNotify('success', `Order #${orderNumber} has been cancelled.`);
      await loadOrders();
      setSelectedOrder((prev) =>
        prev && prev.orderNumber === orderNumber && data.order
          ? { ...prev, ...data.order }
          : prev
      );
    } catch (err: any) {
      onNotify('error', err?.message || 'Unable to cancel order.');
    } finally {
      setCancellingOrderNumber(null);
    }
  };

  const filteredOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return orders.filter((order) => {
      if (statusFilter !== 'All' && order.orderStatus !== statusFilter) return false;
      if (!q) return true;
      return (
        order.orderNumber.toLowerCase().includes(q) ||
        order.transactionReference.toLowerCase().includes(q) ||
        order.items.some((i) => i.name.toLowerCase().includes(q))
      );
    });
  }, [orders, statusFilter, searchQuery]);

  const getStatusColor = (status: string) => {
    if (status === 'Confirmed' || status === 'Completed' || status === 'Paid') {
      return 'text-[#166534]';
    }
    if (status === 'Cancelled' || status === 'Failed' || status === 'Refunded') {
      return 'text-[#991B1B]';
    }
    return 'text-[#B45309]';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[#0A0A0A]">Orders You Booked</h2>
          <p className="text-xs text-[#737373]">
            Track order status, inspect UPI payment verification, or cancel eligible bookings.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-[#737373] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Order ID or product..."
              className="pl-9 pr-3 py-2 border border-[#D4D4D4] bg-white text-xs text-[#0A0A0A] focus:outline-none focus:border-[#0A0A0A]"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter orders by status"
            className="px-3 py-2 border border-[#D4D4D4] bg-white text-xs text-[#0A0A0A] focus:outline-none focus:border-[#0A0A0A]"
          >
            <option value="All">All Statuses</option>
            <option value="Payment Verification">Payment Verification</option>
            <option value="Confirmed">Confirmed</option>
            <option value="Processing">Processing</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-white border border-[#E5E5E5] animate-pulse" />
          ))}
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-white border border-[#E5E5E5] p-12 text-center">
          <Package className="w-8 h-8 text-[#A3A3A3] mx-auto mb-3 stroke-[1.5]" />
          <p className="text-sm font-medium text-[#0A0A0A] mb-1">
            {orders.length === 0 ? 'No orders booked yet' : 'No orders match your filters'}
          </p>
          <p className="text-xs text-[#737373] mb-5">
            {orders.length === 0
              ? 'Orders you place from the store or Customer Portal will appear here.'
              : 'Reset filters to see all your booked orders.'}
          </p>
          <button
            type="button"
            onClick={orders.length === 0 ? onBrowseShop : () => { setSearchQuery(''); setStatusFilter('All'); }}
            className="px-5 py-2.5 bg-[#0A0A0A] text-white text-xs font-medium uppercase tracking-wider hover:bg-[#262626]"
          >
            {orders.length === 0 ? 'Explore Products' : 'Show All Orders'}
          </button>
        </div>
      ) : (
        <div className="bg-white border border-[#E5E5E5] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E5E5E5] bg-[#FAFAFA] text-[11px] font-medium uppercase tracking-wider text-[#737373]">
                  <th className="py-3 px-5">Order ID</th>
                  <th className="py-3 px-4">Product(s)</th>
                  <th className="py-3 px-4">Order Date</th>
                  <th className="py-3 px-4">Payment</th>
                  <th className="py-3 px-4">Order Status</th>
                  <th className="py-3 px-4 text-right">Amount Paid</th>
                  <th className="py-3 px-5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E5E5] text-xs">
                {filteredOrders.map((order) => {
                  const firstItem = order.items[0];
                  const canCancel = CANCELLABLE_STATUSES.has(order.orderStatus);

                  return (
                    <tr key={order.id} className="hover:bg-[#FAFAFA]">
                      <td className="py-3.5 px-5 font-mono font-semibold text-[#0A0A0A] whitespace-nowrap">
                        #{order.orderNumber}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3 min-w-[200px]">
                          {firstItem?.imageUrl && (
                            <img
                              src={firstItem.imageUrl}
                              alt={firstItem.name}
                              referrerPolicy="no-referrer"
                              className="w-10 h-10 object-cover bg-[#F5F5F5] border border-[#E5E5E5] shrink-0"
                            />
                          )}
                          <div className="min-w-0">
                            <div className="font-medium text-[#0A0A0A] truncate">
                              {order.items
                                .map((i) => `${i.name} × ${i.quantity}`)
                                .join(', ')}
                            </div>
                            <div className="text-[11px] text-[#737373] font-mono tabular-nums">
                              Ref: {order.transactionReference}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-[#525252] tabular-nums whitespace-nowrap">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </td>
                      <td className={`py-3.5 px-4 font-medium whitespace-nowrap ${getStatusColor(order.paymentStatus)}`}>
                        {order.paymentStatus}
                      </td>
                      <td className={`py-3.5 px-4 font-medium whitespace-nowrap ${getStatusColor(order.orderStatus)}`}>
                        {order.orderStatus}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-semibold tabular-nums text-[#0A0A0A] whitespace-nowrap">
                        ₹{order.totalAmount}
                      </td>
                      <td className="py-3.5 px-5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedOrder(order)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-[#D4D4D4] text-[11px] font-medium uppercase tracking-wider text-[#0A0A0A] hover:border-[#0A0A0A]"
                          >
                            <Eye className="w-3 h-3" />
                            Details
                          </button>
                          {canCancel && (
                            <button
                              type="button"
                              disabled={cancellingOrderNumber === order.orderNumber}
                              onClick={() => handleCancelOrder(order.orderNumber)}
                              className="px-2.5 py-1.5 border border-[#DC2626]/40 text-[11px] font-medium uppercase tracking-wider text-[#991B1B] hover:bg-[#FEF2F2] disabled:opacity-40"
                            >
                              {cancellingOrderNumber === order.orderNumber
                                ? '...'
                                : 'Cancel'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Order Tracking & Details Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E5E5E5] w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 md:p-8 space-y-6">
            <div className="flex items-start justify-between gap-4 border-b border-[#E5E5E5] pb-4">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-[#737373]">
                  Order Details & Tracking
                </p>
                <h3 className="text-xl font-semibold font-mono text-[#0A0A0A] mt-0.5">
                  #{selectedOrder.orderNumber}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                aria-label="Close order details"
                className="p-1.5 text-[#525252] hover:text-[#0A0A0A]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Order Progress Tracker */}
            <div>
              <h4 className="text-xs font-medium uppercase tracking-wider text-[#525252] mb-3">
                Order Tracking
              </h4>
              {selectedOrder.orderStatus === 'Cancelled' ||
              selectedOrder.orderStatus === 'Refund Initiated' ||
              selectedOrder.orderStatus === 'Refunded' ? (
                <div className="p-4 border border-[#DC2626]/30 bg-[#FEF2F2] flex items-center gap-3 text-xs text-[#991B1B]">
                  <XCircle className="w-4 h-4 shrink-0" />
                  <span>
                    Current Status: <strong>{selectedOrder.orderStatus}</strong>
                  </span>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {TRACKING_STEPS.map((step, idx) => {
                    const currentIdx = TRACKING_STEPS.indexOf(selectedOrder.orderStatus);
                    const done = currentIdx >= idx;
                    return (
                      <div
                        key={step}
                        className={`p-3 border text-xs ${
                          done
                            ? 'border-[#0A0A0A] bg-[#0A0A0A] text-white'
                            : 'border-[#E5E5E5] bg-[#FAFAFA] text-[#737373]'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-mono text-[10px]">0{idx + 1}</span>
                          {done ? (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          ) : (
                            <Clock className="w-3.5 h-3.5" />
                          )}
                        </div>
                        <div className="font-medium truncate">{step}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Payment & Shipping Meta */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs bg-[#FAFAFA] border border-[#E5E5E5] p-4">
              <div>
                <span className="block text-[11px] uppercase tracking-wider text-[#737373]">
                  Payment Status
                </span>
                <span className={`font-semibold ${getStatusColor(selectedOrder.paymentStatus)}`}>
                  {selectedOrder.paymentStatus}
                </span>
                {selectedOrder.payment?.verifiedAt && (
                  <span className="block text-[11px] text-[#737373] mt-0.5 tabular-nums">
                    Verified on {new Date(selectedOrder.payment.verifiedAt).toLocaleString()}
                  </span>
                )}
              </div>
              <div>
                <span className="block text-[11px] uppercase tracking-wider text-[#737373]">
                  UPI & Transaction Ref
                </span>
                <span className="font-mono text-[#0A0A0A]">{selectedOrder.upiId}</span>
                <span className="block font-mono text-[11px] text-[#525252] mt-0.5">
                  Ref: {selectedOrder.transactionReference}
                </span>
              </div>
              <div className="sm:col-span-2">
                <span className="block text-[11px] uppercase tracking-wider text-[#737373]">
                  Shipping Address
                </span>
                <span className="text-[#0A0A0A]">{selectedOrder.shippingAddress}</span>
              </div>
            </div>

            {/* Items */}
            <div>
              <h4 className="text-xs font-medium uppercase tracking-wider text-[#525252] mb-3">
                Items in Order
              </h4>
              <div className="border border-[#E5E5E5] divide-y divide-[#E5E5E5]">
                {selectedOrder.items.map((item, idx) => (
                  <div
                    key={`${item.id}-${idx}`}
                    className="p-3.5 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {item.imageUrl && (
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          referrerPolicy="no-referrer"
                          className="w-11 h-11 object-cover bg-[#F5F5F5] border border-[#E5E5E5] shrink-0"
                        />
                      )}
                      <div className="min-w-0">
                        <div className="font-medium text-[#0A0A0A] truncate">
                          {item.name}
                        </div>
                        <div className="text-[#737373] font-mono tabular-nums">
                          ₹{item.price} × {item.quantity}
                        </div>
                      </div>
                    </div>
                    <span className="font-mono font-semibold tabular-nums text-[#0A0A0A]">
                      ₹{item.price * item.quantity}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between pt-3 mt-3 border-t border-[#E5E5E5] text-sm font-semibold text-[#0A0A0A]">
                <span>Total Amount Paid</span>
                <span className="font-mono tabular-nums">₹{selectedOrder.totalAmount}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#E5E5E5]">
              {CANCELLABLE_STATUSES.has(selectedOrder.orderStatus) && (
                <button
                  type="button"
                  disabled={cancellingOrderNumber === selectedOrder.orderNumber}
                  onClick={() => handleCancelOrder(selectedOrder.orderNumber)}
                  className="px-4 py-2 border border-[#DC2626] text-xs font-medium uppercase tracking-wider text-[#991B1B] hover:bg-[#FEF2F2] disabled:opacity-50"
                >
                  {cancellingOrderNumber === selectedOrder.orderNumber
                    ? 'Cancelling...'
                    : 'Cancel Order'}
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="px-5 py-2 bg-[#0A0A0A] text-white text-xs font-medium uppercase tracking-wider"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PortalOrdersView;
