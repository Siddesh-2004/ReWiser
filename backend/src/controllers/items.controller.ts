// src/controllers/items.controller.ts
import type { Request, Response } from 'express';
import { syncItems } from '../services/sync.service';
import { getTree } from '../services/tree.service';
import asyncHandler from '../utils/asynchandler';
import ApiResponse from '../utils/apiResponse';
import { getNoteContent } from '../services/content.service';

// POST /items/sync: pull the student's workspace from Notion into our table
export const sync = asyncHandler(async (req: Request, res: Response) => {
  const result = await syncItems(req.userId!);
  res.status(200).json(new ApiResponse(result, 'Sync complete', 200));
});

// GET /items/tree: the folder structure, read from our own table
export const tree = asyncHandler(async (req: Request, res: Response) => {
  const result = await getTree(req.userId!);
  res.status(200).json(new ApiResponse(result, 'Items loaded', 200));
});


// GET /items/:id/content: a page's text from Notion (also used to test extraction)
export const content = asyncHandler(async (req: Request, res: Response) => {
  const result = await getNoteContent(req.userId!, req.params.id as string);
  res.status(200).json(new ApiResponse(result, 'Content loaded', 200));
});