// src/controllers/auth.controller.ts
import type { Request, Response } from 'express';
import { getAuthorizeUrl, handleCallback } from '../services/auth.service';
import asyncHandler from '../utils/asynchandler';
import { ApiError } from '../utils/apiErrors';
import ApiResponse from '../utils/apiResponse';

// GET /auth/notion: send the student to Notion's approval screen
export const login = asyncHandler(async (_req: Request, res: Response) => {
  const url = await getAuthorizeUrl();
  res.redirect(url);
});

// GET /auth/notion/callback: Notion sends the student back here
export const notionCallback = asyncHandler(async (req: Request, res: Response) => {
  const { code, state, error } = req.query;

  // Sent by Notion if the student cancels or denies access
  if (typeof error === 'string') {
    throw new ApiError(400, 'Notion authorization was not completed');
  }

  if (typeof code !== 'string' || typeof state !== 'string') {
    throw new ApiError(400, 'Missing code or state');
  }

  const result = await handleCallback(code, state);

  // Temporary: shows the result in the browser so we can test.
  // Later this becomes a redirect back into the app with the session token.
  res.status(200).json(new ApiResponse(result, 'Logged in', 200));
});