/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Product, WebsiteSettings } from '../../types';

export type AdminSection =
  | 'dashboard'
  | 'products'
  | 'orders'
  | 'payment'
  | 'mail'
  | 'profile';

export interface OrderItemRecord {
  id: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string;
}

export interface PaymentRecord {
  id: number;
  orderId: number;
  orderNumber: string;
  upiId: string;
  receiverName: string;
  transactionReference: string;
  amount: number;
  status: string;
  verifiedBy?: string | null;
  verifiedAt?: string | null;
}

export interface OrderNotificationRecord {
  id: number;
  orderId?: number | null;
  orderNumber: string;
  eventType: string;
  recipientEmail: string;
  subject: string;
  deliveryStatus: string;
  errorMessage?: string | null;
  createdAt: string;
}

export interface OrderRecord {
  id: number;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: string;
  items: OrderItemRecord[];
  totalAmount: number;
  paymentStatus: string;
  orderStatus: string;
  upiId: string;
  transactionReference: string;
  createdAt: string;
  updatedAt: string;
  payment?: PaymentRecord | null;
  notifications?: OrderNotificationRecord[];
}

export interface DashboardData {
  stats: {
    totalProducts: number;
    totalOrders: number;
    totalCustomers: number;
    totalRevenue: number;
    pendingVerificationAmount: number;
    pendingOrders: number;
    confirmedOrders: number;
    cancelledOrders: number;
  };
  recentOrders: OrderRecord[];
  latestProducts: Product[];
  revenueOverview: Array<{ date: string; revenue: number; orders: number }>;
  recentNotifications: OrderNotificationRecord[];
}

export interface EmailSettingsDto {
  id: number;
  senderName: string;
  senderEmail: string;
  provider: 'smtp' | 'resend';
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpSecure: boolean;
  hasSmtpPass: boolean;
  hasResendKey: boolean;
  updatedAt?: string;
}

export interface AdminAuthSession {
  token: string;
  admin: {
    id: number;
    name: string;
    email: string;
    role: string;
  };
}

export type WebsiteProfileDto = WebsiteSettings;
