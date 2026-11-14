// src/controllers/auth.controller.ts
import type { Request, Response } from 'express';
import { getAuthorizeUrl, handleCallback, readStateRedirect } from '../services/auth.service';
import asyncHandler from '../utils/asynchandler';
import { ApiError } from '../utils/apiErrors';
import { requireEnv } from '../lib/env';
import { isAllowedAppRedirect, withParams } from '../lib/redirect';

// GET /auth/notion?redirect=<app return url>: send the student to Notion's approval screen
export const login = asyncHandler(async (req: Request, res: Response) => {
  console.info('[auth] login started');
  const redirect =
    typeof req.query.redirect === 'string'
      ? req.query.redirect
      : `${requireEnv('APP_SCHEME')}://login`;

  if (!isAllowedAppRedirect(redirect)) {
    throw new ApiError(400, 'Redirect address is not allowed');
  }

  const authorizeUrl = await getAuthorizeUrl(redirect);
  console.info('[auth] redirecting to Notion authorization');
  res.redirect(authorizeUrl);
});

// GET /auth/notion/callback: Notion sends the student back here.
// This runs in the student's browser, so outcomes end in a redirect to the app.
export const notionCallback = asyncHandler(async (req: Request, res: Response) => {
  console.info('[auth] Notion callback received');
  const { code, state, error } = req.query;

  // The return address lives inside the signed state
  const target = typeof state === 'string' ? await readStateRedirect(state) : null;

  // Without a valid state we don't know where to send the student
  if (!target || !isAllowedAppRedirect(target)) {
    console.warn('[auth] callback rejected: state invalid or redirect disallowed');
    return res
      .status(400)
      .send('This login link is invalid or has expired. Go back to the app and try again.');
  }
  console.info('[auth] callback state validated');

  // Notion sends `error` if the student cancels or denies access
  if (typeof error === 'string') {
    console.warn('[auth] Notion authorization was denied');
    return res.redirect(withParams(target, { error: 'access_denied' }));
  }

  if (typeof code !== 'string' || typeof state !== 'string') {
    console.warn('[auth] callback rejected: authorization code missing');
    return res.redirect(withParams(target, { error: 'invalid_request' }));
  }

  try {
    console.info('[auth] processing authorization callback');
    const { sessionToken } = await handleCallback(code, state);
    console.info('[auth] callback completed; returning to app');
    res.redirect(withParams(target, { token: sessionToken }));
  } catch (err) {
    // The real reason stays in our logs; the app only gets a generic code
    console.error('[auth] login failed:', err instanceof Error ? err.message : 'Unknown error');
    res.redirect(withParams(target, { error: 'login_failed' }));
  }
});