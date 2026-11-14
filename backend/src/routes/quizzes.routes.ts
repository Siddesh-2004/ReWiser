// src/routes/quizzes.routes.ts
import { Router } from 'express';
import multer from 'multer';
import { answer, complete, show, start } from '../controllers/quizzes.controller';

// Audio stays in memory (a few MB at most) and is forwarded straight to the AI server
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

export const quizzesRouter = Router();

quizzesRouter.post('/', start);
quizzesRouter.get('/:id', show);
quizzesRouter.post('/questions/:questionId/answer', upload.single('audio'), answer);
quizzesRouter.post('/:id/complete', complete);