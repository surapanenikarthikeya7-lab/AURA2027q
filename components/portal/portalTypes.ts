/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CustomerProfile, Product, WebsiteSettings } from '../../types';

export type PortalSection = 'home' | 'cart' | 'orders' | 'profile';

export interface CustomerSession {
  token: string;
  customer: CustomerProfile;
}

export interface PortalCartItem {
  id: number;
  productId: string;
  quantity: number;
  lineTotal: number;
  product: Product;
}

export interface PortalCartData {
  items: PortalCartItem[];
  subtotal: number;
  totalCount: number;
}

export interface CustomerOrderNotification {
  id: number;
  eventType: string;
  recipientEmail: string;
  subject: string;
  deliveryStatus: string;
  createdAt: string;
}

export interface CustomerOrderRecord {
  id: number;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: string;
  items: Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
    imageUrl?: string;
  }>;
  totalAmount: number;
  paymentStatus: string;
  orderStatus: string;
  upiId: string;
  transactionReference: string;
  createdAt: string;
  updatedAt: string;
  payment?: {
    id: number;
    status: string;
    upiId: string;
    receiverName: string;
    transactionReference: string;
    verifiedAt?: string | null;
  } | null;
  notifications?: CustomerOrderNotification[];
}

export interface StorefrontPayload {
  products: Product[];
  websiteSettings: WebsiteSettings;
}
