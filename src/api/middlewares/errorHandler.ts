import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../../shared/types/api.js';

export const errorHandler = (
    err: any, 
    req: Request, 
    res: Response, 
    next: NextFunction
): void => {
    console.error('Unhandled error:', err);
    
    const response: ApiResponse = {
        success: false,
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    };
    
    res.status(500).json(response);
};

export const notFoundHandler = (req: Request, res: Response): void => {
    const response: ApiResponse = {
        success: false,
        error: 'Not found',
        message: `Route ${req.method} ${req.path} not found`
    };
    
    res.status(404).json(response);
};