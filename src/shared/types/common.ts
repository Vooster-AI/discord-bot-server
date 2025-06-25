/**
 * Common types used across the application
 */

// Discord related types
export interface DiscordUser {
    id: string;
    username: string;
    displayName?: string;
    avatarUrl?: string;
}

export interface DiscordMessage {
    id: string;
    content: string;
    authorId: string;
    channelId: string;
    guildId?: string;
    createdAt: Date;
    link: string;
}

// Forum configuration types
export interface ForumChannelConfig {
    id: string;
    name: string;
    table: string;
    score: number;
    github_sync?: boolean;
}

export interface ForumConfig {
    monitoring: {
        enabled: boolean;
        forumChannels: ForumChannelConfig[];
    };
    settings: {
        maxMessageLength: number;
        checkDelay: number;
    };
    supabase?: {
        enabled: boolean;
        serverUrl: string;
    };
    github?: {
        enabled: boolean;
        token?: string;
        owner?: string;
        repo?: string;
    };
}

// Service operation results
export interface ServiceResult<T = any> {
    success: boolean;
    data?: T;
    error?: string;
}

export interface SyncOptions {
    enableScoring: boolean;
    enableGitHubSync: boolean;
    channelScore: number;
}

// User and scoring types
export interface CreateUserData {
    discordId: string;
    username: string;
    displayName?: string;
    avatarUrl?: string;
}

export interface ScoreData {
    score: number;
    postName?: string;
    messageContent?: string;
    messageLink?: string;
    scoredAt: Date;
}

export interface ScoreLogEntry {
    score: number;
    scored_at: string;
    post_name: string;
    message_content: string;
    message_link: string;
}