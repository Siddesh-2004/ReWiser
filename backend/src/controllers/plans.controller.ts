// src/controllers/plans.controller.ts
import type { Request, Response } from 'express';
import { getDuePlans, getPlans, selectItem, unselectItem } from '../services/plan.service';
import { prepareQuiz } from '../services/quiz.service';
import asyncHandler from '../utils/asynchandler';
import { ApiError } from '../utils/apiErrors';
import ApiResponse from '../utils/apiResponse';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getItemId(req: Request): string {
  const itemId = String(req.params.itemId);
  // Postgres throws on a malformed uuid, which would come back as a 500
  if (!UUID.test(itemId)) throw new ApiError(400, 'Invalid item id');
  return itemId;
}

// GET /plans/due: the pages the student should revise now
export const due = asyncHandler(async (req: Request, res: Response) => {
  const plans = await getDuePlans(req.userId!);
  res.status(200).json(new ApiResponse({ plans }, 'Due plans loaded', 200));
});

// GET /plans: all active plans and their current quiz readiness
export const list = asyncHandler(async (req: Request, res: Response) => {
  const plans = await getPlans(req.userId!);
  res.status(200).json(new ApiResponse({ plans }, 'Plans loaded', 200));
});

// PUT /plans/:itemId: tick a page for revision
export const select = asyncHandler(async (req: Request, res: Response) => {
  const result = await selectItem(req.userId!, getItemId(req));
  try {
    await prepareQuiz(req.userId!, result.itemId);
    res.status(200).json(new ApiResponse({ ...result, quizReady: true }, 'Item selected and quiz prepared', 200));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Question preparation failed';
    res.status(200).json(new ApiResponse({ ...result, quizReady: false, preparationError: message }, 'Item selected; quiz preparation failed', 200));
  }
});

// DELETE /plans/:itemId: untick it
export const unselect = asyncHandler(async (req: Request, res: Response) => {
  const result = await unselectItem(req.userId!, getItemId(req));
  res.status(200).json(new ApiResponse(result, 'Item unselected', 200));
});