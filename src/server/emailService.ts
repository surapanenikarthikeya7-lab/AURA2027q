/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import nodemailer from 'nodemailer';
import {
  getEmailSettingsRow,
  getWebsiteSettings,
  insertOrderNotification,
} from '../db/repository.ts';
import { decryptSecret } from './cryptoUtils.ts';
import type { OrderLineItem } from '../db/schema.ts';

export type OrderEmailEvent =
  | 'order_confirmation'
  | 'payment_confirmation'
  | 'order_cancellation'
  | 'order_status_update'
  | 'refund_notification';

interface OrderEmailPayload {
  orderId: number;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  items: OrderLineItem[];
  totalAmount: number;
  orderStatus: string;
  paymentStatus: string;
  upiId: string;
  transactionReference: string;
  shippingAddress: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getEventCopy(eventType: OrderEmailEvent, orderStatus: string) {
  switch (eventType) {
    case 'order_confirmation':
      return {
        heading: 'Order Confirmation',
        lead: 'Thank you for your order. Your booking and UPI payment reference have been received and are queued for verification.',
      };
    case 'payment_confirmation':
      return {
        heading: 'Payment Confirmed',
        lead: 'Your UPI payment has been verified and your order is now confirmed.',
      };
    case 'order_cancellation':
      return {
        heading: 'Order Cancelled',
        lead: 'Your order has been cancelled. If a payment was already settled, please review your refund updates below.',
      };
    case 'refund_notification':
      return {
        heading: `Refund Update — ${orderStatus}`,
        lead:
          orderStatus === 'Refunded'
            ? 'Your refund has been processed and completed.'
            : 'Your refund request has been initiated and is currently being processed.',
      };
    case 'order_status_update':
    default:
      return {
        heading: `Order Status Update — ${orderStatus}`,
        lead: `Your order status has been updated to ${orderStatus}.`,
      };
  }
}

async function sendRawEmail(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ status: 'sent' | 'logged' | 'failed'; errorMessage?: string }> {
  const emailCfg = await getEmailSettingsRow();

  const senderName = emailCfg?.senderName || 'Aura Quiet Living';
  const senderEmail =
    emailCfg?.senderEmail ||
    process.env.SMTP_FROM ||
    process.env.SMTP_USER ||
    'no-reply@aura.local';
  const fromHeader = `${senderName} <${senderEmail}>`;

  if (emailCfg?.provider === 'resend') {
    const resendKey =
      decryptSecret(emailCfg.resendApiKeyEnc) || process.env.RESEND_API_KEY || '';
    if (resendKey) {
      try {
        const resp = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: fromHeader,
            to: [params.to],
            subject: params.subject,
            html: params.html,
            text: params.text,
          }),
        });
        if (!resp.ok) {
          const errText = await resp.text();
          return {
            status: 'failed',
            errorMessage: `Resend API error (${resp.status}): ${errText.slice(0, 200)}`,
          };
        }
        return { status: 'sent' };
      } catch (err: any) {
        return {
          status: 'failed',
          errorMessage: err?.message || 'Resend delivery failed',
        };
      }
    }
  }

  const smtpHost = emailCfg?.smtpHost || process.env.SMTP_HOST || '';
  const smtpPort = emailCfg?.smtpPort || Number(process.env.SMTP_PORT || 587);
  const smtpUser = emailCfg?.smtpUser || process.env.SMTP_USER || '';
  const smtpPass =
    decryptSecret(emailCfg?.smtpPassEnc) || process.env.SMTP_PASS || '';
  const smtpSecure =
    emailCfg?.smtpHost ? Boolean(emailCfg.smtpSecure) : smtpPort === 465;

  if (smtpHost && smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });
      await transporter.sendMail({
        from: fromHeader,
        to: params.to,
        subject: params.subject,
        html: params.html,
        text: params.text,
      });
      return { status: 'sent' };
    } catch (err: any) {
      console.error('[EmailService] SMTP error:', err);
      return {
        status: 'failed',
        errorMessage: err?.message || 'SMTP delivery failed',
      };
    }
  }

  return { status: 'logged' };
}

export async function dispatchOrderLifecycleEmail(
  order: OrderEmailPayload,
  eventType: OrderEmailEvent,
  baseUrl?: string
) {
  const site = await getWebsiteSettings();
  const siteName = site?.websiteName || 'Aura';
  const copy = getEventCopy(eventType, order.orderStatus);
  const subject = `${siteName} — ${copy.heading} (#${order.orderNumber})`;

  const resolvedLogoUrl =
    site?.logoUrl && site.logoUrl.startsWith('/') && baseUrl
      ? `${baseUrl}${site.logoUrl}`
      : site?.logoUrl || null;

  const productNames = order.items
    .map((i) => `${i.name} (x${i.quantity})`)
    .join(', ');

  const textBody = [
    `Hello ${order.customerName},`,
    '',
    copy.lead,
    '',
    `Order ID: #${order.orderNumber}`,
    `Products: ${productNames}`,
    `Amount: ₹${order.totalAmount}`,
    `Order Status: ${order.orderStatus}`,
    `Payment Status: ${order.paymentStatus}`,
    `UPI ID: ${order.upiId}`,
    `Transaction Reference: ${order.transactionReference}`,
    `Shipping Address: ${order.shippingAddress}`,
    '',
    'Contact Information:',
    `${siteName} · ${site?.contactEmail || ''} · ${site?.contactPhone || ''} · ${site?.contactAddress || ''}`,
  ].join('\n');

  const itemsHtml = order.items
    .map(
      (item) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #e5e5e5;font-size:14px;color:#171717;">
          ${escapeHtml(item.name)} <span style="color:#737373;">&times; ${item.quantity}</span>
        </td>
        <td style="padding:10px 0;border-bottom:1px solid #e5e5e5;font-size:14px;color:#171717;text-align:right;font-variant-numeric:tabular-nums;">
          &#8377;${item.price * item.quantity}
        </td>
      </tr>`
    )
    .join('');

  const htmlBody = `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:32px 16px;background-color:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#171717;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e5e5e5;">
      <tr>
        <td style="padding:28px 32px;border-bottom:1px solid #e5e5e5;background:#0a0a0a;color:#ffffff;">
          ${
            resolvedLogoUrl
              ? `<img src="${escapeHtml(resolvedLogoUrl)}" alt="${escapeHtml(siteName)}" style="max-height:36px;max-width:180px;display:block;margin-bottom:10px;" />`
              : ''
          }
          <div style="font-size:20px;font-weight:600;letter-spacing:0.04em;">${escapeHtml(siteName)}</div>
        </td>
      </tr>
      <tr>
        <td style="padding:32px;">
          <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#737373;">${escapeHtml(copy.heading)}</p>
          <h1 style="margin:0 0 16px;font-size:22px;font-weight:600;color:#0a0a0a;">Hello ${escapeHtml(order.customerName)},</h1>
          <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#404040;">${escapeHtml(copy.lead)}</p>

          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:24px;background:#fafafa;border:1px solid #e5e5e5;padding:16px;">
            <tr>
              <td style="padding:6px 12px;font-size:12px;color:#737373;">Order ID</td>
              <td style="padding:6px 12px;font-size:13px;font-weight:600;color:#0a0a0a;text-align:right;">#${escapeHtml(order.orderNumber)}</td>
            </tr>
            <tr>
              <td style="padding:6px 12px;font-size:12px;color:#737373;">Order Status</td>
              <td style="padding:6px 12px;font-size:13px;font-weight:600;color:#0a0a0a;text-align:right;">${escapeHtml(order.orderStatus)}</td>
            </tr>
            <tr>
              <td style="padding:6px 12px;font-size:12px;color:#737373;">Payment Status</td>
              <td style="padding:6px 12px;font-size:13px;color:#0a0a0a;text-align:right;">${escapeHtml(order.paymentStatus)}</td>
            </tr>
            <tr>
              <td style="padding:6px 12px;font-size:12px;color:#737373;">Transaction Ref</td>
              <td style="padding:6px 12px;font-size:13px;color:#0a0a0a;text-align:right;">${escapeHtml(order.transactionReference)}</td>
            </tr>
          </table>

          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:20px;">
            ${itemsHtml}
            <tr>
              <td style="padding:14px 0 0;font-size:15px;font-weight:600;color:#0a0a0a;">Total Amount</td>
              <td style="padding:14px 0 0;font-size:16px;font-weight:600;color:#0a0a0a;text-align:right;font-variant-numeric:tabular-nums;">&#8377;${order.totalAmount}</td>
            </tr>
          </table>

          <div style="padding-top:20px;border-top:1px solid #e5e5e5;font-size:12px;line-height:1.6;color:#737373;">
            <div><strong style="color:#171717;">${escapeHtml(siteName)}</strong></div>
            <div>${escapeHtml(site?.contactEmail || '')} &middot; ${escapeHtml(site?.contactPhone || '')}</div>
            <div>${escapeHtml(site?.contactAddress || '')}</div>
          </div>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const result = await sendRawEmail({
    to: order.customerEmail,
    subject,
    html: htmlBody,
    text: textBody,
  });

  await insertOrderNotification({
    orderId: order.orderId,
    orderNumber: order.orderNumber,
    eventType,
    recipientEmail: order.customerEmail,
    subject,
    htmlBody,
    textBody,
    deliveryStatus: result.status,
    errorMessage: result.errorMessage,
  });

  return {
    status: result.status === 'sent' ? ('sent' as const) : ('preview' as const),
    deliveryStatus: result.status,
    to: order.customerEmail,
    subject,
    body: textBody,
    errorMessage: result.errorMessage,
  };
}

export async function dispatchTestEmail(recipientEmail: string, baseUrl?: string) {
  const site = await getWebsiteSettings();
  const siteName = site?.websiteName || 'Aura';
  const subject = `${siteName} — Mail Sender Test Verification`;
  const resolvedLogoUrl =
    site?.logoUrl && site.logoUrl.startsWith('/') && baseUrl
      ? `${baseUrl}${site.logoUrl}`
      : site?.logoUrl || null;

  const textBody = [
    `Hello,`,
    '',
    `This is a test email from the ${siteName} Admin Portal Mail Sender configuration.`,
    `If you received this message, your backend email service is configured and working properly.`,
    '',
    `${siteName} · ${site?.contactEmail || ''} · ${site?.contactPhone || ''}`,
  ].join('\n');

  const htmlBody = `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:32px 16px;background-color:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#171717;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e5e5;">
      <tr>
        <td style="padding:24px 28px;background:#0a0a0a;color:#ffffff;">
          ${
            resolvedLogoUrl
              ? `<img src="${escapeHtml(resolvedLogoUrl)}" alt="${escapeHtml(siteName)}" style="max-height:32px;display:block;margin-bottom:8px;" />`
              : ''
          }
          <div style="font-size:18px;font-weight:600;">${escapeHtml(siteName)}</div>
        </td>
      </tr>
      <tr>
        <td style="padding:28px;">
          <h1 style="margin:0 0 12px;font-size:20px;font-weight:600;">Mail Sender Test Passed</h1>
          <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#404040;">
            This test confirms your transactional email configuration is active for order confirmations, payment confirmations, cancellations, status updates, and refunds.
          </p>
          <p style="margin:0;font-size:12px;color:#737373;">
            ${escapeHtml(site?.contactEmail || '')} &middot; ${escapeHtml(site?.contactPhone || '')}
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const result = await sendRawEmail({
    to: recipientEmail,
    subject,
    html: htmlBody,
    text: textBody,
  });

  await insertOrderNotification({
    orderId: null,
    orderNumber: 'TEST-MAIL',
    eventType: 'test_email',
    recipientEmail,
    subject,
    htmlBody,
    textBody,
    deliveryStatus: result.status,
    errorMessage: result.errorMessage,
  });

  return {
    deliveryStatus: result.status,
    errorMessage: result.errorMessage,
    subject,
    recipientEmail,
  };
}

export async function dispatchAdminResetEmail(
  recipientEmail: string,
  adminName: string,
  resetCode: string
) {
  const site = await getWebsiteSettings();
  const siteName = site?.websiteName || 'Aura';
  const subject = `${siteName} Admin — Password Reset Verification Code`;
  const textBody = [
    `Hello ${adminName},`,
    '',
    `Use the following verification code to reset your ${siteName} Admin Portal password:`,
    `${resetCode}`,
    '',
    `This code expires in 15 minutes.`,
  ].join('\n');

  const htmlBody = `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;border:1px solid #e5e5e5;">
    <h2 style="margin:0 0 12px;">${escapeHtml(siteName)} Admin Password Reset</h2>
    <p style="font-size:14px;color:#404040;">Hello ${escapeHtml(adminName)}, use this verification code within 15 minutes:</p>
    <div style="margin:20px 0;padding:16px;background:#0a0a0a;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:6px;text-align:center;">${escapeHtml(resetCode)}</div>
  </div>`;

  return sendRawEmail({
    to: recipientEmail,
    subject,
    html: htmlBody,
    text: textBody,
  });
}

export async function dispatchCustomerVerificationEmail(
  recipientEmail: string,
  customerName: string,
  code: string,
  purpose: 'password_reset' | 'email_change'
) {
  const site = await getWebsiteSettings();
  const siteName = site?.websiteName || 'Aura';
  const heading =
    purpose === 'email_change'
      ? 'Verify Your New Email Address'
      : 'Customer Password Reset';
  const lead =
    purpose === 'email_change'
      ? `Use this verification code to confirm updating your ${siteName} account email address:`
      : `Use this verification code to reset your ${siteName} customer account password:`;
  const subject = `${siteName} — ${heading}`;

  const textBody = [
    `Hello ${customerName},`,
    '',
    lead,
    `${code}`,
    '',
    `This code expires in 15 minutes.`,
  ].join('\n');

  const htmlBody = `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;border:1px solid #e5e5e5;">
    <h2 style="margin:0 0 12px;">${escapeHtml(siteName)} — ${escapeHtml(heading)}</h2>
    <p style="font-size:14px;color:#404040;">Hello ${escapeHtml(customerName)}, ${escapeHtml(lead)}</p>
    <div style="margin:20px 0;padding:16px;background:#0a0a0a;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:6px;text-align:center;">${escapeHtml(code)}</div>
    <p style="font-size:12px;color:#737373;">This verification code expires in 15 minutes.</p>
  </div>`;

  return sendRawEmail({
    to: recipientEmail,
    subject,
    html: htmlBody,
    text: textBody,
  });
}
