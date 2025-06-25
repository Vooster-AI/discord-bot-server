import { Response } from 'express';
import { UserService } from '../../core/services/UserService.js';
import { CustomRequest, ApiResponse, CreateUserRequest, UserResponse } from '../../shared/types/api.js';

export class UserController {
    static async createUserScore(req: CustomRequest, res: Response): Promise<void> {
        try {
            const userData: CreateUserRequest = req.body;
            const user = await UserService.createOrUpdateUserScore(userData);
            
            console.log(`📊 Score added for user: ${userData.name} (Discord ID: ${userData.discord_id}, Score: ${userData.score})`);
            
            const response: ApiResponse<{ user: UserResponse }> = {
                success: true,
                data: { user }
            };
            
            res.json(response);
        } catch (error) {
            console.error('Error in user score endpoint:', error);
            const response: ApiResponse = {
                success: false,
                error: (error as Error).message
            };
            res.status(500).json(response);
        }
    }

    static async getUsers(req: CustomRequest, res: Response): Promise<void> {
        try {
            const limit = parseInt(req.query.limit as string) || 50;
            const users = await UserService.getUsers(limit);
            
            const response: ApiResponse<{ users: UserResponse[] }> = {
                success: true,
                data: { users }
            };
            
            res.json(response);
        } catch (error) {
            console.error('Error in get users endpoint:', error);
            const response: ApiResponse = {
                success: false,
                error: (error as Error).message
            };
            res.status(500).json(response);
        }
    }

    static async getUserByDiscordId(req: CustomRequest, res: Response): Promise<void> {
        try {
            const { discordId } = req.params;
            const user = await UserService.getUserByDiscordId(discordId);
            
            if (!user) {
                const response: ApiResponse = {
                    success: false,
                    error: 'User not found'
                };
                res.status(404).json(response);
                return;
            }
            
            const response: ApiResponse<{ user: UserResponse }> = {
                success: true,
                data: { user }
            };
            
            res.json(response);
        } catch (error) {
            console.error('Error in get user endpoint:', error);
            const response: ApiResponse = {
                success: false,
                error: (error as Error).message
            };
            res.status(500).json(response);
        }
    }

    static async syncUsers(req: CustomRequest, res: Response): Promise<void> {
        try {
            await UserService.triggerUserSync();
            
            const response: ApiResponse<{ message: string }> = {
                success: true,
                data: { message: 'User sync triggered' }
            };
            
            res.json(response);
        } catch (error) {
            console.error('Error in user sync endpoint:', error);
            const response: ApiResponse = {
                success: false,
                error: (error as Error).message
            };
            res.status(500).json(response);
        }
    }
}