// src/routes/auth.routes.ts
import { Router } from 'express';
import { login, notionCallback } from '../controllers/auth.controller';

export const authRouter = Router();

authRouter.get('/notion', login);
authRouter.get('/notion/callback', notionCallback);