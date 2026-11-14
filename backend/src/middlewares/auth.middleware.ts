// src/middlewares/auth.middleware.ts
import type { NextFunction, Request, Response } from 'express';
import { verifySessionToken } from '../services/auth.service';
import asyncHandler from '../utils/asynchandler';
import { ApiError } from '../utils/apiErrors';

export const requireAuth = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    const header = req.headers.authorization;

    if (!header || !header.startsWith('Bearer ')) {
      throw new ApiError(401, 'Missing session token');
    }

    const token = header.slice('Bearer '.length).trim();

    try {
      req.userId = await verifySessionToken(token);
    } catch {
      // jose throws on a bad signature, wrong purpose or expiry
      throw new ApiError(401, 'Invalid or expired session token');
    }

    next();
  },
);