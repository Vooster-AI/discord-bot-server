import { Client } from 'discord.js';
interface ForumChannelConfig {
    id: string;
    name: string;
    table: string;
    score: number;
}
interface ForumConfig {
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
    };
}
export declare class ForumMonitor {
    private client;
    private config;
    private forumChannelIds;
    private syncService;
    private githubService;
    constructor(client: Client);
    setWebhookCallback(callback: (issueNumber: number, threadId: string) => void): void;
    private loadConfig;
    private setupEventListeners;
    private handleMessage;
    private handleThreadCreate;
    private logAlert;
    private handleReactionAdd;
    private handleReactionRemove;
    private handleThreadUpdate;
    getMonitoredChannels(): string[];
    getConfig(): ForumConfig;
    addForumChannel(channelId: string): void;
    removeForumChannel(channelId: string): void;
    private saveUserScore;
    private handleMessageDelete;
}
declare const _default: {
    name: string;
    run: (client: any, msg: any, args: any) => void;
};
export default _default;
//# sourceMappingURL=forum.d.ts.map