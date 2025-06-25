import { Response } from 'express';
import { TodoService } from '../../services/database/todoService.js';
import { CustomRequest, ApiResponse, CreateTodoRequest, TodoResponse } from '../../shared/types/api.js';

export class TodoController {
    static async createTodo(req: CustomRequest, res: Response): Promise<void> {
        try {
            const todoData: CreateTodoRequest & { complexityNum: number; due_dateParsed: Date } = req.body;
            const task = await TodoService.createTodo(todoData);
            
            console.log(`✅ Todo created: ${todoData.task_name} (Complexity: ${todoData.complexity})`);
            
            const response: ApiResponse<{ task: TodoResponse }> = {
                success: true,
                data: { task }
            };
            
            res.json(response);
        } catch (error) {
            console.error('Error creating todo:', error);
            const response: ApiResponse = {
                success: false,
                error: (error as Error).message
            };
            res.status(500).json(response);
        }
    }

    static async completeTodo(req: CustomRequest, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const task = await TodoService.completeTodo(id);
            
            console.log(`✅ Todo completed: ${task.task_name}`);
            
            const response: ApiResponse<{ task: TodoResponse }> = {
                success: true,
                data: { task }
            };
            
            res.json(response);
        } catch (error) {
            console.error('Error completing todo:', error);
            
            if ((error as any).code === 'P2025') {
                const response: ApiResponse = {
                    success: false,
                    error: 'Todo not found'
                };
                res.status(404).json(response);
                return;
            }
            
            const response: ApiResponse = {
                success: false,
                error: (error as Error).message
            };
            res.status(500).json(response);
        }
    }

    static async getTodos(req: CustomRequest, res: Response): Promise<void> {
        try {
            const { status, limit = '50', offset = '0' } = req.query;
            
            const filters = {
                status: status as string,
                limit: parseInt(limit as string),
                offset: parseInt(offset as string)
            };
            
            const result = await TodoService.getTodos(filters);
            
            const response: ApiResponse<{ tasks: TodoResponse[]; count: number }> = {
                success: true,
                data: result
            };
            
            res.json(response);
        } catch (error) {
            console.error('Error fetching todos:', error);
            const response: ApiResponse = {
                success: false,
                error: (error as Error).message
            };
            res.status(500).json(response);
        }
    }

    static async getTodoById(req: CustomRequest, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const task = await TodoService.getTodoById(id);
            
            if (!task) {
                const response: ApiResponse = {
                    success: false,
                    error: 'Todo not found'
                };
                res.status(404).json(response);
                return;
            }
            
            const response: ApiResponse<{ task: TodoResponse }> = {
                success: true,
                data: { task }
            };
            
            res.json(response);
        } catch (error) {
            console.error('Error fetching todo:', error);
            const response: ApiResponse = {
                success: false,
                error: (error as Error).message
            };
            res.status(500).json(response);
        }
    }
}