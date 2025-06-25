// Types for Supabase synchronization service
export interface SupabaseConfig {
    readonly serverUrl: string;
    readonly enabled: boolean;
}

export interface SyncResponse {
    readonly success: boolean;
    readonly data?: unknown;
    readonly error?: string;
}

export interface ForumPostData {
    readonly post_name: string;
    readonly content: string;
    readonly created_at: string;
    readonly details: PostDetails;
    readonly github?: string;
}

export interface ForumMessageData {
    readonly post_name: string;
    readonly content: string;
    readonly created_at: string;
    readonly details: MessageDetails;
    readonly github?: string;
}

export interface PostDetails {
    readonly authorName: string;
    readonly authorId: string;
    readonly postId: string;
    readonly messageId: string;
    readonly links: {
        readonly post: string;
        readonly message: string;
    };
}

export interface MessageDetails {
    readonly authorName: string;
    readonly authorId: string;
    readonly postId: string;
    readonly messageId: string;
    readonly links: {
        readonly post: string;
        readonly message: string;
    };
}

export interface StatsResponse {
    readonly tables: Record<string, number>;
    readonly total: number;
    readonly timestamp: string;
}

export type SupportedTable = 'Suggestions' | 'Reports' | 'Questions';

// Discord message interface for validation
export interface DiscordMessage {
    readonly id: string;
    readonly content: string;
    readonly createdAt: Date;
    readonly author: {
        readonly id: string;
        readonly username: string;
        readonly displayName?: string;
        readonly discriminator?: string;
    };
    readonly channel: {
        readonly id: string;
        readonly name?: string;
        readonly type: number;
        readonly parent?: {
            readonly id: string;
            readonly name: string;
            readonly type: number;
        } | null;
    };
    readonly guild: {
        readonly id: string;
        readonly name: string;
    };
}