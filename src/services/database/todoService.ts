import { PrismaClient } from '@prisma/client';
import { CreateTodoRequest, TodoResponse } from '../../shared/types/api.js';
import { ensureDiscordIdString } from '../../api/middlewares/validation.js';

const prisma = new PrismaClient();

export class TodoService {
    static async createTodo(todoData: CreateTodoRequest & { complexityNum: number; due_dateParsed: Date }): Promise<TodoResponse> {
        // Extract Discord information from URL
        const urlPattern = /https:\/\/discord\.com\/channels\/(\d+)\/(\d+)\/(\d+)/;
        const urlParts = todoData.url.match(urlPattern);
        
        if (!urlParts) {
            throw new Error('Invalid Discord URL format');
        }

        const [, guildId, channelId, messageId] = urlParts;
        
        // Ensure Discord IDs are treated as strings to preserve precision
        const guildIdStr = ensureDiscordIdString(guildId);
        const channelIdStr = ensureDiscordIdString(channelId);
        const messageIdStr = ensureDiscordIdString(messageId);

        const task = await prisma.task.create({
            data: {
                taskName: todoData.task_name,
                complexity: todoData.complexityNum,
                dueDate: todoData.due_dateParsed,
                url: todoData.url,
                threadId: messageIdStr,
                channelId: channelIdStr,
                guildId: guildIdStr,
                status: 'pending'
            }
        });

        return {
            id: task.id,
            task_name: task.taskName,
            complexity: task.complexity,
            due_date: task.dueDate.toISOString(),
            status: task.status,
            url: task.url,
            created_at: task.createdAt.toISOString(),
            thread_id: task.threadId,
            channel_id: task.channelId,
            guild_id: task.guildId
        };
    }

    static async completeTodo(id: string): Promise<TodoResponse> {
        const task = await prisma.task.update({
            where: { id },
            data: { 
                status: 'completed',
                completedAt: new Date()
            }
        });

        return {
            id: task.id,
            task_name: task.taskName,
            complexity: task.complexity,
            due_date: task.dueDate.toISOString(),
            status: task.status,
            url: task.url,
            completed_at: task.completedAt?.toISOString()
        };
    }

    static async getTodos(filters: { status?: string; limit?: number; offset?: number }): Promise<{ tasks: TodoResponse[]; count: number }> {
        const { status, limit = 50, offset = 0 } = filters;
        
        const where: any = {};
        if (status && ['pending', 'in_progress', 'completed'].includes(status)) {
            where.status = status;
        }

        const tasks = await prisma.task.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: limit,
            skip: offset
        });

        const formattedTasks: TodoResponse[] = tasks.map(task => ({
            id: task.id,
            task_name: task.taskName,
            complexity: task.complexity,
            due_date: task.dueDate.toISOString(),
            status: task.status,
            url: task.url,
            created_at: task.createdAt.toISOString(),
            completed_at: task.completedAt?.toISOString(),
            thread_id: task.threadId,
            channel_id: task.channelId,
            guild_id: task.guildId
        }));

        return {
            tasks: formattedTasks,
            count: tasks.length
        };
    }

    static async getTodoById(id: string): Promise<TodoResponse | null> {
        const task = await prisma.task.findUnique({
            where: { id }
        });

        if (!task) {
            return null;
        }

        return {
            id: task.id,
            task_name: task.taskName,
            complexity: task.complexity,
            due_date: task.dueDate.toISOString(),
            status: task.status,
            url: task.url,
            created_at: task.createdAt.toISOString(),
            completed_at: task.completedAt?.toISOString(),
            thread_id: task.threadId,
            channel_id: task.channelId,
            guild_id: task.guildId
        };
    }
}