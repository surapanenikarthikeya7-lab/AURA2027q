/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

export interface Product {
  id: string;
  name: string;
  tagline: string;
  description: string;
  longDescription?: string | null;
  price: number;
  category: string;
  availability?: 'Available' | 'Out of Stock' | string;
  imageUrl: string;
  gallery?: string[];
  features: string[];
}

export interface WebsiteSettings {
  id?: number;
  websiteName: string;
  logoUrl: string | null;
  heroBackgroundUrl: string | null;
  contactEmail: string;
  contactPhone: string;
  contactAddress: string;
  upiId: string;
  upiReceiverName: string;
}

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: string;
}

export interface CustomerProfile {
  id: number;
  name: string;
  email: string;
  phone: string;
  address: string;
  profilePictureUrl: string | null;
  ordersCount: number;
  totalSpent: number;
  createdAt: string;
}

export interface JournalArticle {
  id: number;
  title: string;
  date: string;
  excerpt: string;
  image: string;
  content: React.ReactNode;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export enum LoadingState {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  ERROR = 'ERROR',
  SUCCESS = 'SUCCESS'
}

export type ViewState =
  | { type: 'home' }
  | { type: 'product'; product: Product }
  | { type: 'journal'; article: JournalArticle }
  | { type: 'wishlist' }
  | { type: 'checkout' }
  | { type: 'admin' }
  | { type: 'portal' };
