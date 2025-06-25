import { Request, Response, NextFunction } from 'express';
import { AsyncHandler, CustomRequest } from '../../shared/types/api.js';

// Wrapper for async route handlers to catch errors
export const asyncHandler = (fn: AsyncHandler) => {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req as CustomRequest, res, next)).catch(next);
    };
};