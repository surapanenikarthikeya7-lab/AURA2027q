/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export interface OrderLineItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string;
}

export const adminUsers = pgTable('admin_users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash'),
  role: text('role').notNull().default('admin'),
  isActive: boolean('is_active').notNull().default(true),
  resetToken: text('reset_token'),
  resetTokenExpiresAt: timestamp('reset_token_expires_at'),
  lastLoginAt: timestamp('last_login_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const adminSessions = pgTable('admin_sessions', {
  id: serial('id').primaryKey(),
  tokenHash: text('token_hash').notNull().unique(),
  adminUserId: integer('admin_user_id')
    .references(() => adminUsers.id, { onDelete: 'cascade' })
    .notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const products = pgTable('products', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  tagline: text('tagline').notNull().default(''),
  description: text('description').notNull(),
  longDescription: text('long_description'),
  price: integer('price').notNull(),
  category: text('category').notNull(),
  availability: text('availability').notNull().default('Available'),
  imageUrl: text('image_url').notNull(),
  gallery: jsonb('gallery').$type<string[]>().notNull().default([]),
  features: jsonb('features').$type<string[]>().notNull().default([]),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const customers = pgTable('customers', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  phone: text('phone').notNull().default(''),
  address: text('address').notNull().default(''),
  profilePictureUrl: text('profile_picture_url'),
  passwordHash: text('password_hash'),
  isRegistered: boolean('is_registered').notNull().default(false),
  resetToken: text('reset_token'),
  resetTokenExpiresAt: timestamp('reset_token_expires_at'),
  pendingEmail: text('pending_email'),
  pendingEmailCode: text('pending_email_code'),
  pendingEmailExpiresAt: timestamp('pending_email_expires_at'),
  pendingPhone: text('pending_phone'),
  pendingPhoneCode: text('pending_phone_code'),
  pendingPhoneExpiresAt: timestamp('pending_phone_expires_at'),
  lastLoginAt: timestamp('last_login_at'),
  ordersCount: integer('orders_count').notNull().default(0),
  totalSpent: integer('total_spent').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const customerSessions = pgTable('customer_sessions', {
  id: serial('id').primaryKey(),
  tokenHash: text('token_hash').notNull().unique(),
  customerId: integer('customer_id')
    .references(() => customers.id, { onDelete: 'cascade' })
    .notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const customerCartItems = pgTable('customer_cart_items', {
  id: serial('id').primaryKey(),
  customerId: integer('customer_id')
    .references(() => customers.id, { onDelete: 'cascade' })
    .notNull(),
  productId: text('product_id')
    .references(() => products.id, { onDelete: 'cascade' })
    .notNull(),
  quantity: integer('quantity').notNull().default(1),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const orders = pgTable('orders', {
  id: serial('id').primaryKey(),
  orderNumber: text('order_number').notNull().unique(),
  customerId: integer('customer_id').references(() => customers.id, {
    onDelete: 'set null',
  }),
  customerName: text('customer_name').notNull(),
  customerEmail: text('customer_email').notNull(),
  customerPhone: text('customer_phone').notNull().default(''),
  shippingAddress: text('shipping_address').notNull(),
  items: jsonb('items').$type<OrderLineItem[]>().notNull(),
  totalAmount: integer('total_amount').notNull(),
  paymentStatus: text('payment_status').notNull().default('Verification Pending'),
  orderStatus: text('order_status').notNull().default('Payment Verification'),
  upiId: text('upi_id').notNull(),
  transactionReference: text('transaction_reference').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const payments = pgTable('payments', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id')
    .references(() => orders.id, { onDelete: 'cascade' })
    .notNull(),
  orderNumber: text('order_number').notNull(),
  upiId: text('upi_id').notNull(),
  receiverName: text('receiver_name').notNull().default('Aura Quiet Living'),
  transactionReference: text('transaction_reference').notNull(),
  amount: integer('amount').notNull(),
  status: text('status').notNull().default('Pending Verification'),
  verifiedBy: text('verified_by'),
  verifiedAt: timestamp('verified_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const websiteSettings = pgTable('website_settings', {
  id: integer('id').primaryKey(),
  websiteName: text('website_name').notNull().default('Aura'),
  logoUrl: text('logo_url'),
  heroBackgroundUrl: text('hero_background_url'),
  contactEmail: text('contact_email').notNull().default('concierge@auraquietliving.com'),
  contactPhone: text('contact_phone').notNull().default('+91 92903 17064'),
  contactAddress: text('contact_address').notNull().default('Bengaluru, India'),
  upiId: text('upi_id').notNull().default('9290317064@fam'),
  upiReceiverName: text('upi_receiver_name').notNull().default('Aura Quiet Living'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const emailSettings = pgTable('email_settings', {
  id: integer('id').primaryKey(),
  senderName: text('sender_name').notNull().default('Aura Quiet Living'),
  senderEmail: text('sender_email').notNull().default('no-reply@aura.local'),
  provider: text('provider').notNull().default('smtp'),
  smtpHost: text('smtp_host').notNull().default(''),
  smtpPort: integer('smtp_port').notNull().default(587),
  smtpUser: text('smtp_user').notNull().default(''),
  smtpSecure: boolean('smtp_secure').notNull().default(false),
  smtpPassEnc: text('smtp_pass_enc'),
  hasSmtpPass: boolean('has_smtp_pass').notNull().default(false),
  resendApiKeyEnc: text('resend_api_key_enc'),
  hasResendKey: boolean('has_resend_key').notNull().default(false),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const orderNotifications = pgTable('order_notifications', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').references(() => orders.id, {
    onDelete: 'cascade',
  }),
  orderNumber: text('order_number').notNull(),
  eventType: text('event_type').notNull(),
  recipientEmail: text('recipient_email').notNull(),
  subject: text('subject').notNull(),
  htmlBody: text('html_body').notNull(),
  textBody: text('text_body').notNull(),
  deliveryStatus: text('delivery_status').notNull(),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const adminUsersRelations = relations(adminUsers, ({ many }) => ({
  sessions: many(adminSessions),
}));

export const adminSessionsRelations = relations(adminSessions, ({ one }) => ({
  adminUser: one(adminUsers, {
    fields: [adminSessions.adminUserId],
    references: [adminUsers.id],
  }),
}));

export const customersRelations = relations(customers, ({ many }) => ({
  orders: many(orders),
  sessions: many(customerSessions),
  cartItems: many(customerCartItems),
}));

export const customerSessionsRelations = relations(customerSessions, ({ one }) => ({
  customer: one(customers, {
    fields: [customerSessions.customerId],
    references: [customers.id],
  }),
}));

export const customerCartItemsRelations = relations(customerCartItems, ({ one }) => ({
  customer: one(customers, {
    fields: [customerCartItems.customerId],
    references: [customers.id],
  }),
  product: one(products, {
    fields: [customerCartItems.productId],
    references: [products.id],
  }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  customer: one(customers, {
    fields: [orders.customerId],
    references: [customers.id],
  }),
  payments: many(payments),
  notifications: many(orderNotifications),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  order: one(orders, {
    fields: [payments.orderId],
    references: [orders.id],
  }),
}));

export const orderNotificationsRelations = relations(orderNotifications, ({ one }) => ({
  order: one(orders, {
    fields: [orderNotifications.orderId],
    references: [orders.id],
  }),
}));
