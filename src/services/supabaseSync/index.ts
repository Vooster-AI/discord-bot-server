import { SupabaseClient } from './client.js';
import { DataValidator } from './validator.js';
import { DataTransformer } from './transformer.js';
import type { 
    SupabaseConfig, 
    SyncResponse, 
    StatsResponse, 
    DiscordMessage, 
    SupportedTable 
} from './types.js';

export class SyncService {
    private readonly client: SupabaseClient;
    private enabled: boolean;

    constructor(serverUrl: string = 'http://localhost:3000') {
        this.client = new SupabaseClient(serverUrl);
        this.enabled = true;
    }

    setEnabled(enabled: boolean): void {
        this.enabled = enabled;
    }

    async syncForumPost(
        message: DiscordMessage, 
        tableName: SupportedTable, 
        isNewPost: boolean = true, 
        githubUrl?: string
    ): Promise<boolean> {
        if (!this.enabled) {
            console.log('📤 동기화가 비활성화되어 있습니다.');
            return false;
        }

        try {
            if (!DataValidator.validateForumPost(message)) {
                return false;
            }

            const postData = DataTransformer.transformForumPost(message, githubUrl);
            const response = await this.client.syncData(tableName, postData);

            if (response.success) {
                const threadName = message.channel.name || 'Unknown Thread';
                console.log(`✅ ${tableName} 테이블에 포스트 동기화 완료: ${threadName}`);
                return true;
            } else {
                console.log(`❌ ${tableName} 테이블 포스트 동기화 실패: ${response.error}`);
                return false;
            }
        } catch (error) {
            console.error('❌ 포스트 동기화 중 오류:', error);
            return false;
        }
    }

    async syncForumMessage(
        message: DiscordMessage, 
        tableName: SupportedTable, 
        postTitle: string, 
        githubUrl?: string
    ): Promise<boolean> {
        if (!this.enabled) {
            console.log('📤 동기화가 비활성화되어 있습니다.');
            return false;
        }

        try {
            if (!DataValidator.validateForumMessage(message)) {
                return false;
            }

            const messageData = DataTransformer.transformForumMessage(message, postTitle, githubUrl);
            const response = await this.client.syncData(tableName, messageData);

            if (response.success) {
                console.log(`✅ ${tableName} 테이블에 메시지 동기화 완료: ${message.author.username}`);
                return true;
            } else {
                console.log(`❌ ${tableName} 테이블 메시지 동기화 실패: ${response.error}`);
                return false;
            }
        } catch (error) {
            console.error('❌ 메시지 동기화 중 오류:', error);
            return false;
        }
    }

    async getStats(): Promise<StatsResponse | null> {
        return await this.client.getStats();
    }

    async healthCheck(): Promise<boolean> {
        return await this.client.healthCheck();
    }

    async testConnection(): Promise<void> {
        return await this.client.testConnection();
    }
}

// Re-export all types and classes for external use
export * from './types.js';
export { SupabaseClient } from './client.js';
export { DataValidator } from './validator.js';
export { DataTransformer } from './transformer.js';