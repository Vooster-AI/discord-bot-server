import { Request, Response, NextFunction } from 'express';

// Common API types
export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}

export interface PaginationQuery {
    limit?: string;
    offset?: string;
    page?: string;
}

export interface CustomRequest extends Request {
    user?: any;
    discordClient?: any;
}

export type AsyncHandler = (req: CustomRequest, res: Response, next?: NextFunction) => Promise<Response | void>;

// User related types
export interface CreateUserRequest {
    name: string;
    discord_id: string;
    score: number;
    scored_at: string;
    scored_by: {
        post_name?: string;
        message_content?: string;
        message_link?: string;
    };
    avatar_url?: string;
}

export interface UserResponse {
    id: string;
    discord_id: string;
    name: string;
    score?: number;
    avatar_url?: string;
    created_at?: string;
    updated_at?: string;
}

// Todo related types
export interface CreateTodoRequest {
    task_name: string;
    complexity: string | number;
    due_date: string;
    url: string;
}

export interface TodoResponse {
    id: string;
    task_name: string;
    complexity: number;
    due_date: string;
    status: string;
    url: string;
    created_at?: string;
    completed_at?: string;
    thread_id?: string;
    channel_id?: string;
    guild_id?: string;
}

// Forum related types
export interface CreateForumRequest {
    name: string;
    channel_id: string;
    table_name: string;
    score: string | number;
    todo?: boolean;
    github_sync?: boolean;
}

export interface ForumResponse {
    id: string;
    name: string;
    channel_id: string;
    table_name: string;
    score: number;
    todo: boolean;
    github_sync: boolean;
    created_at?: string;
}

// Sync related types
export interface SyncRequest {
    table: string;
    data: any;
}

export interface SyncPostRequest {
    table: string;
    postData: any;
}

export interface SyncMessageRequest {
    table: string;
    messageData: any;
}

// Discord related types
export interface DiscordReplyRequest {
    task_name: string;
    complexity: string | number;
    due_date: string;
    thread_id: string;
}

export interface DiscordReplyResponse {
    success: boolean;
    message_id: string;
    thread_id: string;
    task_id: string;
}

// GitHub related types
export interface CreateGitHubIssueRequest {
    title: string;
    body: string;
    labels?: string[];
}

export interface GitHubIssueResponse {
    id: number;
    title: string;
    body: string;
    labels: string[];
    url: string;
    created_at: string;
}

// Stats related types
export interface StatsResponse {
    local_db: {
        tasks: number;
        users: number;
    };
    supabase: Record<string, number>;
    totals: {
        local_tasks: number;
        local_users: number;
        supabase_records: number;
    };
    timestamp: string;
}