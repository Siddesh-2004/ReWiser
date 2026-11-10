// src/app.ts
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { authRouter } from './routes/auth.routes';
import { ApiError } from './utils/apiErrors';
import { requireAuth } from './middlewares/auth.middleware';

const app = express();

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/auth', authRouter);

app.use(requireAuth);

// Error handler: ApiError carries its own status and message; anything else is a generic 500
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ApiError) {
    if (err.statusCode >= 500) console.error(err);
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      errors: err.errors,
    });
  }

  console.error(err);
  res.status(500).json({ success: false, message: 'Something went wrong' });
});

export default app;