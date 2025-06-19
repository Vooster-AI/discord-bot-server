import { Client } from 'discord.js';
interface ForumChannelConfig {
    id: string;
    name: string;
    description: string;
    table: string;
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
}
export declare class ForumMonitor {
    private client;
    private config;
    private forumChannelIds;
    private syncService;
    constructor(client: Client);
    private loadConfig;
    private setupEventListeners;
    private handleMessage;
    private handleThreadCreate;
    private logAlert;
    getMonitoredChannels(): string[];
    getConfig(): ForumConfig;
    addForumChannel(channelId: string): void;
    removeForumChannel(channelId: string): void;
}
declare const _default: {
    name: string;
    run: (client: any, msg: any, args: any) => void;
};
export default _default;
//# sourceMappingURL=forum.d.ts.map