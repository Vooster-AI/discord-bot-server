import { Response, NextFunction } from 'express';
import { CustomRequest, ApiResponse } from '../../shared/types/api.js';

// Helper function to ensure Discord IDs are strings
export const ensureDiscordIdString = (id: any): string => {
    return id?.toString() || '';
};

// Middleware to validate required fields
export const validateRequiredFields = (fields: string[]) => {
    return (req: CustomRequest, res: Response, next: NextFunction): void => {
        const missing = fields.filter(field => {
            const value = req.body[field];
            return value === undefined || value === null || value === '';
        });

        if (missing.length > 0) {
            const response: ApiResponse = {
                success: false,
                error: `Missing required fields: ${missing.join(', ')}`
            };
            res.status(400).json(response);
            return;
        }

        next();
    };
};

// Middleware to validate Discord URL format
export const validateDiscordUrl = (req: CustomRequest, res: Response, next: NextFunction): void => {
    const { url } = req.body;
    const urlPattern = /https:\/\/discord\.com\/channels\/(\d+)\/(\d+)\/(\d+)/;
    
    if (!url || !urlPattern.test(url)) {
        const response: ApiResponse = {
            success: false,
            error: 'Invalid Discord URL format. Expected: https://discord.com/channels/{guild}/{channel}/{message}'
        };
        res.status(400).json(response);
        return;
    }
    
    next();
};

// Middleware to validate complexity range
export const validateComplexity = (req: CustomRequest, res: Response, next: NextFunction): void => {
    const complexity = parseInt(req.body.complexity);
    
    if (isNaN(complexity) || complexity < 1 || complexity > 10) {
        const response: ApiResponse = {
            success: false,
            error: 'Complexity must be a number between 1 and 10'
        };
        res.status(400).json(response);
        return;
    }
    
    req.body.complexityNum = complexity;
    next();
};

// Middleware to validate date format
export const validateDate = (fieldName: string) => {
    return (req: CustomRequest, res: Response, next: NextFunction): void => {
        const dateValue = req.body[fieldName];
        const date = new Date(dateValue);
        
        if (!dateValue || isNaN(date.getTime())) {
            const response: ApiResponse = {
                success: false,
                error: `Invalid ${fieldName} format. Expected ISO date string`
            };
            res.status(400).json(response);
            return;
        }
        
        req.body[`${fieldName}Parsed`] = date;
        next();
    };
};