/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { db } from '../db/index.ts';
import {
  adminUsers,
  adminSessions,
  products,
  customers,
  customerSessions,
  customerCartItems,
  orders,
  payments,
  websiteSettings,
  emailSettings,
  orderNotifications,
  type OrderLineItem,
} from '../db/schema.ts';
import crypto from 'crypto';
import { hashPassword } from '../server/cryptoUtils.ts';
import { desc, eq, gt, ilike, or, and, gte, lte, sql, inArray } from 'drizzle-orm';

const INITIAL_PRODUCTS = [
  {
    id: 'p1',
    name: 'Aura Harmony',
    tagline: 'Listen naturally.',
    description:
      'Audio that feels like the open air. Constructed with warm acoustic fabric and recycled sandstone composite.',
    longDescription:
      'Experience sound as it was meant to be heard—unconfined and organic. The Aura Harmony headphones feature our proprietary open-air driver technology, encased in a breathable acoustic fabric that adapts to your temperature. The headband is crafted from a recycled sandstone composite, offering a unique, cool-to-the-touch texture that grounds you in the present moment.',
    price: 429,
    category: 'Audio',
    availability: 'Available',
    imageUrl:
      'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&q=80&w=1000',
    gallery: [
      'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&q=80&w=1000',
      'https://images.unsplash.com/photo-1484704849700-f032a568e944?auto=format&fit=crop&q=80&w=1000',
      'https://images.unsplash.com/photo-1524678606372-565ae0f98944?auto=format&fit=crop&q=80&w=1000',
    ],
    features: ['Organic Noise Cancellation', '50h Battery', 'Natural Soundstage'],
  },
  {
    id: 'p2',
    name: 'Aura Epoch',
    tagline: 'Moments, not minutes.',
    description:
      'A timepiece designed for wellness. Ceramic casing with a strap made from sustainable vegan leather.',
    longDescription:
      'Time is not a sequence of numbers, but a flow of moments. The Aura Epoch rethinks the smartwatch interface, using a calm E-Ink hybrid display that mimics paper. It tracks stress through skin temperature and heart rate variability, gently vibrating to remind you to breathe. The ceramic casing is hypoallergenic and smooth, polished by hand for 48 hours.',
    price: 349,
    category: 'Wearable',
    availability: 'Available',
    imageUrl:
      'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=1000',
    gallery: [
      'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=1000',
      'https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?auto=format&fit=crop&q=80&w=1000',
    ],
    features: ['Stress Monitoring', 'E-Ink Hybrid Display', '7-Day Battery'],
  },
  {
    id: 'p3',
    name: 'Aura Canvas',
    tagline: 'Capture the warmth.',
    description:
      'A display that mimics the properties of paper. Soft on the eyes, vivid in color, and textured to the touch.',
    longDescription:
      "Screens shouldn't feel like looking into a lightbulb. Aura Canvas uses a matte, nano-etched OLED panel that scatters ambient light, creating a display that looks and feels like high-quality magazine paper. Perfect for reading, sketching, or displaying art, it brings a tactile warmth to your digital life.",
    price: 1099,
    category: 'Mobile',
    availability: 'Available',
    imageUrl:
      'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&q=80&w=1000',
    gallery: [
      'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&q=80&w=1000',
      'https://images.unsplash.com/photo-1585338107529-13afc5f02586?auto=format&fit=crop&q=80&w=1000',
    ],
    features: ['Paper-like OLED', 'Portrait Lens', 'Sandstone Texture'],
  },
  {
    id: 'p4',
    name: 'Aura Essence',
    tagline: 'Return to nature.',
    description:
      'An air purifier that doubles as a sculpture. Whisper quiet, diffusing subtle natural scents while cleaning your space.',
    longDescription:
      'Clean air is the foundation of a clear mind. Aura Essence uses a moss-based bio-filter combined with HEPA technology to scrub pollutants from your home. It gently diffuses natural essential oils—cedar, bergamot, and rain—orchestrated to match the time of day.',
    price: 599,
    category: 'Home',
    availability: 'Available',
    imageUrl:
      'https://images.pexels.com/photos/8092420/pexels-photo-8092420.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
    gallery: [
      'https://images.pexels.com/photos/8092420/pexels-photo-8092420.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
      'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&q=80&w=1000',
    ],
    features: ['Bio-HEPA Filter', 'Aromatherapy', 'Silent Night Mode'],
  },
  {
    id: 'p5',
    name: 'Aura Beam',
    tagline: 'Light that breathes.',
    description:
      'Smart circadian lighting that follows the sun. Casts a warm, candle-like glow in the evenings.',
    longDescription:
      'Artificial light disrupts our natural rhythms. Aura Beam syncs with your local sunrise and sunset, providing cool, energizing light during the day and transitioning to a warm, amber glow free of blue light in the evening. Controls are touchless; a simple wave of the hand adjusts brightness.',
    price: 249,
    category: 'Home',
    availability: 'Available',
    imageUrl:
      'https://images.unsplash.com/photo-1565814329452-e1efa11c5b89?auto=format&fit=crop&q=80&w=1000',
    gallery: [
      'https://images.unsplash.com/photo-1565814329452-e1efa11c5b89?auto=format&fit=crop&q=80&w=1000',
      'https://images.unsplash.com/photo-1540932296235-d84931b6370b?auto=format&fit=crop&q=80&w=1000',
    ],
    features: ['Circadian Rhythm Sync', 'Warm Dimming', 'Touchless Control'],
  },
  {
    id: 'p6',
    name: 'Aura Scribe',
    tagline: 'Thought in motion.',
    description:
      'A digital stylus with the friction of graphite. Charges wirelessly when magnetically attached to Aura Canvas.',
    longDescription:
      'The connection between hand and brain is sacred. Aura Scribe features a custom elastomer tip that replicates the microscopic friction of graphite on paper. Weighted perfectly for balance, it disappears in your hand, leaving only your thoughts.',
    price: 129,
    category: 'Mobile',
    availability: 'Available',
    imageUrl:
      'https://images.pexels.com/photos/2647376/pexels-photo-2647376.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
    gallery: [
      'https://images.pexels.com/photos/2647376/pexels-photo-2647376.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
      'https://images.unsplash.com/photo-1517260487576-8977430081d3?auto=format&fit=crop&q=80&w=1000',
    ],
    features: ['Zero Latency', 'Textured Tip', 'Wireless Charging'],
  },
];

let seedPromise: Promise<void> | null = null;

export async function ensureSeeded(): Promise<void> {
  if (!seedPromise) {
    seedPromise = (async () => {
      try {
        const existingWebsite = await db
          .select()
          .from(websiteSettings)
          .where(eq(websiteSettings.id, 1));

        if (existingWebsite.length === 0) {
          await db
            .insert(websiteSettings)
            .values({
              id: 1,
              websiteName: 'Aura',
              logoUrl: null,
              heroBackgroundUrl:
                'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&q=80&w=2000',
              contactEmail: 'concierge@auraquietliving.com',
              contactPhone: '+91 92903 17064',
              contactAddress: 'Bengaluru, India',
              upiId: '9290317064@fam',
              upiReceiverName: 'Aura Quiet Living',
            })
            .onConflictDoNothing();

          const existingProducts = await db
            .select({ id: products.id })
            .from(products)
            .limit(1);

          if (existingProducts.length === 0) {
            for (const p of INITIAL_PRODUCTS) {
              await db.insert(products).values(p).onConflictDoNothing();
            }
          }
        }

        const existingEmail = await db
          .select()
          .from(emailSettings)
          .where(eq(emailSettings.id, 1));

        if (existingEmail.length === 0) {
          await db
            .insert(emailSettings)
            .values({
              id: 1,
              senderName: 'Aura Quiet Living',
              senderEmail:
                process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@aura.local',
              provider: 'smtp',
              smtpHost: process.env.SMTP_HOST || '',
              smtpPort: Number(process.env.SMTP_PORT || 587),
              smtpUser: process.env.SMTP_USER || '',
              smtpSecure: Number(process.env.SMTP_PORT || 587) === 465,
              hasSmtpPass: Boolean(process.env.SMTP_PASS),
              hasResendKey: Boolean(process.env.RESEND_API_KEY),
            })
            .onConflictDoNothing();
        }

        const designatedEmail = (process.env.ADMIN_EMAIL || 'kxrt2027@gmail.com')
          .trim()
          .toLowerCase();
        const designatedPassword = process.env.ADMIN_PASSWORD || 'kxrt2027';

        const existingDesignatedAdmin = await db
          .select()
          .from(adminUsers)
          .where(eq(adminUsers.email, designatedEmail));

        if (existingDesignatedAdmin.length === 0) {
          await db
            .insert(adminUsers)
            .values({
              uid: `local:${crypto.randomUUID()}`,
              name: 'Admin',
              email: designatedEmail,
              passwordHash: hashPassword(designatedPassword),
              role: 'admin',
              isActive: true,
            })
            .onConflictDoNothing();
        }
      } catch (err) {
        seedPromise = null;
        throw err;
      }
    })();
  }
  return seedPromise;
}

export async function getStorefrontData() {
  try {
    await ensureSeeded();
    const [allProducts, settingsRows] = await Promise.all([
      db.select().from(products).orderBy(products.createdAt),
      db.select().from(websiteSettings).where(eq(websiteSettings.id, 1)),
    ]);
    return {
      products: allProducts,
      websiteSettings: settingsRows[0] || {
        id: 1,
        websiteName: 'Aura',
        logoUrl: null,
        heroBackgroundUrl: null,
        contactEmail: 'concierge@auraquietliving.com',
        contactPhone: '+91 92903 17064',
        contactAddress: 'Bengaluru, India',
        upiId: '9290317064@fam',
        upiReceiverName: 'Aura Quiet Living',
      },
    };
  } catch (error) {
    console.error('Database query failed in getStorefrontData:', error);
    throw new Error('Failed to load storefront catalog and settings.', {
      cause: error,
    });
  }
}

export async function countAdminUsers(): Promise<number> {
  try {
    const rows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(adminUsers);
    return Number(rows[0]?.count || 0);
  } catch (error) {
    console.error('Database query failed in countAdminUsers:', error);
    throw new Error('Failed to verify admin configuration.', { cause: error });
  }
}

export async function findAdminByEmail(email: string) {
  try {
    const rows = await db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.email, email.toLowerCase()));
    return rows[0] || null;
  } catch (error) {
    console.error('Database query failed in findAdminByEmail:', error);
    throw new Error('Failed to look up administrator account.', { cause: error });
  }
}

export async function findAdminByUid(uid: string) {
  try {
    const rows = await db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.uid, uid));
    return rows[0] || null;
  } catch (error) {
    console.error('Database query failed in findAdminByUid:', error);
    throw new Error('Failed to look up administrator account.', { cause: error });
  }
}

export async function createAdminUser(input: {
  uid: string;
  name: string;
  email: string;
  passwordHash: string | null;
}) {
  try {
    const [created] = await db
      .insert(adminUsers)
      .values({
        uid: input.uid,
        name: input.name,
        email: input.email.toLowerCase(),
        passwordHash: input.passwordHash,
        role: 'admin',
        isActive: true,
        lastLoginAt: new Date(),
      })
      .returning();
    return created;
  } catch (error) {
    console.error('Database query failed in createAdminUser:', error);
    throw new Error('Failed to create administrator account.', { cause: error });
  }
}

export async function updateAdminLoginTimestamp(adminId: number, uid?: string) {
  try {
    await db
      .update(adminUsers)
      .set({
        ...(uid ? { uid } : {}),
        lastLoginAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(adminUsers.id, adminId));
  } catch (error) {
    console.error('Database query failed in updateAdminLoginTimestamp:', error);
  }
}

export async function setAdminResetToken(
  adminId: number,
  resetTokenHash: string,
  expiresAt: Date
) {
  try {
    await db
      .update(adminUsers)
      .set({
        resetToken: resetTokenHash,
        resetTokenExpiresAt: expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(adminUsers.id, adminId));
  } catch (error) {
    console.error('Database query failed in setAdminResetToken:', error);
    throw new Error('Failed to store password reset code.', { cause: error });
  }
}

export async function updateAdminPassword(adminId: number, passwordHash: string) {
  try {
    await db
      .update(adminUsers)
      .set({
        passwordHash,
        resetToken: null,
        resetTokenExpiresAt: null,
        updatedAt: new Date(),
      })
      .where(eq(adminUsers.id, adminId));
  } catch (error) {
    console.error('Database query failed in updateAdminPassword:', error);
    throw new Error('Failed to update administrator password.', { cause: error });
  }
}

export async function createAdminSession(
  adminUserId: number,
  tokenHash: string,
  expiresAt: Date
) {
  try {
    await db.insert(adminSessions).values({
      adminUserId,
      tokenHash,
      expiresAt,
    });
  } catch (error) {
    console.error('Database query failed in createAdminSession:', error);
    throw new Error('Failed to initialize administrator session.', { cause: error });
  }
}

export async function findValidAdminSession(tokenHash: string) {
  try {
    const rows = await db
      .select({
        sessionId: adminSessions.id,
        admin: adminUsers,
      })
      .from(adminSessions)
      .innerJoin(adminUsers, eq(adminSessions.adminUserId, adminUsers.id))
      .where(
        and(
          eq(adminSessions.tokenHash, tokenHash),
          gt(adminSessions.expiresAt, new Date()),
          eq(adminUsers.isActive, true)
        )
      )
      .limit(1);
    return rows[0]?.admin || null;
  } catch (error) {
    console.error('Database query failed in findValidAdminSession:', error);
    throw new Error('Failed to validate administrator session.', { cause: error });
  }
}

export async function deleteAdminSession(tokenHash: string) {
  try {
    await db.delete(adminSessions).where(eq(adminSessions.tokenHash, tokenHash));
  } catch (error) {
    console.error('Database query failed in deleteAdminSession:', error);
  }
}

export async function getAllProducts(search?: string) {
  try {
    await ensureSeeded();
    if (search && search.trim()) {
      const q = `%${search.trim()}%`;
      return await db
        .select()
        .from(products)
        .where(or(ilike(products.name, q), ilike(products.category, q)))
        .orderBy(desc(products.createdAt));
    }
    return await db.select().from(products).orderBy(desc(products.createdAt));
  } catch (error) {
    console.error('Database query failed in getAllProducts:', error);
    throw new Error('Failed to load products.', { cause: error });
  }
}

export async function getProductsByIds(ids: string[]) {
  try {
    await ensureSeeded();
    if (ids.length === 0) return [];
    return await db.select().from(products).where(inArray(products.id, ids));
  } catch (error) {
    console.error('Database query failed in getProductsByIds:', error);
    throw new Error('Failed to load requested products.', { cause: error });
  }
}

export async function createProduct(input: {
  id: string;
  name: string;
  tagline: string;
  description: string;
  longDescription?: string;
  price: number;
  category: string;
  availability: string;
  imageUrl: string;
  gallery: string[];
  features: string[];
}) {
  try {
    const [created] = await db.insert(products).values(input).returning();
    return created;
  } catch (error) {
    console.error('Database query failed in createProduct:', error);
    throw new Error('Failed to add product.', { cause: error });
  }
}

export async function updateProduct(
  id: string,
  input: Partial<{
    name: string;
    tagline: string;
    description: string;
    longDescription: string | null;
    price: number;
    category: string;
    availability: string;
    imageUrl: string;
    gallery: string[];
    features: string[];
  }>
) {
  try {
    const [updated] = await db
      .update(products)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();
    return updated || null;
  } catch (error) {
    console.error('Database query failed in updateProduct:', error);
    throw new Error('Failed to update product.', { cause: error });
  }
}

export async function deleteProduct(id: string) {
  try {
    const [deleted] = await db
      .delete(products)
      .where(eq(products.id, id))
      .returning();
    return deleted || null;
  } catch (error) {
    console.error('Database query failed in deleteProduct:', error);
    throw new Error('Failed to delete product.', { cause: error });
  }
}

export async function createCustomerOrder(input: {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: string;
  items: OrderLineItem[];
  totalAmount: number;
  upiId: string;
  upiReceiverName: string;
  transactionReference: string;
}) {
  try {
    await ensureSeeded();
    const emailLower = input.customerEmail.toLowerCase();

    const [customer] = await db
      .insert(customers)
      .values({
        name: input.customerName,
        email: emailLower,
        phone: input.customerPhone,
        address: input.shippingAddress,
        ordersCount: 1,
        totalSpent: 0,
      })
      .onConflictDoUpdate({
        target: customers.email,
        set: {
          name: input.customerName,
          phone: input.customerPhone,
          address: input.shippingAddress,
          ordersCount: sql`${customers.ordersCount} + 1`,
          updatedAt: new Date(),
        },
      })
      .returning();

    const [createdOrder] = await db
      .insert(orders)
      .values({
        orderNumber: input.orderNumber,
        customerId: customer.id,
        customerName: input.customerName,
        customerEmail: emailLower,
        customerPhone: input.customerPhone,
        shippingAddress: input.shippingAddress,
        items: input.items,
        totalAmount: input.totalAmount,
        paymentStatus: 'Verification Pending',
        orderStatus: 'Payment Verification',
        upiId: input.upiId,
        transactionReference: input.transactionReference,
      })
      .returning();

    const [createdPayment] = await db
      .insert(payments)
      .values({
        orderId: createdOrder.id,
        orderNumber: createdOrder.orderNumber,
        upiId: input.upiId,
        receiverName: input.upiReceiverName,
        transactionReference: input.transactionReference,
        amount: input.totalAmount,
        status: 'Pending Verification',
      })
      .returning();

    return { order: createdOrder, payment: createdPayment, customer };
  } catch (error) {
    console.error('Database query failed in createCustomerOrder:', error);
    throw new Error('Failed to save customer order.', { cause: error });
  }
}

export async function findOrderByNumber(orderNumber: string) {
  try {
    const rows = await db
      .select()
      .from(orders)
      .where(eq(orders.orderNumber, orderNumber));
    return rows[0] || null;
  } catch (error) {
    console.error('Database query failed in findOrderByNumber:', error);
    throw new Error('Failed to retrieve order.', { cause: error });
  }
}

export async function findOrderById(id: number) {
  try {
    const rows = await db.select().from(orders).where(eq(orders.id, id));
    if (!rows[0]) return null;
    const [paymentRows, notificationRows] = await Promise.all([
      db.select().from(payments).where(eq(payments.orderId, id)),
      db
        .select()
        .from(orderNotifications)
        .where(eq(orderNotifications.orderId, id))
        .orderBy(desc(orderNotifications.createdAt)),
    ]);
    return {
      ...rows[0],
      payment: paymentRows[0] || null,
      notifications: notificationRows,
    };
  } catch (error) {
    console.error('Database query failed in findOrderById:', error);
    throw new Error('Failed to retrieve order details.', { cause: error });
  }
}

export async function listOrders(filters?: {
  q?: string;
  paymentStatus?: string;
  orderStatus?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  try {
    await ensureSeeded();
    const conditions = [];

    if (filters?.q && filters.q.trim()) {
      const q = `%${filters.q.trim()}%`;
      conditions.push(
        or(
          ilike(orders.customerName, q),
          ilike(orders.orderNumber, q),
          ilike(orders.customerEmail, q),
          ilike(orders.transactionReference, q)
        )
      );
    }
    if (filters?.paymentStatus && filters.paymentStatus !== 'All') {
      conditions.push(eq(orders.paymentStatus, filters.paymentStatus));
    }
    if (filters?.orderStatus && filters.orderStatus !== 'All') {
      conditions.push(eq(orders.orderStatus, filters.orderStatus));
    }
    if (filters?.dateFrom) {
      const start = new Date(`${filters.dateFrom}T00:00:00.000Z`);
      if (!Number.isNaN(start.getTime())) {
        conditions.push(gte(orders.createdAt, start));
      }
    }
    if (filters?.dateTo) {
      const end = new Date(`${filters.dateTo}T23:59:59.999Z`);
      if (!Number.isNaN(end.getTime())) {
        conditions.push(lte(orders.createdAt, end));
      }
    }

    const orderRows =
      conditions.length > 0
        ? await db
            .select()
            .from(orders)
            .where(and(...conditions))
            .orderBy(desc(orders.createdAt))
        : await db.select().from(orders).orderBy(desc(orders.createdAt));

    const orderIds = orderRows.map((o) => o.id);
    const paymentRows =
      orderIds.length > 0
        ? await db
            .select()
            .from(payments)
            .where(inArray(payments.orderId, orderIds))
        : [];
    const paymentMap = new Map(paymentRows.map((p) => [p.orderId, p]));

    return orderRows.map((o) => ({
      ...o,
      payment: paymentMap.get(o.id) || null,
    }));
  } catch (error) {
    console.error('Database query failed in listOrders:', error);
    throw new Error('Failed to load customer orders.', { cause: error });
  }
}

export async function verifyOrderPayment(
  orderId: number,
  action: 'verify' | 'reject',
  adminEmail: string
) {
  try {
    const existing = await db.select().from(orders).where(eq(orders.id, orderId));
    if (!existing[0]) return null;
    const order = existing[0];

    const nextPaymentStatus = action === 'verify' ? 'Paid' : 'Failed';
    const nextOrderStatus = action === 'verify' ? 'Confirmed' : 'Cancelled';
    const nextPayRecordStatus = action === 'verify' ? 'Verified' : 'Rejected';

    const [updatedOrder] = await db
      .update(orders)
      .set({
        paymentStatus: nextPaymentStatus,
        orderStatus: nextOrderStatus,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId))
      .returning();

    await db
      .update(payments)
      .set({
        status: nextPayRecordStatus,
        verifiedBy: adminEmail,
        verifiedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(payments.orderId, orderId));

    if (
      action === 'verify' &&
      order.paymentStatus !== 'Paid' &&
      order.customerId
    ) {
      await db
        .update(customers)
        .set({
          totalSpent: sql`${customers.totalSpent} + ${order.totalAmount}`,
          updatedAt: new Date(),
        })
        .where(eq(customers.id, order.customerId));
    }

    return updatedOrder;
  } catch (error) {
    console.error('Database query failed in verifyOrderPayment:', error);
    throw new Error('Failed to update payment verification status.', {
      cause: error,
    });
  }
}

export async function updateOrderStatusRecord(
  orderId: number,
  nextOrderStatus: string
) {
  try {
    const existing = await db.select().from(orders).where(eq(orders.id, orderId));
    if (!existing[0]) return null;
    const current = existing[0];

    let nextPaymentStatus = current.paymentStatus;
    let nextPayRecordStatus: string | null = null;

    if (nextOrderStatus === 'Refund Initiated') {
      nextPaymentStatus = 'Refund Initiated';
      nextPayRecordStatus = 'Refund Initiated';
    } else if (nextOrderStatus === 'Refunded') {
      nextPaymentStatus = 'Refunded';
      nextPayRecordStatus = 'Refunded';
    } else if (
      nextOrderStatus === 'Cancelled' &&
      current.paymentStatus === 'Verification Pending'
    ) {
      nextPaymentStatus = 'Failed';
      nextPayRecordStatus = 'Rejected';
    }

    const [updated] = await db
      .update(orders)
      .set({
        orderStatus: nextOrderStatus,
        paymentStatus: nextPaymentStatus,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId))
      .returning();

    if (nextPayRecordStatus) {
      await db
        .update(payments)
        .set({
          status: nextPayRecordStatus,
          updatedAt: new Date(),
        })
        .where(eq(payments.orderId, orderId));
    }

    return updated;
  } catch (error) {
    console.error('Database query failed in updateOrderStatusRecord:', error);
    throw new Error('Failed to update order status.', { cause: error });
  }
}

export async function getWebsiteSettings() {
  try {
    await ensureSeeded();
    const rows = await db
      .select()
      .from(websiteSettings)
      .where(eq(websiteSettings.id, 1));
    return rows[0];
  } catch (error) {
    console.error('Database query failed in getWebsiteSettings:', error);
    throw new Error('Failed to load website settings.', { cause: error });
  }
}

export async function updateWebsiteSettings(
  patch: Partial<{
    websiteName: string;
    logoUrl: string | null;
    heroBackgroundUrl: string | null;
    contactEmail: string;
    contactPhone: string;
    contactAddress: string;
    upiId: string;
    upiReceiverName: string;
  }>
) {
  try {
    await ensureSeeded();
    const [updated] = await db
      .update(websiteSettings)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(websiteSettings.id, 1))
      .returning();
    return updated;
  } catch (error) {
    console.error('Database query failed in updateWebsiteSettings:', error);
    throw new Error('Failed to save website settings.', { cause: error });
  }
}

export async function getEmailSettingsRow() {
  try {
    await ensureSeeded();
    const rows = await db
      .select()
      .from(emailSettings)
      .where(eq(emailSettings.id, 1));
    return rows[0];
  } catch (error) {
    console.error('Database query failed in getEmailSettingsRow:', error);
    throw new Error('Failed to load email settings.', { cause: error });
  }
}

export async function updateEmailSettingsRow(
  patch: Partial<{
    senderName: string;
    senderEmail: string;
    provider: string;
    smtpHost: string;
    smtpPort: number;
    smtpUser: string;
    smtpSecure: boolean;
    smtpPassEnc: string | null;
    hasSmtpPass: boolean;
    resendApiKeyEnc: string | null;
    hasResendKey: boolean;
  }>
) {
  try {
    await ensureSeeded();
    const [updated] = await db
      .update(emailSettings)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(emailSettings.id, 1))
      .returning();
    return updated;
  } catch (error) {
    console.error('Database query failed in updateEmailSettingsRow:', error);
    throw new Error('Failed to save email settings.', { cause: error });
  }
}

export async function insertOrderNotification(input: {
  orderId: number | null;
  orderNumber: string;
  eventType: string;
  recipientEmail: string;
  subject: string;
  htmlBody: string;
  textBody: string;
  deliveryStatus: string;
  errorMessage?: string | null;
}) {
  try {
    const [created] = await db
      .insert(orderNotifications)
      .values({
        orderId: input.orderId,
        orderNumber: input.orderNumber,
        eventType: input.eventType,
        recipientEmail: input.recipientEmail,
        subject: input.subject,
        htmlBody: input.htmlBody,
        textBody: input.textBody,
        deliveryStatus: input.deliveryStatus,
        errorMessage: input.errorMessage || null,
      })
      .returning();
    return created;
  } catch (error) {
    console.error('Database query failed in insertOrderNotification:', error);
    throw new Error('Failed to log order notification.', { cause: error });
  }
}

export async function listRecentNotifications(limit = 30) {
  try {
    return await db
      .select()
      .from(orderNotifications)
      .orderBy(desc(orderNotifications.createdAt))
      .limit(limit);
  } catch (error) {
    console.error('Database query failed in listRecentNotifications:', error);
    throw new Error('Failed to load notification logs.', { cause: error });
  }
}

export async function getDashboardOverview() {
  try {
    await ensureSeeded();
    const [allProducts, allOrders, allCustomers, recentNotifs] = await Promise.all([
      db.select().from(products).orderBy(desc(products.createdAt)),
      db.select().from(orders).orderBy(desc(orders.createdAt)),
      db.select().from(customers),
      db
        .select()
        .from(orderNotifications)
        .orderBy(desc(orderNotifications.createdAt))
        .limit(10),
    ]);

    const totalProducts = allProducts.length;
    const totalOrders = allOrders.length;
    const totalCustomers = allCustomers.length;

    const pendingOrders = allOrders.filter(
      (o) =>
        o.orderStatus === 'Pending' ||
        o.orderStatus === 'Payment Verification'
    ).length;
    const confirmedOrders = allOrders.filter(
      (o) =>
        o.orderStatus === 'Confirmed' ||
        o.orderStatus === 'Processing' ||
        o.orderStatus === 'Completed'
    ).length;
    const cancelledOrders = allOrders.filter(
      (o) =>
        o.orderStatus === 'Cancelled' ||
        o.orderStatus === 'Refund Initiated' ||
        o.orderStatus === 'Refunded'
    ).length;

    const totalRevenue = allOrders
      .filter(
        (o) =>
          o.paymentStatus === 'Paid' &&
          o.orderStatus !== 'Cancelled' &&
          o.orderStatus !== 'Refunded'
      )
      .reduce((sum, o) => sum + o.totalAmount, 0);

    const pendingVerificationAmount = allOrders
      .filter((o) => o.paymentStatus === 'Verification Pending')
      .reduce((sum, o) => sum + o.totalAmount, 0);

    const dayBuckets = new Map<string, { date: string; revenue: number; orders: number }>();
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      dayBuckets.set(key, { date: key, revenue: 0, orders: 0 });
    }
    for (const o of allOrders) {
      const key = new Date(o.createdAt).toISOString().slice(0, 10);
      const bucket = dayBuckets.get(key);
      if (bucket) {
        bucket.orders += 1;
        if (o.paymentStatus === 'Paid' && o.orderStatus !== 'Cancelled') {
          bucket.revenue += o.totalAmount;
        }
      }
    }

    return {
      stats: {
        totalProducts,
        totalOrders,
        totalCustomers,
        totalRevenue,
        pendingVerificationAmount,
        pendingOrders,
        confirmedOrders,
        cancelledOrders,
      },
      recentOrders: allOrders.slice(0, 6),
      latestProducts: allProducts.slice(0, 5),
      revenueOverview: Array.from(dayBuckets.values()),
      recentNotifications: recentNotifs,
    };
  } catch (error) {
    console.error('Database query failed in getDashboardOverview:', error);
    throw new Error('Failed to load dashboard overview.', { cause: error });
  }
}

export async function exportDatabaseBackup() {
  try {
    await ensureSeeded();
    const [
      allProducts,
      allCustomers,
      allOrders,
      allPayments,
      siteSettings,
      notifs,
    ] = await Promise.all([
      db.select().from(products),
      db.select().from(customers),
      db.select().from(orders),
      db.select().from(payments),
      db.select().from(websiteSettings),
      db.select().from(orderNotifications),
    ]);

    return {
      exportedAt: new Date().toISOString(),
      tables: {
        products: allProducts,
        customers: allCustomers,
        orders: allOrders,
        payments: allPayments,
        website_settings: siteSettings,
        order_notifications: notifs,
      },
    };
  } catch (error) {
    console.error('Database query failed in exportDatabaseBackup:', error);
    throw new Error('Failed to generate database backup.', { cause: error });
  }
}

// ===========================================================================
// CUSTOMER PORTAL REPOSITORY FUNCTIONS (ISOLATED FROM ADMIN TABLES)
// ===========================================================================

export function sanitizeCustomerProfile(customer: typeof customers.$inferSelect) {
  return {
    id: customer.id,
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    address: customer.address,
    profilePictureUrl: customer.profilePictureUrl,
    ordersCount: customer.ordersCount,
    totalSpent: customer.totalSpent,
    createdAt: customer.createdAt,
  };
}

export async function findCustomerByEmail(email: string) {
  try {
    const rows = await db
      .select()
      .from(customers)
      .where(eq(sql`lower(${customers.email})`, email.trim().toLowerCase()));
    return rows[0] || null;
  } catch (error) {
    console.error('Database query failed in findCustomerByEmail:', error);
    throw new Error('Failed to look up customer account.', { cause: error });
  }
}

export async function findCustomerById(customerId: number) {
  try {
    const rows = await db
      .select()
      .from(customers)
      .where(eq(customers.id, customerId));
    return rows[0] || null;
  } catch (error) {
    console.error('Database query failed in findCustomerById:', error);
    throw new Error('Failed to look up customer account.', { cause: error });
  }
}

export async function registerOrUpgradeCustomerAccount(input: {
  name: string;
  email: string;
  phone?: string;
  passwordHash: string;
}) {
  try {
    const emailLower = input.email.trim().toLowerCase();
    const existing = await findCustomerByEmail(emailLower);

    if (existing && existing.isRegistered) {
      throw new Error('An account with this email already exists.');
    }

    if (existing) {
      const [updated] = await db
        .update(customers)
        .set({
          name: input.name.trim(),
          phone: input.phone?.trim() || existing.phone,
          passwordHash: input.passwordHash,
          isRegistered: true,
          lastLoginAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(customers.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await db
      .insert(customers)
      .values({
        name: input.name.trim(),
        email: emailLower,
        phone: input.phone?.trim() || '',
        address: '',
        passwordHash: input.passwordHash,
        isRegistered: true,
        lastLoginAt: new Date(),
      })
      .returning();
    return created;
  } catch (error: any) {
    if (error?.message?.includes('already exists')) {
      throw error;
    }
    console.error('Database query failed in registerOrUpgradeCustomerAccount:', error);
    throw new Error('Failed to create customer account.', { cause: error });
  }
}

export async function upsertGoogleCustomerAccount(input: {
  name: string;
  email: string;
  profilePictureUrl?: string | null;
}) {
  try {
    const emailLower = input.email.trim().toLowerCase();
    const displayName =
      input.name.trim() || emailLower.split('@')[0] || 'Customer';
    const existing = await findCustomerByEmail(emailLower);

    if (existing) {
      const [updated] = await db
        .update(customers)
        .set({
          name: existing.name?.trim() ? existing.name : displayName,
          profilePictureUrl:
            existing.profilePictureUrl || input.profilePictureUrl || null,
          isRegistered: true,
          lastLoginAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(customers.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await db
      .insert(customers)
      .values({
        name: displayName,
        email: emailLower,
        phone: '',
        address: '',
        profilePictureUrl: input.profilePictureUrl || null,
        isRegistered: true,
        lastLoginAt: new Date(),
      })
      .returning();
    return created;
  } catch (error) {
    console.error('Database query failed in upsertGoogleCustomerAccount:', error);
    throw new Error('Failed to sign in with Google.', { cause: error });
  }
}

export async function updateCustomerLoginTimestamp(customerId: number) {
  try {
    await db
      .update(customers)
      .set({ lastLoginAt: new Date(), updatedAt: new Date() })
      .where(eq(customers.id, customerId));
  } catch (error) {
    console.error('Database query failed in updateCustomerLoginTimestamp:', error);
  }
}

export async function createCustomerSession(
  customerId: number,
  tokenHash: string,
  expiresAt: Date
) {
  try {
    await db.insert(customerSessions).values({
      customerId,
      tokenHash,
      expiresAt,
    });
  } catch (error) {
    console.error('Database query failed in createCustomerSession:', error);
    throw new Error('Failed to create customer session.', { cause: error });
  }
}

export async function findValidCustomerSession(tokenHash: string) {
  try {
    const rows = await db
      .select({ customer: customers })
      .from(customerSessions)
      .innerJoin(customers, eq(customerSessions.customerId, customers.id))
      .where(
        and(
          eq(customerSessions.tokenHash, tokenHash),
          gt(customerSessions.expiresAt, new Date())
        )
      );
    return rows[0]?.customer || null;
  } catch (error) {
    console.error('Database query failed in findValidCustomerSession:', error);
    throw new Error('Failed to verify customer session.', { cause: error });
  }
}

export async function deleteCustomerSession(tokenHash: string) {
  try {
    await db
      .delete(customerSessions)
      .where(eq(customerSessions.tokenHash, tokenHash));
  } catch (error) {
    console.error('Database query failed in deleteCustomerSession:', error);
  }
}

export async function setCustomerResetToken(
  customerId: number,
  resetTokenHash: string,
  expiresAt: Date
) {
  try {
    await db
      .update(customers)
      .set({
        resetToken: resetTokenHash,
        resetTokenExpiresAt: expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(customers.id, customerId));
  } catch (error) {
    console.error('Database query failed in setCustomerResetToken:', error);
    throw new Error('Failed to issue password reset code.', { cause: error });
  }
}

export async function updateCustomerPassword(customerId: number, passwordHash: string) {
  try {
    await db
      .update(customers)
      .set({
        passwordHash,
        resetToken: null,
        resetTokenExpiresAt: null,
        updatedAt: new Date(),
      })
      .where(eq(customers.id, customerId));
  } catch (error) {
    console.error('Database query failed in updateCustomerPassword:', error);
    throw new Error('Failed to update customer password.', { cause: error });
  }
}

export async function updateCustomerProfileFields(
  customerId: number,
  input: {
    name?: string;
    profilePictureUrl?: string | null;
    address?: string;
  }
) {
  try {
    const patch: Record<string, any> = { updatedAt: new Date() };
    if (typeof input.name === 'string') patch.name = input.name.trim();
    if (input.profilePictureUrl !== undefined) {
      patch.profilePictureUrl = input.profilePictureUrl;
    }
    if (typeof input.address === 'string') patch.address = input.address.trim();

    const [updated] = await db
      .update(customers)
      .set(patch)
      .where(eq(customers.id, customerId))
      .returning();

    if (updated && typeof input.name === 'string') {
      await db
        .update(orders)
        .set({ customerName: updated.name, updatedAt: new Date() })
        .where(eq(orders.customerId, customerId));
    }

    return updated || null;
  } catch (error) {
    console.error('Database query failed in updateCustomerProfileFields:', error);
    throw new Error('Failed to update customer profile.', { cause: error });
  }
}

export async function storeCustomerPendingContactChange(
  customerId: number,
  type: 'email' | 'phone',
  newValue: string,
  codeHash: string,
  expiresAt: Date
) {
  try {
    if (type === 'email') {
      const normalized = newValue.trim().toLowerCase();
      const existing = await findCustomerByEmail(normalized);
      if (existing && existing.id !== customerId) {
        throw new Error('Another customer account already uses this email.');
      }
      await db
        .update(customers)
        .set({
          pendingEmail: normalized,
          pendingEmailCode: codeHash,
          pendingEmailExpiresAt: expiresAt,
          updatedAt: new Date(),
        })
        .where(eq(customers.id, customerId));
    } else {
      await db
        .update(customers)
        .set({
          pendingPhone: newValue.trim(),
          pendingPhoneCode: codeHash,
          pendingPhoneExpiresAt: expiresAt,
          updatedAt: new Date(),
        })
        .where(eq(customers.id, customerId));
    }
  } catch (error: any) {
    if (error?.message?.includes('already uses')) {
      throw error;
    }
    console.error('Database query failed in storeCustomerPendingContactChange:', error);
    throw new Error('Failed to initiate contact verification.', { cause: error });
  }
}

export async function commitCustomerVerifiedContactChange(
  customerId: number,
  type: 'email' | 'phone',
  codeHash: string
) {
  try {
    const customer = await findCustomerById(customerId);
    if (!customer) return null;

    if (type === 'email') {
      if (
        !customer.pendingEmail ||
        !customer.pendingEmailCode ||
        customer.pendingEmailCode !== codeHash ||
        !customer.pendingEmailExpiresAt ||
        new Date(customer.pendingEmailExpiresAt) < new Date()
      ) {
        throw new Error('Invalid or expired email verification code.');
      }
      const nextEmail = customer.pendingEmail;
      const [updated] = await db
        .update(customers)
        .set({
          email: nextEmail,
          pendingEmail: null,
          pendingEmailCode: null,
          pendingEmailExpiresAt: null,
          updatedAt: new Date(),
        })
        .where(eq(customers.id, customerId))
        .returning();

      await db
        .update(orders)
        .set({ customerEmail: nextEmail, updatedAt: new Date() })
        .where(eq(orders.customerId, customerId));

      return updated;
    }

    if (
      !customer.pendingPhone ||
      !customer.pendingPhoneCode ||
      customer.pendingPhoneCode !== codeHash ||
      !customer.pendingPhoneExpiresAt ||
      new Date(customer.pendingPhoneExpiresAt) < new Date()
    ) {
      throw new Error('Invalid or expired phone verification code.');
    }

    const nextPhone = customer.pendingPhone;
    const [updated] = await db
      .update(customers)
      .set({
        phone: nextPhone,
        pendingPhone: null,
        pendingPhoneCode: null,
        pendingPhoneExpiresAt: null,
        updatedAt: new Date(),
      })
      .where(eq(customers.id, customerId))
      .returning();

    await db
      .update(orders)
      .set({ customerPhone: nextPhone, updatedAt: new Date() })
      .where(eq(orders.customerId, customerId));

    return updated;
  } catch (error: any) {
    if (error?.message?.includes('Invalid or expired')) {
      throw error;
    }
    console.error('Database query failed in commitCustomerVerifiedContactChange:', error);
    throw new Error('Failed to verify contact change.', { cause: error });
  }
}

export async function getCustomerCart(customerId: number) {
  try {
    const rows = await db
      .select({
        cartItemId: customerCartItems.id,
        quantity: customerCartItems.quantity,
        product: products,
      })
      .from(customerCartItems)
      .innerJoin(products, eq(customerCartItems.productId, products.id))
      .where(eq(customerCartItems.customerId, customerId))
      .orderBy(customerCartItems.createdAt);

    const items = rows.map((row) => ({
      id: row.cartItemId,
      productId: row.product.id,
      quantity: row.quantity,
      lineTotal: row.product.price * row.quantity,
      product: row.product,
    }));

    const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
    const totalCount = items.reduce((sum, item) => sum + item.quantity, 0);

    return { items, subtotal, totalCount };
  } catch (error) {
    console.error('Database query failed in getCustomerCart:', error);
    throw new Error('Failed to load customer cart.', { cause: error });
  }
}

export async function addToCustomerCart(
  customerId: number,
  productId: string,
  quantityDelta = 1
) {
  try {
    const prodRows = await db
      .select()
      .from(products)
      .where(eq(products.id, productId));
    const prod = prodRows[0];
    if (!prod) {
      throw new Error('Product not found.');
    }
    if (prod.availability === 'Out of Stock') {
      throw new Error('This product is currently out of stock.');
    }

    const existingRows = await db
      .select()
      .from(customerCartItems)
      .where(
        and(
          eq(customerCartItems.customerId, customerId),
          eq(customerCartItems.productId, productId)
        )
      );

    const delta = Math.max(1, Math.floor(quantityDelta));
    if (existingRows[0]) {
      await db
        .update(customerCartItems)
        .set({
          quantity: existingRows[0].quantity + delta,
          updatedAt: new Date(),
        })
        .where(eq(customerCartItems.id, existingRows[0].id));
    } else {
      await db.insert(customerCartItems).values({
        customerId,
        productId,
        quantity: delta,
      });
    }

    return getCustomerCart(customerId);
  } catch (error: any) {
    if (
      error?.message === 'Product not found.' ||
      error?.message === 'This product is currently out of stock.'
    ) {
      throw error;
    }
    console.error('Database query failed in addToCustomerCart:', error);
    throw new Error('Failed to add item to cart.', { cause: error });
  }
}

export async function setCustomerCartItemQuantity(
  customerId: number,
  productId: string,
  quantity: number
) {
  try {
    const nextQty = Math.floor(quantity);
    if (nextQty <= 0) {
      await db
        .delete(customerCartItems)
        .where(
          and(
            eq(customerCartItems.customerId, customerId),
            eq(customerCartItems.productId, productId)
          )
        );
    } else {
      const existing = await db
        .select()
        .from(customerCartItems)
        .where(
          and(
            eq(customerCartItems.customerId, customerId),
            eq(customerCartItems.productId, productId)
          )
        );
      if (existing[0]) {
        await db
          .update(customerCartItems)
          .set({ quantity: nextQty, updatedAt: new Date() })
          .where(eq(customerCartItems.id, existing[0].id));
      } else {
        await db.insert(customerCartItems).values({
          customerId,
          productId,
          quantity: nextQty,
        });
      }
    }
    return getCustomerCart(customerId);
  } catch (error) {
    console.error('Database query failed in setCustomerCartItemQuantity:', error);
    throw new Error('Failed to update cart quantity.', { cause: error });
  }
}

export async function removeCustomerCartItem(customerId: number, productId: string) {
  try {
    await db
      .delete(customerCartItems)
      .where(
        and(
          eq(customerCartItems.customerId, customerId),
          eq(customerCartItems.productId, productId)
        )
      );
    return getCustomerCart(customerId);
  } catch (error) {
    console.error('Database query failed in removeCustomerCartItem:', error);
    throw new Error('Failed to remove cart item.', { cause: error });
  }
}

export async function clearCustomerCart(customerId: number) {
  try {
    await db
      .delete(customerCartItems)
      .where(eq(customerCartItems.customerId, customerId));
    return getCustomerCart(customerId);
  } catch (error) {
    console.error('Database query failed in clearCustomerCart:', error);
    throw new Error('Failed to clear cart.', { cause: error });
  }
}

export async function listOrdersForCustomer(customerId: number, customerEmail: string) {
  try {
    const emailLower = customerEmail.trim().toLowerCase();
    const orderRows = await db
      .select()
      .from(orders)
      .where(
        or(
          eq(orders.customerId, customerId),
          eq(sql`lower(${orders.customerEmail})`, emailLower)
        )
      )
      .orderBy(desc(orders.createdAt));

    if (orderRows.length === 0) return [];

    const orderIds = orderRows.map((o) => o.id);
    const [paymentRows, notifRows] = await Promise.all([
      db.select().from(payments).where(inArray(payments.orderId, orderIds)),
      db
        .select()
        .from(orderNotifications)
        .where(inArray(orderNotifications.orderId, orderIds))
        .orderBy(desc(orderNotifications.createdAt)),
    ]);

    const paymentMap = new Map(paymentRows.map((p) => [p.orderId, p]));
    const notifMap = new Map<number, typeof notifRows>();
    for (const n of notifRows) {
      if (!n.orderId) continue;
      const arr = notifMap.get(n.orderId) || [];
      arr.push(n);
      notifMap.set(n.orderId, arr);
    }

    return orderRows.map((o) => ({
      ...o,
      payment: paymentMap.get(o.id) || null,
      notifications: notifMap.get(o.id) || [],
    }));
  } catch (error) {
    console.error('Database query failed in listOrdersForCustomer:', error);
    throw new Error('Failed to load your orders.', { cause: error });
  }
}
