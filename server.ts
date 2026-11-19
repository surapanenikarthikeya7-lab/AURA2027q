/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { adminAuth } from "./src/lib/firebase-admin.ts";
import { requireAdminAuth, type AdminAuthRequest } from "./src/middleware/auth.ts";
import { requireCustomerAuth, type CustomerAuthRequest } from "./src/middleware/customerAuth.ts";
import {
  addToCustomerCart,
  clearCustomerCart,
  commitCustomerVerifiedContactChange,
  countAdminUsers,
  createAdminSession,
  createAdminUser,
  createCustomerOrder,
  createCustomerSession,
  createProduct,
  deleteAdminSession,
  deleteCustomerSession,
  deleteProduct,
  ensureSeeded,
  exportDatabaseBackup,
  findAdminByEmail,
  findAdminByUid,
  findCustomerByEmail,
  findCustomerById,
  findOrderById,
  findOrderByNumber,
  getAllProducts,
  getCustomerCart,
  getDashboardOverview,
  getEmailSettingsRow,
  getProductsByIds,
  getStorefrontData,
  getWebsiteSettings,
  listOrders,
  listOrdersForCustomer,
  listRecentNotifications,
  registerOrUpgradeCustomerAccount,
  removeCustomerCartItem,
  sanitizeCustomerProfile,
  setAdminResetToken,
  setCustomerCartItemQuantity,
  setCustomerResetToken,
  storeCustomerPendingContactChange,
  updateAdminLoginTimestamp,
  updateAdminPassword,
  updateCustomerLoginTimestamp,
  updateCustomerPassword,
  updateCustomerProfileFields,
  updateEmailSettingsRow,
  updateOrderStatusRecord,
  updateProduct,
  updateWebsiteSettings,
  upsertGoogleCustomerAccount,
  verifyOrderPayment,
} from "./src/db/repository.ts";
import {
  encryptSecret,
  generateSessionToken,
  hashPassword,
  hashToken,
  verifyPassword,
} from "./src/server/cryptoUtils.ts";
import {
  dispatchAdminResetEmail,
  dispatchCustomerVerificationEmail,
  dispatchOrderLifecycleEmail,
  dispatchTestEmail,
  type OrderEmailEvent,
} from "./src/server/emailService.ts";

class BoundedMap<K, V> extends Map<K, V> {
  maxEntries: number;
  constructor(maxEntries: number) {
    super();
    this.maxEntries = maxEntries;
  }
  set(key: K, value: V): this {
    if (this.has(key)) {
      this.delete(key);
    } else if (this.size >= this.maxEntries) {
      const oldest = this.keys().next().value;
      if (oldest !== undefined) this.delete(oldest);
    }
    return super.set(key, value);
  }
}

function stripHttpOptions(val: any): any {
  if (!val || typeof val !== "object") return val;
  if (Array.isArray(val)) return val.map(stripHttpOptions);
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(val)) {
    if (
      k === "httpOptions" ||
      k === "http_options" ||
      k === "__proto__" ||
      k === "constructor" ||
      k === "prototype" ||
      k === "cachedContent" ||
      k === "cached_content" ||
      k === "fileSearch" ||
      k === "file_search" ||
      k === "corpora" ||
      k === "semanticRetriever" ||
      k === "semantic_retriever"
    )
      continue;
    if ((k === "fileData" || k === "file_data") && v && typeof v === "object") {
      const rawU = (v as any).fileUri ?? (v as any).file_uri;
      const u = typeof rawU === "string" ? rawU.trim() : "";
      if (!/^https:\/\/(?:www\.|m\.)?(?:youtube\.com|youtu\.be)\//i.test(u)) continue;
    }
    out[k] = stripHttpOptions(v);
  }
  return out;
}

const MODEL_UPGRADES: Record<string, string> = {
  "gemini-2.5-flash": "gemini-3-flash-preview",
  "gemini-2.5-pro": "gemini-3.1-pro-preview",
  "gemini-3-pro-preview": "gemini-3.1-pro-preview",
  "gemini-2.0-flash": "gemini-3-flash-preview",
  "gemini-2.0-flash-exp": "gemini-3-flash-preview",
};

const ALLOWED_MODEL_RE =
  /^(?!.*\.\.)(?:models\/)?(?:gemini-|imagen-|veo-|lyria-|learnlm-|text-embedding-|gemini-embedding-)[a-zA-Z0-9._-]+$/;

function resolveModel(model?: string): string {
  const candidate = !model ? "gemini-3-flash-preview" : MODEL_UPGRADES[model] || model;
  if (!ALLOWED_MODEL_RE.test(candidate)) {
    throw new Error(`Disallowed model: ${candidate}`);
  }
  return candidate;
}

function serializeGenerateContentResponse(r: any) {
  return {
    candidates: r?.candidates,
    promptFeedback: r?.promptFeedback,
    usageMetadata: r?.usageMetadata,
    modelVersion: r?.modelVersion,
    responseId: r?.responseId,
    text: r?.text,
    functionCalls: r?.functionCalls,
    data: r?.data,
    executableCode: r?.executableCode,
    codeExecutionResult: r?.codeExecutionResult,
  };
}

const chats = new BoundedMap<string, any>(200);
const videoOps = new BoundedMap<string, { op: any; ownerKey: string }>(100);

function getClientKey(req: any): string {
  const raw = req?.headers?.["x-client-id"];
  if (typeof raw === "string" && /^[a-zA-Z0-9_-]{8,128}$/.test(raw.trim())) {
    return `cid:${raw.trim()}`;
  }
  const xffParts = String(req?.headers?.["x-forwarded-for"] || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const xff = xffParts.length >= 2 ? xffParts[xffParts.length - 2] : xffParts[0] || "";
  return `ip:${xff || req?.ip || req?.socket?.remoteAddress || "unknown"}`;
}

function resolveServerPort(): number {
  const portFlagIndex = process.argv.indexOf("--port");
  if (portFlagIndex !== -1 && process.argv[portFlagIndex + 1]) {
    const cliPort = Number(process.argv[portFlagIndex + 1]);
    if (Number.isInteger(cliPort) && cliPort > 0) {
      return cliPort;
    }
  }
  const envPort = Number(process.env.PORT);
  const nginxPort = Number(process.env.NGINX_PORT);
  if (process.env.NODE_ENV !== "production" && envPort && envPort === nginxPort) {
    return Number(process.env.DEFAULT_APP_PORT) || 3000;
  }
  return envPort || Number(process.env.DEFAULT_APP_PORT) || 3000;
}

function getRequestBaseUrl(req: express.Request): string {
  const proto = req.headers["x-forwarded-proto"] || req.protocol || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return host ? `${proto}://${host}` : "";
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UPI_ID_REGEX = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;
const ALLOWED_ORDER_STATUSES = [
  "Pending",
  "Payment Verification",
  "Confirmed",
  "Processing",
  "Completed",
  "Cancelled",
  "Refund Initiated",
  "Refunded",
] as const;

function sanitizeEmailSettings(row: any) {
  if (!row) return null;
  return {
    id: row.id,
    senderName: row.senderName,
    senderEmail: row.senderEmail,
    provider: row.provider,
    smtpHost: row.smtpHost,
    smtpPort: row.smtpPort,
    smtpUser: row.smtpUser,
    smtpSecure: row.smtpSecure,
    hasSmtpPass: Boolean(row.hasSmtpPass || process.env.SMTP_PASS),
    hasResendKey: Boolean(row.hasResendKey || process.env.RESEND_API_KEY),
    updatedAt: row.updatedAt,
  };
}

function escapeCsvCell(val: unknown): string {
  const str = String(val ?? "");
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function escapeXmlHtml(val: unknown): string {
  return String(val ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function startServer() {
  const app = express();
  app.set("trust proxy", 2);
  const PORT = resolveServerPort();

  app.use(express.json({ limit: "25mb" }));
  app.use(express.urlencoded({ limit: "25mb", extended: true }));
  app.use((req, _res, next) => {
    if (req.body && typeof req.body === "object") {
      req.body = stripHttpOptions(req.body);
    }
    next();
  });

  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  const avatarsDir = path.join(uploadsDir, "avatars");
  fs.mkdirSync(uploadsDir, { recursive: true });
  fs.mkdirSync(avatarsDir, { recursive: true });
  app.use("/uploads", express.static(uploadsDir));

  for (const dir of ["examples", "assets", "public"]) {
    const dirPath = path.join(process.cwd(), dir);
    if (fs.existsSync(dirPath)) {
      app.use(`/${dir}`, express.static(dirPath));
    }
  }

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // =========================================================================
  // PUBLIC STOREFRONT & CUSTOMER ORDER ENDPOINTS (PostgreSQL-backed)
  // =========================================================================

  app.get("/api/storefront", async (_req, res): Promise<any> => {
    try {
      const data = await getStorefrontData();
      return res.json(data);
    } catch (error: any) {
      console.error("[Backend] /api/storefront error:", error);
      return res.status(500).json({ error: error.message || "Failed to load storefront." });
    }
  });

  app.post("/api/orders", async (req, res): Promise<any> => {
    try {
      const { email, phone, recipient, destination, transactionId, items } = req.body || {};

      if (typeof email !== "string" || !EMAIL_REGEX.test(email.trim())) {
        return res.status(400).json({ error: "A valid email address is required." });
      }
      if (typeof phone !== "string" || phone.replace(/\D/g, "").length < 7) {
        return res.status(400).json({ error: "A valid phone number is required." });
      }
      if (typeof recipient !== "string" || !recipient.trim()) {
        return res.status(400).json({ error: "Customer name is required." });
      }
      if (typeof destination !== "string" || !destination.trim()) {
        return res.status(400).json({ error: "Shipping address is required." });
      }
      if (typeof transactionId !== "string" || transactionId.trim().length < 6) {
        return res.status(400).json({
          error: "UPI Transaction ID is compulsory (minimum 6 characters).",
        });
      }
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "Cart items are required." });
      }

      const itemIds = Array.from(
        new Set(items.map((item: any) => String(item?.id || "")).filter(Boolean))
      );
      const dbProducts = await getProductsByIds(itemIds);
      const productMap = new Map(dbProducts.map((p) => [p.id, p]));

      const verifiedItems: Array<{
        id: string;
        name: string;
        price: number;
        quantity: number;
        imageUrl?: string;
      }> = [];
      let authoritativeTotal = 0;

      for (const rawItem of items) {
        const pid = String(rawItem?.id || "");
        const qty = Math.max(1, Math.floor(Number(rawItem?.quantity || 1)));
        const dbProduct = productMap.get(pid);
        if (!dbProduct) {
          return res.status(400).json({
            error: `Product "${String(rawItem?.name || pid)}" is no longer available.`,
          });
        }
        if (dbProduct.availability === "Out of Stock") {
          return res.status(400).json({
            error: `"${dbProduct.name}" is currently out of stock.`,
          });
        }
        verifiedItems.push({
          id: dbProduct.id,
          name: dbProduct.name,
          price: dbProduct.price,
          quantity: qty,
          imageUrl: dbProduct.imageUrl,
        });
        authoritativeTotal += dbProduct.price * qty;
      }

      const siteSettings = await getWebsiteSettings();
      const activeUpiId = siteSettings?.upiId || "9290317064@fam";
      const activeReceiver = siteSettings?.upiReceiverName || "Aura Quiet Living";

      const orderNumber = `AUR-${Math.floor(100000 + Math.random() * 900000)}`;
      const { order } = await createCustomerOrder({
        orderNumber,
        customerName: recipient.trim(),
        customerEmail: email.trim(),
        customerPhone: phone.trim(),
        shippingAddress: destination.trim(),
        items: verifiedItems,
        totalAmount: authoritativeTotal,
        upiId: activeUpiId,
        upiReceiverName: activeReceiver,
        transactionReference: transactionId.trim(),
      });

      const emailNotification = await dispatchOrderLifecycleEmail(
        {
          orderId: order.id,
          orderNumber: order.orderNumber,
          customerName: order.customerName,
          customerEmail: order.customerEmail,
          items: order.items,
          totalAmount: order.totalAmount,
          orderStatus: order.orderStatus,
          paymentStatus: order.paymentStatus,
          upiId: order.upiId,
          transactionReference: order.transactionReference,
          shippingAddress: order.shippingAddress,
        },
        "order_confirmation",
        getRequestBaseUrl(req)
      );

      return res.status(201).json({ order, emailNotification });
    } catch (error: any) {
      console.error("[Backend] /api/orders error:", error);
      return res.status(500).json({ error: error.message || "Failed to create order." });
    }
  });

  app.post("/api/orders/:orderNumber/cancel", async (req, res): Promise<any> => {
    try {
      const { orderNumber } = req.params;
      const existing = await findOrderByNumber(orderNumber);
      if (!existing) {
        return res.status(404).json({ error: "Order not found." });
      }
      if (existing.orderStatus === "Completed") {
        return res.status(400).json({ error: "Completed orders cannot be cancelled." });
      }

      const updated = await updateOrderStatusRecord(existing.id, "Cancelled");
      if (!updated) {
        return res.status(404).json({ error: "Order not found." });
      }

      const emailNotification = await dispatchOrderLifecycleEmail(
        {
          orderId: updated.id,
          orderNumber: updated.orderNumber,
          customerName: updated.customerName,
          customerEmail: updated.customerEmail,
          items: updated.items,
          totalAmount: updated.totalAmount,
          orderStatus: updated.orderStatus,
          paymentStatus: updated.paymentStatus,
          upiId: updated.upiId,
          transactionReference: updated.transactionReference,
          shippingAddress: updated.shippingAddress,
        },
        "order_cancellation",
        getRequestBaseUrl(req)
      );

      return res.json({ order: updated, emailNotification });
    } catch (error: any) {
      console.error("[Backend] /api/orders/:orderNumber/cancel error:", error);
      return res.status(500).json({ error: error.message || "Failed to cancel order." });
    }
  });

  // =========================================================================
  // ADMIN AUTHENTICATION ROUTES
  // =========================================================================

  app.get("/api/admin/auth/status", async (_req, res): Promise<any> => {
    try {
      await ensureSeeded();
      const totalAdmins = await countAdminUsers();
      return res.json({ hasAdmins: totalAdmins > 0 });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || "Failed to check admin status." });
    }
  });

  app.post("/api/admin/auth/register", async (_req, res): Promise<any> => {
    return res.status(403).json({
      error: "Public admin account creation is disabled. Please sign in with your administrator credentials.",
    });
  });

  app.post("/api/admin/auth/login", async (req, res): Promise<any> => {
    try {
      await ensureSeeded();
      const { email, password } = req.body || {};
      if (typeof email !== "string" || !EMAIL_REGEX.test(email.trim())) {
        return res.status(400).json({ error: "Enter a valid administrator email." });
      }
      if (typeof password !== "string" || !password) {
        return res.status(400).json({ error: "Password is required." });
      }

      const admin = await findAdminByEmail(email.trim().toLowerCase());
      if (!admin || !admin.passwordHash || !verifyPassword(password, admin.passwordHash)) {
        return res.status(401).json({ error: "Invalid administrator email or password." });
      }
      if (!admin.isActive || admin.role !== "admin") {
        return res.status(403).json({ error: "This administrator account is disabled." });
      }

      await updateAdminLoginTimestamp(admin.id);
      const rawToken = generateSessionToken();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await createAdminSession(admin.id, hashToken(rawToken), expiresAt);

      return res.json({
        token: rawToken,
        admin: {
          id: admin.id,
          name: admin.name,
          email: admin.email,
          role: admin.role,
        },
      });
    } catch (error: any) {
      console.error("[AdminAuth] /login error:", error);
      return res.status(500).json({ error: error.message || "Login failed." });
    }
  });

  app.post("/api/admin/auth/google", async (req, res): Promise<any> => {
    try {
      await ensureSeeded();
      const { idToken } = req.body || {};
      if (typeof idToken !== "string" || !idToken.trim()) {
        return res.status(400).json({ error: "Firebase ID token is required." });
      }

      const decoded = await adminAuth.verifyIdToken(idToken);
      const email = decoded.email?.toLowerCase();
      if (!email) {
        return res.status(400).json({ error: "Google account has no email address." });
      }

      const admin = (await findAdminByUid(decoded.uid)) || (await findAdminByEmail(email));
      if (!admin) {
        return res.status(403).json({
          error: "Access denied: This Google account is not an authorized administrator.",
        });
      }

      await updateAdminLoginTimestamp(admin.id, decoded.uid);

      if (!admin.isActive || admin.role !== "admin") {
        return res.status(403).json({ error: "Administrator access is disabled." });
      }

      const rawToken = generateSessionToken();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await createAdminSession(admin.id, hashToken(rawToken), expiresAt);

      return res.json({
        token: rawToken,
        admin: {
          id: admin.id,
          name: admin.name,
          email: admin.email,
          role: admin.role,
        },
      });
    } catch (error: any) {
      console.error("[AdminAuth] /google error:", error);
      return res.status(401).json({ error: error.message || "Google sign-in failed." });
    }
  });

  app.post("/api/admin/auth/forgot-password", async (req, res): Promise<any> => {
    try {
      await ensureSeeded();
      const { email } = req.body || {};
      if (typeof email !== "string" || !EMAIL_REGEX.test(email.trim())) {
        return res.status(400).json({ error: "Please enter a valid administrator email." });
      }

      const admin = await findAdminByEmail(email.trim().toLowerCase());
      if (!admin) {
        return res.json({
          sent: false,
          message: "If an administrator account exists for that email, a reset code has been issued.",
        });
      }

      const code = String(Math.floor(100000 + Math.random() * 900000));
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
      await setAdminResetToken(admin.id, hashToken(code), expiresAt);

      const mailResult = await dispatchAdminResetEmail(admin.email, admin.name, code);
      return res.json({
        sent: mailResult.status === "sent",
        message:
          mailResult.status === "sent"
            ? "A 6-digit password reset code has been sent to your email."
            : "Mail Sender SMTP/Resend is not yet configured. Use the temporary verification code below to reset your password.",
        ...(mailResult.status !== "sent" ? { fallbackCode: code } : {}),
      });
    } catch (error: any) {
      console.error("[AdminAuth] /forgot-password error:", error);
      return res.status(500).json({ error: error.message || "Failed to initiate password reset." });
    }
  });

  app.post("/api/admin/auth/reset-password", async (req, res): Promise<any> => {
    try {
      const { email, code, newPassword } = req.body || {};
      if (typeof email !== "string" || !EMAIL_REGEX.test(email.trim())) {
        return res.status(400).json({ error: "Valid email is required." });
      }
      if (typeof code !== "string" || code.trim().length < 6) {
        return res.status(400).json({ error: "Valid 6-digit verification code is required." });
      }
      if (typeof newPassword !== "string" || newPassword.length < 6) {
        return res.status(400).json({ error: "New password must be at least 6 characters." });
      }

      const admin = await findAdminByEmail(email.trim().toLowerCase());
      if (
        !admin ||
        !admin.resetToken ||
        !admin.resetTokenExpiresAt ||
        admin.resetTokenExpiresAt.getTime() < Date.now() ||
        admin.resetToken !== hashToken(code.trim())
      ) {
        return res.status(400).json({ error: "Invalid or expired password reset code." });
      }

      await updateAdminPassword(admin.id, hashPassword(newPassword));
      return res.json({ message: "Password updated successfully. You may now sign in." });
    } catch (error: any) {
      console.error("[AdminAuth] /reset-password error:", error);
      return res.status(500).json({ error: error.message || "Failed to reset password." });
    }
  });

  app.get("/api/admin/auth/me", requireAdminAuth, (req: AdminAuthRequest, res): any => {
    return res.json({ admin: req.adminUser });
  });

  app.post(
    "/api/admin/auth/logout",
    requireAdminAuth,
    async (req: AdminAuthRequest, res): Promise<any> => {
      try {
        if (req.sessionTokenHash) {
          await deleteAdminSession(req.sessionTokenHash);
        }
        return res.json({ ok: true });
      } catch (error: any) {
        return res.status(500).json({ error: error.message || "Logout failed." });
      }
    }
  );

  // =========================================================================
  // ADMIN DASHBOARD, PRODUCTS, ORDERS, PAYMENTS, MAIL, PROFILE & BACKUP
  // =========================================================================

  app.get("/api/admin/dashboard", requireAdminAuth, async (_req, res): Promise<any> => {
    try {
      const overview = await getDashboardOverview();
      return res.json(overview);
    } catch (error: any) {
      return res.status(500).json({ error: error.message || "Failed to load dashboard." });
    }
  });

  app.get("/api/admin/products", requireAdminAuth, async (req, res): Promise<any> => {
    try {
      const q = typeof req.query.q === "string" ? req.query.q : undefined;
      const rows = await getAllProducts(q);
      return res.json({ products: rows });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || "Failed to load products." });
    }
  });

  app.post("/api/admin/products", requireAdminAuth, async (req, res): Promise<any> => {
    try {
      const {
        name,
        tagline,
        description,
        longDescription,
        price,
        category,
        availability,
        imageUrl,
        gallery,
        features,
      } = req.body || {};

      if (typeof name !== "string" || !name.trim()) {
        return res.status(400).json({ error: "Product name is required." });
      }
      const numericPrice = Number(price);
      if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
        return res.status(400).json({ error: "Product price must be greater than ₹0." });
      }
      if (typeof description !== "string" || !description.trim()) {
        return res.status(400).json({ error: "Product details / description are required." });
      }
      if (typeof category !== "string" || !category.trim()) {
        return res.status(400).json({ error: "Product category is required." });
      }
      if (typeof imageUrl !== "string" || !imageUrl.trim()) {
        return res.status(400).json({ error: "Product image is required." });
      }

      const cleanAvailability =
        availability === "Out of Stock" ? "Out of Stock" : "Available";
      const cleanGallery = Array.isArray(gallery)
        ? gallery.filter((g): g is string => typeof g === "string" && g.trim().length > 0)
        : [imageUrl.trim()];
      if (cleanGallery.length === 0) cleanGallery.push(imageUrl.trim());

      const cleanFeatures = Array.isArray(features)
        ? features.filter((f): f is string => typeof f === "string" && f.trim().length > 0)
        : [];

      const created = await createProduct({
        id: `prod_${crypto.randomUUID().slice(0, 8)}`,
        name: name.trim(),
        tagline: typeof tagline === "string" && tagline.trim() ? tagline.trim() : category.trim(),
        description: description.trim(),
        longDescription:
          typeof longDescription === "string" && longDescription.trim()
            ? longDescription.trim()
            : description.trim(),
        price: Math.round(numericPrice),
        category: category.trim(),
        availability: cleanAvailability,
        imageUrl: imageUrl.trim(),
        gallery: cleanGallery,
        features: cleanFeatures,
      });

      return res.status(201).json({ product: created });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || "Failed to add product." });
    }
  });

  app.put("/api/admin/products/:id", requireAdminAuth, async (req, res): Promise<any> => {
    try {
      const { id } = req.params;
      const {
        name,
        tagline,
        description,
        longDescription,
        price,
        category,
        availability,
        imageUrl,
        gallery,
        features,
      } = req.body || {};

      if (typeof name !== "string" || !name.trim()) {
        return res.status(400).json({ error: "Product name is required." });
      }
      const numericPrice = Number(price);
      if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
        return res.status(400).json({ error: "Product price must be greater than ₹0." });
      }
      if (typeof description !== "string" || !description.trim()) {
        return res.status(400).json({ error: "Product details / description are required." });
      }
      if (typeof category !== "string" || !category.trim()) {
        return res.status(400).json({ error: "Product category is required." });
      }
      if (typeof imageUrl !== "string" || !imageUrl.trim()) {
        return res.status(400).json({ error: "Product image is required." });
      }

      const cleanAvailability =
        availability === "Out of Stock" ? "Out of Stock" : "Available";
      const cleanGallery = Array.isArray(gallery)
        ? gallery.filter((g): g is string => typeof g === "string" && g.trim().length > 0)
        : [imageUrl.trim()];
      if (!cleanGallery.includes(imageUrl.trim())) {
        cleanGallery.unshift(imageUrl.trim());
      }

      const cleanFeatures = Array.isArray(features)
        ? features.filter((f): f is string => typeof f === "string" && f.trim().length > 0)
        : [];

      const updated = await updateProduct(id, {
        name: name.trim(),
        tagline: typeof tagline === "string" && tagline.trim() ? tagline.trim() : category.trim(),
        description: description.trim(),
        longDescription:
          typeof longDescription === "string" && longDescription.trim()
            ? longDescription.trim()
            : description.trim(),
        price: Math.round(numericPrice),
        category: category.trim(),
        availability: cleanAvailability,
        imageUrl: imageUrl.trim(),
        gallery: cleanGallery,
        features: cleanFeatures,
      });

      if (!updated) {
        return res.status(404).json({ error: "Product not found." });
      }

      return res.json({ product: updated });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || "Failed to update product." });
    }
  });

  app.delete("/api/admin/products/:id", requireAdminAuth, async (req, res): Promise<any> => {
    try {
      const deleted = await deleteProduct(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Product not found." });
      }
      return res.json({ deleted });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || "Failed to delete product." });
    }
  });

  app.get("/api/admin/orders", requireAdminAuth, async (req, res): Promise<any> => {
    try {
      const orders = await listOrders({
        q: typeof req.query.q === "string" ? req.query.q : undefined,
        paymentStatus:
          typeof req.query.paymentStatus === "string" ? req.query.paymentStatus : undefined,
        orderStatus:
          typeof req.query.orderStatus === "string" ? req.query.orderStatus : undefined,
        dateFrom: typeof req.query.dateFrom === "string" ? req.query.dateFrom : undefined,
        dateTo: typeof req.query.dateTo === "string" ? req.query.dateTo : undefined,
      });
      return res.json({ orders });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || "Failed to load orders." });
    }
  });

  app.get("/api/admin/orders/export", requireAdminAuth, async (req, res): Promise<any> => {
    try {
      const format = req.query.format === "xls" ? "xls" : "csv";
      const orders = await listOrders({
        q: typeof req.query.q === "string" ? req.query.q : undefined,
        paymentStatus:
          typeof req.query.paymentStatus === "string" ? req.query.paymentStatus : undefined,
        orderStatus:
          typeof req.query.orderStatus === "string" ? req.query.orderStatus : undefined,
        dateFrom: typeof req.query.dateFrom === "string" ? req.query.dateFrom : undefined,
        dateTo: typeof req.query.dateTo === "string" ? req.query.dateTo : undefined,
      });

      const headers = [
        "Order ID",
        "Customer Name",
        "Customer Email",
        "Customer Phone",
        "Products",
        "Amount (INR)",
        "Payment Status",
        "Order Status",
        "UPI ID",
        "Transaction Reference",
        "Shipping Address",
        "Order Date",
      ];

      const rows = orders.map((o) => [
        o.orderNumber,
        o.customerName,
        o.customerEmail,
        o.customerPhone,
        o.items.map((i) => `${i.name} (x${i.quantity})`).join("; "),
        o.totalAmount,
        o.paymentStatus,
        o.orderStatus,
        o.upiId,
        o.transactionReference,
        o.shippingAddress,
        new Date(o.createdAt).toISOString(),
      ]);

      if (format === "xls") {
        const htmlTable = `<html><head><meta charset="UTF-8" /></head><body><table border="1"><thead><tr>${headers
          .map((h) => `<th>${escapeXmlHtml(h)}</th>`)
          .join("")}</tr></thead><tbody>${rows
          .map(
            (r) =>
              `<tr>${r.map((cell) => `<td>${escapeXmlHtml(cell)}</td>`).join("")}</tr>`
          )
          .join("")}</tbody></table></body></html>`;
        res.setHeader("Content-Type", "application/vnd.ms-excel; charset=utf-8");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="orders-export-${new Date().toISOString().slice(0, 10)}.xls"`
        );
        return res.send(htmlTable);
      }

      const csvContent = [
        headers.map(escapeCsvCell).join(","),
        ...rows.map((r) => r.map(escapeCsvCell).join(",")),
      ].join("\r\n");

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="orders-export-${new Date().toISOString().slice(0, 10)}.csv"`
      );
      return res.send(csvContent);
    } catch (error: any) {
      return res.status(500).json({ error: error.message || "Failed to export orders." });
    }
  });

  app.get("/api/admin/orders/:id", requireAdminAuth, async (req, res): Promise<any> => {
    try {
      const orderId = Number(req.params.id);
      if (!Number.isInteger(orderId) || orderId <= 0) {
        return res.status(400).json({ error: "Invalid order ID." });
      }
      const order = await findOrderById(orderId);
      if (!order) {
        return res.status(404).json({ error: "Order not found." });
      }
      return res.json({ order });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || "Failed to load order." });
    }
  });

  app.post(
    "/api/admin/orders/:id/verify-payment",
    requireAdminAuth,
    async (req: AdminAuthRequest, res): Promise<any> => {
      try {
        const orderId = Number(req.params.id);
        const action = req.body?.action === "reject" ? "reject" : "verify";
        if (!Number.isInteger(orderId) || orderId <= 0) {
          return res.status(400).json({ error: "Invalid order ID." });
        }

        const updated = await verifyOrderPayment(
          orderId,
          action,
          req.adminUser?.email || "admin"
        );
        if (!updated) {
          return res.status(404).json({ error: "Order not found." });
        }

        const eventType: OrderEmailEvent =
          action === "verify" ? "payment_confirmation" : "order_cancellation";

        const notification = await dispatchOrderLifecycleEmail(
          {
            orderId: updated.id,
            orderNumber: updated.orderNumber,
            customerName: updated.customerName,
            customerEmail: updated.customerEmail,
            items: updated.items,
            totalAmount: updated.totalAmount,
            orderStatus: updated.orderStatus,
            paymentStatus: updated.paymentStatus,
            upiId: updated.upiId,
            transactionReference: updated.transactionReference,
            shippingAddress: updated.shippingAddress,
          },
          eventType,
          getRequestBaseUrl(req)
        );

        return res.json({ order: updated, notification });
      } catch (error: any) {
        return res
          .status(500)
          .json({ error: error.message || "Failed to verify payment." });
      }
    }
  );

  app.patch(
    "/api/admin/orders/:id/status",
    requireAdminAuth,
    async (req, res): Promise<any> => {
      try {
        const orderId = Number(req.params.id);
        const nextStatus = req.body?.orderStatus;
        if (!Number.isInteger(orderId) || orderId <= 0) {
          return res.status(400).json({ error: "Invalid order ID." });
        }
        if (
          typeof nextStatus !== "string" ||
          !ALLOWED_ORDER_STATUSES.includes(nextStatus as any)
        ) {
          return res.status(400).json({ error: "Invalid order status value." });
        }

        const updated = await updateOrderStatusRecord(orderId, nextStatus);
        if (!updated) {
          return res.status(404).json({ error: "Order not found." });
        }

        let eventType: OrderEmailEvent = "order_status_update";
        if (nextStatus === "Cancelled") {
          eventType = "order_cancellation";
        } else if (nextStatus === "Refund Initiated" || nextStatus === "Refunded") {
          eventType = "refund_notification";
        }

        const notification = await dispatchOrderLifecycleEmail(
          {
            orderId: updated.id,
            orderNumber: updated.orderNumber,
            customerName: updated.customerName,
            customerEmail: updated.customerEmail,
            items: updated.items,
            totalAmount: updated.totalAmount,
            orderStatus: updated.orderStatus,
            paymentStatus: updated.paymentStatus,
            upiId: updated.upiId,
            transactionReference: updated.transactionReference,
            shippingAddress: updated.shippingAddress,
          },
          eventType,
          getRequestBaseUrl(req)
        );

        return res.json({ order: updated, notification });
      } catch (error: any) {
        return res.status(500).json({ error: error.message || "Failed to update order status." });
      }
    }
  );

  app.get("/api/admin/settings/payment", requireAdminAuth, async (_req, res): Promise<any> => {
    try {
      const site = await getWebsiteSettings();
      return res.json({
        upiId: site.upiId,
        upiReceiverName: site.upiReceiverName,
        updatedAt: site.updatedAt,
      });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || "Failed to load payment settings." });
    }
  });

  app.put("/api/admin/settings/payment", requireAdminAuth, async (req, res): Promise<any> => {
    try {
      const { upiId, upiReceiverName } = req.body || {};
      if (typeof upiId !== "string" || !UPI_ID_REGEX.test(upiId.trim())) {
        return res.status(400).json({
          error: "Enter a valid UPI ID (for example: name@bank or 9290317064@fam).",
        });
      }
      if (typeof upiReceiverName !== "string" || !upiReceiverName.trim()) {
        return res.status(400).json({ error: "Payment receiver name is required." });
      }

      const updated = await updateWebsiteSettings({
        upiId: upiId.trim(),
        upiReceiverName: upiReceiverName.trim(),
      });

      return res.json({
        upiId: updated.upiId,
        upiReceiverName: updated.upiReceiverName,
        updatedAt: updated.updatedAt,
      });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || "Failed to save payment settings." });
    }
  });

  app.get("/api/admin/settings/email", requireAdminAuth, async (_req, res): Promise<any> => {
    try {
      const row = await getEmailSettingsRow();
      return res.json({ emailSettings: sanitizeEmailSettings(row) });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || "Failed to load email settings." });
    }
  });

  app.put("/api/admin/settings/email", requireAdminAuth, async (req, res): Promise<any> => {
    try {
      const {
        senderName,
        senderEmail,
        provider,
        smtpHost,
        smtpPort,
        smtpUser,
        smtpSecure,
        smtpPass,
        resendApiKey,
      } = req.body || {};

      if (typeof senderName !== "string" || !senderName.trim()) {
        return res.status(400).json({ error: "Sender Name is required." });
      }
      if (typeof senderEmail !== "string" || !EMAIL_REGEX.test(senderEmail.trim())) {
        return res.status(400).json({ error: "A valid Sender Email Address is required." });
      }
      const cleanProvider = provider === "resend" ? "resend" : "smtp";
      const parsedPort = Number(smtpPort || 587);
      if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
        return res.status(400).json({ error: "SMTP Port must be between 1 and 65535." });
      }

      const patch: Record<string, any> = {
        senderName: senderName.trim(),
        senderEmail: senderEmail.trim(),
        provider: cleanProvider,
        smtpHost: typeof smtpHost === "string" ? smtpHost.trim() : "",
        smtpPort: parsedPort,
        smtpUser: typeof smtpUser === "string" ? smtpUser.trim() : "",
        smtpSecure: Boolean(smtpSecure),
      };

      if (typeof smtpPass === "string" && smtpPass.trim().length > 0) {
        patch.smtpPassEnc = encryptSecret(smtpPass.trim());
        patch.hasSmtpPass = true;
      }
      if (typeof resendApiKey === "string" && resendApiKey.trim().length > 0) {
        patch.resendApiKeyEnc = encryptSecret(resendApiKey.trim());
        patch.hasResendKey = true;
      }

      const updated = await updateEmailSettingsRow(patch);
      return res.json({ emailSettings: sanitizeEmailSettings(updated) });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || "Failed to save email settings." });
    }
  });

  app.post("/api/admin/settings/email/test", requireAdminAuth, async (req, res): Promise<any> => {
    try {
      const { testEmail } = req.body || {};
      if (typeof testEmail !== "string" || !EMAIL_REGEX.test(testEmail.trim())) {
        return res.status(400).json({ error: "Enter a valid test recipient email address." });
      }
      const result = await dispatchTestEmail(testEmail.trim(), getRequestBaseUrl(req));
      return res.json(result);
    } catch (error: any) {
      return res.status(500).json({ error: error.message || "Failed to send test email." });
    }
  });

  app.get("/api/admin/notifications", requireAdminAuth, async (_req, res): Promise<any> => {
    try {
      const notifications = await listRecentNotifications(40);
      return res.json({ notifications });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || "Failed to load notifications." });
    }
  });

  app.get("/api/admin/settings/website", requireAdminAuth, async (_req, res): Promise<any> => {
    try {
      const site = await getWebsiteSettings();
      return res.json({ websiteSettings: site });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || "Failed to load website profile." });
    }
  });

  app.put("/api/admin/settings/website", requireAdminAuth, async (req, res): Promise<any> => {
    try {
      const {
        websiteName,
        logoUrl,
        heroBackgroundUrl,
        contactEmail,
        contactPhone,
        contactAddress,
      } = req.body || {};

      if (typeof websiteName !== "string" || !websiteName.trim()) {
        return res.status(400).json({ error: "Website Name is required." });
      }
      if (typeof contactEmail !== "string" || !EMAIL_REGEX.test(contactEmail.trim())) {
        return res.status(400).json({ error: "Valid website contact email is required." });
      }

      const updated = await updateWebsiteSettings({
        websiteName: websiteName.trim(),
        logoUrl: typeof logoUrl === "string" && logoUrl.trim() ? logoUrl.trim() : null,
        heroBackgroundUrl:
          typeof heroBackgroundUrl === "string" && heroBackgroundUrl.trim()
            ? heroBackgroundUrl.trim()
            : null,
        contactEmail: contactEmail.trim(),
        contactPhone: typeof contactPhone === "string" ? contactPhone.trim() : "",
        contactAddress: typeof contactAddress === "string" ? contactAddress.trim() : "",
      });

      return res.json({ websiteSettings: updated });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || "Failed to save website profile." });
    }
  });

  app.post("/api/admin/upload", requireAdminAuth, async (req, res): Promise<any> => {
    try {
      const { dataUrl, filename } = req.body || {};
      if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) {
        return res.status(400).json({
          error: "Invalid image format. Only PNG, JPG, WEBP, or SVG images are allowed.",
        });
      }

      const match = dataUrl.match(
        /^data:image\/(png|jpeg|jpg|webp|svg\+xml);base64,([A-Za-z0-9+/=]+)$/
      );
      if (!match) {
        return res.status(400).json({
          error: "Unsupported image encoding. Use PNG, JPG, WEBP, or SVG.",
        });
      }

      const rawType = match[1];
      const ext = rawType === "jpeg" ? "jpg" : rawType === "svg+xml" ? "svg" : rawType;
      const buffer = Buffer.from(match[2], "base64");

      const maxBytes = 5 * 1024 * 1024;
      if (buffer.length === 0 || buffer.length > maxBytes) {
        return res.status(400).json({
          error: "Image size must be between 1 byte and 5 MB.",
        });
      }

      const safeBase =
        typeof filename === "string"
          ? filename
              .replace(/\.[^.]+$/, "")
              .replace(/[^a-zA-Z0-9_-]/g, "-")
              .slice(0, 32)
          : "asset";
      const fileName = `${safeBase || "asset"}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
      const targetPath = path.join(uploadsDir, fileName);
      await fs.promises.writeFile(targetPath, buffer);

      return res.status(201).json({ url: `/uploads/${fileName}` });
    } catch (error: any) {
      console.error("[Upload] Error saving image:", error);
      return res.status(500).json({ error: error.message || "Failed to upload image." });
    }
  });

  app.get("/api/admin/backup", requireAdminAuth, async (_req, res): Promise<any> => {
    try {
      const backup = await exportDatabaseBackup();
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="aura-db-backup-${new Date().toISOString().slice(0, 10)}.json"`
      );
      return res.send(JSON.stringify(backup, null, 2));
    } catch (error: any) {
      return res.status(500).json({ error: error.message || "Failed to export backup." });
    }
  });

  // =========================================================================
  // PUBLIC CUSTOMER PORTAL ROUTES (ISOLATED FROM ADMIN AUTHENTICATION)
  // =========================================================================

  app.post("/api/customer/auth/register", async (req, res): Promise<any> => {
    try {
      await ensureSeeded();
      const { name, email, phone, password } = req.body || {};
      if (typeof name !== "string" || name.trim().length < 2) {
        return res.status(400).json({ error: "Full name must be at least 2 characters." });
      }
      if (typeof email !== "string" || !EMAIL_REGEX.test(email.trim())) {
        return res.status(400).json({ error: "Please enter a valid email address." });
      }
      if (typeof password !== "string" || password.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters." });
      }

      const created = await registerOrUpgradeCustomerAccount({
        name: name.trim(),
        email: email.trim(),
        phone: typeof phone === "string" ? phone.trim() : "",
        passwordHash: hashPassword(password),
      });

      const rawToken = generateSessionToken();
      const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
      await createCustomerSession(created.id, hashToken(rawToken), expiresAt);

      return res.status(201).json({
        token: rawToken,
        customer: sanitizeCustomerProfile(created),
      });
    } catch (error: any) {
      const status = error?.message?.includes("already exists") ? 409 : 500;
      return res.status(status).json({ error: error.message || "Registration failed." });
    }
  });

  app.post("/api/customer/auth/login", async (req, res): Promise<any> => {
    try {
      await ensureSeeded();
      const { email, password } = req.body || {};
      if (typeof email !== "string" || !EMAIL_REGEX.test(email.trim())) {
        return res.status(400).json({ error: "Enter a valid email address." });
      }
      if (typeof password !== "string" || !password) {
        return res.status(400).json({ error: "Password is required." });
      }

      const customer = await findCustomerByEmail(email.trim());
      if (
        !customer ||
        !customer.isRegistered ||
        !customer.passwordHash ||
        !verifyPassword(password, customer.passwordHash)
      ) {
        return res.status(401).json({ error: "Invalid email or password." });
      }

      await updateCustomerLoginTimestamp(customer.id);
      const rawToken = generateSessionToken();
      const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
      await createCustomerSession(customer.id, hashToken(rawToken), expiresAt);

      return res.json({
        token: rawToken,
        customer: sanitizeCustomerProfile(customer),
      });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || "Customer login failed." });
    }
  });

  app.post("/api/customer/auth/google", async (req, res): Promise<any> => {
    try {
      await ensureSeeded();
      const { idToken } = req.body || {};
      if (typeof idToken !== "string" || !idToken.trim()) {
        return res.status(400).json({ error: "Google ID token is required." });
      }

      const decoded = await adminAuth.verifyIdToken(idToken);
      const email = decoded.email?.trim().toLowerCase();
      if (!email) {
        return res.status(400).json({ error: "Google account does not provide an email address." });
      }

      const customer = await upsertGoogleCustomerAccount({
        name: decoded.name || email.split("@")[0] || "Customer",
        email,
        profilePictureUrl: decoded.picture || null,
      });

      const rawToken = generateSessionToken();
      const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
      await createCustomerSession(customer.id, hashToken(rawToken), expiresAt);

      return res.json({
        token: rawToken,
        customer: sanitizeCustomerProfile(customer),
      });
    } catch (error: any) {
      console.error("[CustomerAuth] /google error:", error);
      return res.status(401).json({
        error: error?.message || "Google sign-in verification failed.",
      });
    }
  });

  app.post("/api/customer/auth/forgot-password", async (req, res): Promise<any> => {
    try {
      const { email } = req.body || {};
      if (typeof email !== "string" || !EMAIL_REGEX.test(email.trim())) {
        return res.status(400).json({ error: "Enter a valid email address." });
      }

      const customer = await findCustomerByEmail(email.trim());
      if (!customer || !customer.isRegistered) {
        return res.json({
          sent: false,
          message: "If a registered account matches that email, a reset code was issued.",
        });
      }

      const code = String(Math.floor(100000 + Math.random() * 900000));
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
      await setCustomerResetToken(customer.id, hashToken(code), expiresAt);

      const mailResult = await dispatchCustomerVerificationEmail(
        customer.email,
        customer.name,
        code,
        "password_reset"
      );

      return res.json({
        sent: mailResult.status === "sent",
        message:
          mailResult.status === "sent"
            ? "A 6-digit reset verification code has been sent to your email."
            : "SMTP / Resend is not yet configured in Admin Mail Sender. Use the verification code below:",
        ...(mailResult.status !== "sent" ? { fallbackCode: code } : {}),
      });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || "Unable to send reset code." });
    }
  });

  app.post("/api/customer/auth/reset-password", async (req, res): Promise<any> => {
    try {
      const { email, code, newPassword } = req.body || {};
      if (typeof email !== "string" || !EMAIL_REGEX.test(email.trim())) {
        return res.status(400).json({ error: "Valid email is required." });
      }
      if (typeof code !== "string" || code.trim().length < 6) {
        return res.status(400).json({ error: "Valid 6-digit verification code is required." });
      }
      if (typeof newPassword !== "string" || newPassword.length < 6) {
        return res.status(400).json({ error: "New password must be at least 6 characters." });
      }

      const customer = await findCustomerByEmail(email.trim());
      if (
        !customer ||
        !customer.isRegistered ||
        !customer.resetToken ||
        customer.resetToken !== hashToken(code.trim()) ||
        !customer.resetTokenExpiresAt ||
        new Date(customer.resetTokenExpiresAt) < new Date()
      ) {
        return res.status(400).json({ error: "Invalid or expired verification code." });
      }

      await updateCustomerPassword(customer.id, hashPassword(newPassword));
      return res.json({ message: "Password updated. You can now sign in." });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || "Failed to reset password." });
    }
  });

  app.get(
    "/api/customer/auth/me",
    requireCustomerAuth,
    (req: CustomerAuthRequest, res): any => {
      return res.json({ customer: req.customerUser });
    }
  );

  app.post(
    "/api/customer/auth/logout",
    requireCustomerAuth,
    async (req: CustomerAuthRequest, res): Promise<any> => {
      try {
        if (req.customerTokenHash) {
          await deleteCustomerSession(req.customerTokenHash);
        }
        return res.json({ loggedOut: true });
      } catch (error: any) {
        return res.status(500).json({ error: error.message || "Logout failed." });
      }
    }
  );

  app.patch(
    "/api/customer/profile",
    requireCustomerAuth,
    async (req: CustomerAuthRequest, res): Promise<any> => {
      try {
        const customerId = req.customerUser!.id;
        const { name, profilePictureUrl, address } = req.body || {};

        if (name !== undefined && (typeof name !== "string" || name.trim().length < 2)) {
          return res.status(400).json({ error: "Display name must be at least 2 characters." });
        }

        const updated = await updateCustomerProfileFields(customerId, {
          ...(typeof name === "string" ? { name: name.trim() } : {}),
          ...(profilePictureUrl !== undefined
            ? {
                profilePictureUrl:
                  typeof profilePictureUrl === "string" && profilePictureUrl.trim()
                    ? profilePictureUrl.trim()
                    : null,
              }
            : {}),
          ...(typeof address === "string" ? { address: address.trim() } : {}),
        });

        if (!updated) {
          return res.status(404).json({ error: "Customer profile not found." });
        }
        return res.json({ customer: sanitizeCustomerProfile(updated) });
      } catch (error: any) {
        return res.status(500).json({ error: error.message || "Failed to update profile." });
      }
    }
  );

  app.post(
    "/api/customer/profile/request-verification",
    requireCustomerAuth,
    async (req: CustomerAuthRequest, res): Promise<any> => {
      try {
        const customerId = req.customerUser!.id;
        const { type, newValue } = req.body || {};
        if (type !== "email" && type !== "phone") {
          return res.status(400).json({ error: "Verification type must be email or phone." });
        }
        if (typeof newValue !== "string" || !newValue.trim()) {
          return res.status(400).json({ error: `New ${type} is required.` });
        }

        if (type === "email" && !EMAIL_REGEX.test(newValue.trim())) {
          return res.status(400).json({ error: "Enter a valid new email address." });
        }
        if (type === "phone" && newValue.replace(/\D/g, "").length < 7) {
          return res.status(400).json({ error: "Enter a valid phone number (at least 7 digits)." });
        }

        const code = String(Math.floor(100000 + Math.random() * 900000));
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
        await storeCustomerPendingContactChange(
          customerId,
          type,
          newValue.trim(),
          hashToken(code),
          expiresAt
        );

        if (type === "email") {
          const mailRes = await dispatchCustomerVerificationEmail(
            newValue.trim(),
            req.customerUser!.name,
            code,
            "email_change"
          );
          return res.json({
            sent: mailRes.status === "sent",
            message:
              mailRes.status === "sent"
                ? `A verification code was sent to ${newValue.trim()}.`
                : "SMTP / Resend is not yet configured. Enter the verification code below to confirm your email change:",
            ...(mailRes.status !== "sent" ? { fallbackCode: code } : {}),
          });
        }

        return res.json({
          sent: false,
          message: `Enter the verification code below to confirm your new phone number (${newValue.trim()}):`,
          fallbackCode: code,
        });
      } catch (error: any) {
        const status = error?.message?.includes("already uses") ? 409 : 500;
        return res
          .status(status)
          .json({ error: error.message || "Failed to request verification." });
      }
    }
  );

  app.post(
    "/api/customer/profile/confirm-verification",
    requireCustomerAuth,
    async (req: CustomerAuthRequest, res): Promise<any> => {
      try {
        const customerId = req.customerUser!.id;
        const { type, code } = req.body || {};
        if (type !== "email" && type !== "phone") {
          return res.status(400).json({ error: "Verification type must be email or phone." });
        }
        if (typeof code !== "string" || code.trim().length < 6) {
          return res.status(400).json({ error: "Enter the 6-digit verification code." });
        }

        const updated = await commitCustomerVerifiedContactChange(
          customerId,
          type,
          hashToken(code.trim())
        );
        if (!updated) {
          return res.status(404).json({ error: "Customer not found." });
        }
        return res.json({ customer: sanitizeCustomerProfile(updated) });
      } catch (error: any) {
        const status = error?.message?.includes("Invalid or expired") ? 400 : 500;
        return res
          .status(status)
          .json({ error: error.message || "Failed to verify contact update." });
      }
    }
  );

  app.post(
    "/api/customer/upload",
    requireCustomerAuth,
    async (req: CustomerAuthRequest, res): Promise<any> => {
      try {
        const { dataUrl, filename } = req.body || {};
        if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) {
          return res.status(400).json({
            error: "Only JPG, JPEG, PNG, or WebP profile pictures are supported.",
          });
        }

        const match = dataUrl.match(
          /^data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=]+)$/
        );
        if (!match) {
          return res.status(400).json({
            error: "Unsupported image format. Please use JPG, JPEG, PNG, or WebP.",
          });
        }

        const rawType = match[1];
        const ext = rawType === "jpeg" ? "jpg" : rawType;
        const buffer = Buffer.from(match[2], "base64");
        if (buffer.length === 0 || buffer.length > 5 * 1024 * 1024) {
          return res.status(400).json({
            error: "Profile picture must be between 1 byte and 5 MB.",
          });
        }

        const safeBase =
          typeof filename === "string"
            ? filename
                .replace(/\.[^.]+$/, "")
                .replace(/[^a-zA-Z0-9_-]/g, "-")
                .slice(0, 24)
            : "dp";
        const fileName = `dp-${req.customerUser!.id}-${safeBase || "avatar"}-${crypto
          .randomUUID()
          .slice(0, 8)}.${ext}`;
        const targetPath = path.join(avatarsDir, fileName);
        await fs.promises.writeFile(targetPath, buffer);

        return res.status(201).json({ url: `/uploads/avatars/${fileName}` });
      } catch (error: any) {
        console.error("[CustomerUpload] Error saving avatar:", error);
        return res.status(500).json({ error: error.message || "Failed to upload avatar." });
      }
    }
  );

  app.get(
    "/api/customer/cart",
    requireCustomerAuth,
    async (req: CustomerAuthRequest, res): Promise<any> => {
      try {
        const cart = await getCustomerCart(req.customerUser!.id);
        return res.json(cart);
      } catch (error: any) {
        return res.status(500).json({ error: error.message || "Failed to load cart." });
      }
    }
  );

  app.post(
    "/api/customer/cart",
    requireCustomerAuth,
    async (req: CustomerAuthRequest, res): Promise<any> => {
      try {
        const { productId, quantity } = req.body || {};
        if (typeof productId !== "string" || !productId.trim()) {
          return res.status(400).json({ error: "Product ID is required." });
        }
        const qty = Number(quantity || 1);
        const cart = await addToCustomerCart(
          req.customerUser!.id,
          productId.trim(),
          Number.isFinite(qty) && qty > 0 ? Math.floor(qty) : 1
        );
        return res.status(201).json(cart);
      } catch (error: any) {
        const status =
          error?.message === "Product not found."
            ? 404
            : error?.message?.includes("out of stock")
              ? 400
              : 500;
        return res.status(status).json({ error: error.message || "Failed to update cart." });
      }
    }
  );

  app.patch(
    "/api/customer/cart/:productId",
    requireCustomerAuth,
    async (req: CustomerAuthRequest, res): Promise<any> => {
      try {
        const qty = Number(req.body?.quantity);
        if (!Number.isFinite(qty)) {
          return res.status(400).json({ error: "Valid quantity is required." });
        }
        const cart = await setCustomerCartItemQuantity(
          req.customerUser!.id,
          req.params.productId,
          qty
        );
        return res.json(cart);
      } catch (error: any) {
        return res.status(500).json({ error: error.message || "Failed to update quantity." });
      }
    }
  );

  app.delete(
    "/api/customer/cart/:productId",
    requireCustomerAuth,
    async (req: CustomerAuthRequest, res): Promise<any> => {
      try {
        const cart = await removeCustomerCartItem(
          req.customerUser!.id,
          req.params.productId
        );
        return res.json(cart);
      } catch (error: any) {
        return res.status(500).json({ error: error.message || "Failed to remove item." });
      }
    }
  );

  app.delete(
    "/api/customer/cart",
    requireCustomerAuth,
    async (req: CustomerAuthRequest, res): Promise<any> => {
      try {
        const cart = await clearCustomerCart(req.customerUser!.id);
        return res.json(cart);
      } catch (error: any) {
        return res.status(500).json({ error: error.message || "Failed to clear cart." });
      }
    }
  );

  app.get(
    "/api/customer/orders",
    requireCustomerAuth,
    async (req: CustomerAuthRequest, res): Promise<any> => {
      try {
        const customerOrders = await listOrdersForCustomer(
          req.customerUser!.id,
          req.customerUser!.email
        );
        return res.json({ orders: customerOrders });
      } catch (error: any) {
        return res.status(500).json({ error: error.message || "Failed to load orders." });
      }
    }
  );

  app.post(
    "/api/customer/orders",
    requireCustomerAuth,
    async (req: CustomerAuthRequest, res): Promise<any> => {
      try {
        const customer = req.customerUser!;
        const { phone, shippingAddress, transactionId, items, fromCart } = req.body || {};

        const cleanPhone =
          typeof phone === "string" && phone.trim() ? phone.trim() : customer.phone;
        if (!cleanPhone || cleanPhone.replace(/\D/g, "").length < 7) {
          return res.status(400).json({ error: "A valid phone number is required." });
        }
        if (typeof shippingAddress !== "string" || !shippingAddress.trim()) {
          return res.status(400).json({ error: "Shipping address is required." });
        }
        if (typeof transactionId !== "string" || transactionId.trim().length < 6) {
          return res.status(400).json({
            error: "UPI Transaction ID is compulsory (minimum 6 characters).",
          });
        }

        let requestedItems = items;
        if (fromCart) {
          const cart = await getCustomerCart(customer.id);
          if (cart.items.length === 0) {
            return res.status(400).json({ error: "Your cart is currently empty." });
          }
          requestedItems = cart.items.map((ci) => ({
            id: ci.productId,
            quantity: ci.quantity,
          }));
        }

        if (!Array.isArray(requestedItems) || requestedItems.length === 0) {
          return res.status(400).json({ error: "Order items are required." });
        }

        const itemIds = Array.from(
          new Set(requestedItems.map((i: any) => String(i?.id || "")).filter(Boolean))
        );
        const dbProducts = await getProductsByIds(itemIds);
        const productMap = new Map(dbProducts.map((p) => [p.id, p]));

        const verifiedItems: Array<{
          id: string;
          name: string;
          price: number;
          quantity: number;
          imageUrl?: string;
        }> = [];
        let authoritativeTotal = 0;

        for (const rawItem of requestedItems) {
          const pid = String(rawItem?.id || "");
          const qty = Math.max(1, Math.floor(Number(rawItem?.quantity || 1)));
          const dbProduct = productMap.get(pid);
          if (!dbProduct) {
            return res.status(400).json({ error: "Selected product is no longer available." });
          }
          if (dbProduct.availability === "Out of Stock") {
            return res.status(400).json({
              error: `"${dbProduct.name}" is currently out of stock.`,
            });
          }
          verifiedItems.push({
            id: dbProduct.id,
            name: dbProduct.name,
            price: dbProduct.price,
            quantity: qty,
            imageUrl: dbProduct.imageUrl,
          });
          authoritativeTotal += dbProduct.price * qty;
        }

        const siteSettings = await getWebsiteSettings();
        const activeUpiId = siteSettings?.upiId || "9290317064@fam";
        const activeReceiver = siteSettings?.upiReceiverName || "Aura Quiet Living";
        const orderNumber = `AUR-${Math.floor(100000 + Math.random() * 900000)}`;

        const { order } = await createCustomerOrder({
          orderNumber,
          customerName: customer.name,
          customerEmail: customer.email,
          customerPhone: cleanPhone,
          shippingAddress: shippingAddress.trim(),
          items: verifiedItems,
          totalAmount: authoritativeTotal,
          upiId: activeUpiId,
          upiReceiverName: activeReceiver,
          transactionReference: transactionId.trim(),
        });

        if (fromCart) {
          await clearCustomerCart(customer.id);
        }

        const emailNotification = await dispatchOrderLifecycleEmail(
          {
            orderId: order.id,
            orderNumber: order.orderNumber,
            customerName: order.customerName,
            customerEmail: order.customerEmail,
            items: order.items,
            totalAmount: order.totalAmount,
            orderStatus: order.orderStatus,
            paymentStatus: order.paymentStatus,
            upiId: order.upiId,
            transactionReference: order.transactionReference,
            shippingAddress: order.shippingAddress,
          },
          "order_confirmation",
          getRequestBaseUrl(req)
        );

        return res.status(201).json({ order, emailNotification });
      } catch (error: any) {
        return res.status(500).json({ error: error.message || "Failed to place order." });
      }
    }
  );

  app.post(
    "/api/customer/orders/:orderNumber/cancel",
    requireCustomerAuth,
    async (req: CustomerAuthRequest, res): Promise<any> => {
      try {
        const customer = req.customerUser!;
        const order = await findOrderByNumber(req.params.orderNumber);
        if (!order) {
          return res.status(404).json({ error: "Order not found." });
        }

        const ownsOrder =
          order.customerId === customer.id ||
          order.customerEmail.toLowerCase() === customer.email.toLowerCase();
        if (!ownsOrder) {
          return res.status(403).json({
            error: "Forbidden: You can only cancel your own orders.",
          });
        }

        if (
          order.orderStatus === "Completed" ||
          order.orderStatus === "Cancelled" ||
          order.orderStatus === "Refunded"
        ) {
          return res.status(400).json({
            error: `Orders in "${order.orderStatus}" status cannot be cancelled.`,
          });
        }

        const updated = await updateOrderStatusRecord(order.id, "Cancelled");
        const emailNotification = await dispatchOrderLifecycleEmail(
          {
            orderId: order.id,
            orderNumber: order.orderNumber,
            customerName: order.customerName,
            customerEmail: order.customerEmail,
            items: order.items,
            totalAmount: order.totalAmount,
            orderStatus: "Cancelled",
            paymentStatus: updated?.paymentStatus || order.paymentStatus,
            upiId: order.upiId,
            transactionReference: order.transactionReference,
            shippingAddress: order.shippingAddress,
          },
          "order_cancellation",
          getRequestBaseUrl(req)
        );

        return res.json({ order: updated, emailNotification });
      } catch (error: any) {
        return res.status(500).json({ error: error.message || "Failed to cancel order." });
      }
    }
  );

  // =========================================================================
  // EXISTING GEMINI AI CONCIERGE PROXY ROUTES
  // =========================================================================

  app.post("/api/generate-content", async (req, res): Promise<any> => {
    try {
      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
      if (!apiKey) {
        return res.status(503).json({
          error:
            "API key is not configured. Please add your GEMINI_API_KEY in Settings > Secrets.",
        });
      }
      const ai = new GoogleGenAI({ apiKey });
      const params = { ...req.body, model: resolveModel(req.body?.model) };
      const response = await ai.models.generateContent(params);
      return res.json(serializeGenerateContentResponse(response));
    } catch (error: any) {
      console.error("[Backend] /api/generate-content error:", error);
      return res.status(500).json({ error: error.message || "Failed to generate content." });
    }
  });

  app.post("/api/generate-content-stream", async (req, res): Promise<any> => {
    try {
      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
      if (!apiKey) {
        return res.status(503).json({
          error:
            "API key is not configured. Please add your GEMINI_API_KEY in Settings > Secrets.",
        });
      }
      const ai = new GoogleGenAI({ apiKey });
      const params = { ...req.body, model: resolveModel(req.body?.model) };
      const stream = await ai.models.generateContentStream(params);
      res.setHeader("Content-Type", "application/x-ndjson");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      for await (const chunk of stream) {
        res.write(JSON.stringify(serializeGenerateContentResponse(chunk)) + "\n");
      }
      res.end();
    } catch (error: any) {
      console.error("[Backend] /api/generate-content-stream error:", error);
      if (!res.headersSent) {
        return res.status(500).json({ error: error.message || "Failed to stream content." });
      }
      res.end();
    }
  });

  app.post("/api/chat-message", async (req, res): Promise<any> => {
    try {
      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
      if (!apiKey) {
        return res.status(503).json({
          error:
            "API key is not configured. Please add your GEMINI_API_KEY in Settings > Secrets.",
        });
      }
      const { sessionId, model, config, history, message, msgConfig } = req.body || {};
      const ai = new GoogleGenAI({ apiKey });
      const chatKey = sessionId ? `${getClientKey(req)}:${String(sessionId).slice(0, 128)}` : "";
      let chat = chatKey ? chats.get(chatKey) : undefined;
      if (!chat) {
        chat = ai.chats.create({
          model: resolveModel(model),
          config,
          history,
        });
        if (chatKey) chats.set(chatKey, chat);
      }
      const response = await chat.sendMessage({ message, config: msgConfig });
      return res.json(serializeGenerateContentResponse(response));
    } catch (error: any) {
      console.error("[Backend] /api/chat-message error:", error);
      return res.status(500).json({ error: error.message || "Failed to send chat message." });
    }
  });

  app.post("/api/chat-stream", async (req, res): Promise<any> => {
    try {
      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
      if (!apiKey) {
        return res.status(503).json({
          error:
            "API key is not configured. Please add your GEMINI_API_KEY in Settings > Secrets.",
        });
      }
      const { sessionId, model, config, history, message, msgConfig } = req.body || {};
      const ai = new GoogleGenAI({ apiKey });
      const chatKey = sessionId ? `${getClientKey(req)}:${String(sessionId).slice(0, 128)}` : "";
      let chat = chatKey ? chats.get(chatKey) : undefined;
      if (!chat) {
        chat = ai.chats.create({
          model: resolveModel(model),
          config,
          history,
        });
        if (chatKey) chats.set(chatKey, chat);
      }
      const stream = await chat.sendMessageStream({ message, config: msgConfig });
      res.setHeader("Content-Type", "application/x-ndjson");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      for await (const chunk of stream) {
        res.write(JSON.stringify(serializeGenerateContentResponse(chunk)) + "\n");
      }
      res.end();
    } catch (error: any) {
      console.error("[Backend] /api/chat-stream error:", error);
      if (!res.headersSent) {
        return res.status(500).json({ error: error.message || "Failed to stream chat message." });
      }
      res.end();
    }
  });

  app.post("/api/generate-images", async (req, res): Promise<any> => {
    try {
      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
      if (!apiKey) {
        return res.status(503).json({
          error:
            "API key is not configured. Please add your GEMINI_API_KEY in Settings > Secrets.",
        });
      }
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateImages({
        ...req.body,
        model: resolveModel(req.body?.model || "imagen-3.0-generate-002"),
      });
      return res.json(response);
    } catch (error: any) {
      console.error("[Backend] /api/generate-images error:", error);
      return res.status(500).json({ error: error.message || "Failed to generate images." });
    }
  });

  app.post("/api/generate-videos", async (req, res): Promise<any> => {
    try {
      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
      if (!apiKey) {
        return res.status(503).json({
          error:
            "API key is not configured. Please add your GEMINI_API_KEY in Settings > Secrets.",
        });
      }
      const ai = new GoogleGenAI({ apiKey });
      const body = { ...req.body };
      delete body.video;
      if (body.video && typeof body.video === "object") {
        const c = { ...body.video };
        delete c.uri;
        delete c.videoUri;
        body.video = Object.keys(c).length ? c : undefined;
      }
      delete body.source;
      body.model = resolveModel(body.model || "veo-3.1-fast-generate-preview");
      const op = await ai.models.generateVideos(body);
      if (op.name) {
        videoOps.set(op.name, { op, ownerKey: getClientKey(req) });
      }
      return res.json({
        name: op.name,
        done: op.done,
        metadata: op.metadata,
        error: op.error,
        response: op.response,
      });
    } catch (error: any) {
      console.error("[Backend] /api/generate-videos error:", error);
      return res.status(500).json({ error: error.message || "Failed to start video generation." });
    }
  });

  app.post("/api/videos-operation", async (req, res): Promise<any> => {
    try {
      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
      if (!apiKey) {
        return res.status(503).json({
          error:
            "API key is not configured. Please add your GEMINI_API_KEY in Settings > Secrets.",
        });
      }
      const ai = new GoogleGenAI({ apiKey });
      const opName = req.body?.operation?.name;
      const storedOp = opName ? videoOps.get(opName) : undefined;
      if (!storedOp || storedOp.ownerKey !== getClientKey(req)) {
        return res.status(404).json({ error: "Video operation not found on server." });
      }
      const op = await ai.operations.getVideosOperation({ operation: storedOp.op });
      if (op.name) {
        videoOps.set(op.name, { op, ownerKey: getClientKey(req) });
      }
      const responseCopy = op.response ? JSON.parse(JSON.stringify(op.response)) : undefined;
      if (op.done && responseCopy?.generatedVideos) {
        for (const gv of responseCopy.generatedVideos) {
          if (gv.video?.uri) {
            gv.video.uri = `/api/video-download?uri=${encodeURIComponent(gv.video.uri)}`;
          }
        }
      }
      return res.json({
        name: op.name,
        done: op.done,
        metadata: op.metadata,
        error: op.error,
        response: responseCopy,
      });
    } catch (error: any) {
      console.error("[Backend] /api/videos-operation error:", error);
      return res.status(500).json({ error: error.message || "Failed to poll video operation." });
    }
  });

  app.get("/api/video-download", (_req, res) => {
    res.status(404).json({ error: "Video download is not enabled for this applet." });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(["/server.cjs", "/server.cjs.map"], (_req: any, res: any) => res.status(404).end());
    app.use(express.static(distPath));
    app.use((_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Backend] Server running on http://localhost:${PORT}`);
  });
}

startServer();
