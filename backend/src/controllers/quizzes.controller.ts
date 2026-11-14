// src/controllers/quizzes.controller.ts
import type { Request, Response } from 'express';
import { completeQuiz, getQuiz, startQuiz, submitAnswer } from '../services/quiz.service';
import asyncHandler from '../utils/asynchandler';
import { ApiError } from '../utils/apiErrors';
import ApiResponse from '../utils/apiResponse';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function uuid(value: unknown, label: string): string {
  const id = String(value);
  if (!UUID.test(id)) throw new ApiError(400, `Invalid ${label}`);
  return id;
}

// POST /quizzes: start (or resume) the quiz for a due page
export const start = asyncHandler(async (req: Request, res: Response) => {
  const quiz = await startQuiz(req.userId!, uuid(req.body?.itemId, 'item id'));
  res.status(200).json(new ApiResponse(quiz, 'Quiz ready', 200));
});

// GET /quizzes/:id
export const show = asyncHandler(async (req: Request, res: Response) => {
  const quiz = await getQuiz(req.userId!, uuid(req.params.id, 'quiz id'));
  res.status(200).json(new ApiResponse(quiz, 'Quiz loaded', 200));
});

// POST /quizzes/questions/:questionId/answer: JSON { answer } or multipart `audio`
export const answer = asyncHandler(async (req: Request, res: Response) => {
  const questionId = uuid(req.params.questionId, 'question id');

  let result;
  if (req.file) {
    result = await submitAnswer(req.userId!, questionId, {
      audio: { buffer: req.file.buffer, mimeType: req.file.mimetype },
    });
  } else {
    const text = typeof req.body?.answer === 'string' ? req.body.answer.trim() : '';
    if (!text) throw new ApiError(400, 'Send an audio file or a text answer');
    result = await submitAnswer(req.userId!, questionId, { text });
  }
  res.status(200).json(new ApiResponse(result, 'Answer saved', 200));
});

// POST /quizzes/:id/complete
export const complete = asyncHandler(async (req: Request, res: Response) => {
  const result = await completeQuiz(req.userId!, uuid(req.params.id, 'quiz id'));
  res.status(200).json(new ApiResponse(result, 'Quiz completed', 200));
});