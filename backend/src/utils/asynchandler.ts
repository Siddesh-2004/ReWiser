// src/utils/asynchandler.ts
import type { NextFunction, Request, RequestHandler, Response } from 'express';

type AsyncController = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

// Passes any error on to the central error handler in app.ts
const asyncHandler =
  (fn: AsyncController): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };

export default asyncHandler;