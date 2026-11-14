// src/routes/plans.routes.ts
import { Router } from 'express';
import { due, list, select, unselect } from '../controllers/plans.controller';

export const plansRouter = Router();

plansRouter.get('/due', due);
plansRouter.get('/', list);
plansRouter.put('/:itemId', select);
plansRouter.delete('/:itemId', unselect);