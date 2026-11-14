// src/app.ts
import express from 'express';
import cors from 'cors';
import type { NextFunction, Request, Response } from 'express';
import { authRouter } from './routes/auth.routes';
import { itemsRouter } from './routes/items.routes';
import { quizzesRouter } from './routes/quizzes.routes';
import { requireAuth } from './middlewares/auth.middleware';
import { ApiError } from './utils/apiErrors';

const app = express();

const localDevOrigins = [
  'http://localhost:8081',
  'http://localhost:8082',
  'http://127.0.0.1:8081',
  'http://127.0.0.1:8082',
];
const allowedOrigins = new Set(
  (process.env.CORS_ORIGINS?.split(',') ?? (process.env.NODE_ENV === 'production' ? [] : localDevOrigins))
    .map((origin) => origin.trim())
    .filter(Boolean),
);

app.use(
  cors({
    origin: (origin, callback) => callback(null, !origin || allowedOrigins.has(origin)),
  }),
);
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/auth', authRouter); // public: login and callback

app.use(requireAuth); // everything registered below this line needs a session token

app.use('/items', itemsRouter);



import { plansRouter } from './routes/plans.routes';

app.use('/plans', plansRouter);



app.use('/quizzes', quizzesRouter);
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