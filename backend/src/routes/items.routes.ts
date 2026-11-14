// src/routes/items.routes.ts
import { Router } from 'express';
import { content, sync, tree } from '../controllers/items.controller';

export const itemsRouter = Router();

itemsRouter.post('/sync', sync);
itemsRouter.get('/tree', tree);

itemsRouter.get('/:id/content', content);