import { Message } from 'discord.js';
export declare class SyncService {
    private baseUrl;
    private enabled;
    constructor(serverUrl?: string);
    setEnabled(enabled: boolean): void;
    syncForumPost(message: Message, tableName: string, isNewPost?: boolean): Promise<boolean>;
    syncForumMessage(message: Message, tableName: string, postTitle: string): Promise<boolean>;
    getStats(): Promise<any>;
    healthCheck(): Promise<boolean>;
    testConnection(): Promise<void>;
}
//# sourceMappingURL=SyncService.d.ts.map