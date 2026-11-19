/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Request, Response, NextFunction } from 'express';
import { findValidCustomerSession } from '../db/repository.ts';
import { hashToken } from '../server/cryptoUtils.ts';

export interface CustomerUserContext {
  id: number;
  name: string;
  email: string;
  phone: string;
  address: string;
  profilePictureUrl: string | null;
  ordersCount: number;
  totalSpent: number;
  createdAt: Date;
}

export interface CustomerAuthRequest extends Request {
  customerUser?: CustomerUserContext;
  customerTokenHash?: string;
}

export const requireCustomerAuth = async (
  req: CustomerAuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Customer sign-in required.' });
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Missing customer session token.' });
  }

  try {
    const tokenHash = hashToken(token);
    const customer = await findValidCustomerSession(tokenHash);
    if (!customer || !customer.isRegistered) {
      return res.status(401).json({ error: 'Unauthorized: Invalid or expired customer session.' });
    }

    req.customerUser = {
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
    req.customerTokenHash = tokenHash;
    return next();
  } catch (error) {
    console.error('[CustomerAuth] Verification failed:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid customer session.' });
  }
};
