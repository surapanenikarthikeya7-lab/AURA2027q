/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import {
  findAdminByEmail,
  findAdminByUid,
  findValidAdminSession,
} from '../db/repository.ts';
import { hashToken } from '../server/cryptoUtils.ts';

export interface AdminUserContext {
  id: number;
  uid: string;
  name: string;
  email: string;
  role: string;
}

export interface AdminAuthRequest extends Request {
  adminUser?: AdminUserContext;
  sessionTokenHash?: string;
}

export const requireAdminAuth = async (
  req: AdminAuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing admin token.' });
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Empty admin token.' });
  }

  try {
    const tokenHash = hashToken(token);
    const sessionAdmin = await findValidAdminSession(tokenHash);
    if (sessionAdmin && sessionAdmin.role === 'admin' && sessionAdmin.isActive) {
      req.adminUser = {
        id: sessionAdmin.id,
        uid: sessionAdmin.uid,
        name: sessionAdmin.name,
        email: sessionAdmin.email,
        role: sessionAdmin.role,
      };
      req.sessionTokenHash = tokenHash;
      return next();
    }

    const decoded = await adminAuth.verifyIdToken(token);
    const email = decoded.email?.toLowerCase();
    const adminByUid = await findAdminByUid(decoded.uid);
    const adminRecord =
      adminByUid || (email ? await findAdminByEmail(email) : null);

    if (!adminRecord || !adminRecord.isActive || adminRecord.role !== 'admin') {
      return res.status(403).json({
        error: 'Forbidden: Only authorized administrators can access this resource.',
      });
    }

    req.adminUser = {
      id: adminRecord.id,
      uid: adminRecord.uid,
      name: adminRecord.name,
      email: adminRecord.email,
      role: adminRecord.role,
    };
    return next();
  } catch (error) {
    console.error('[Auth] Admin verification failed:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired session.' });
  }
};
