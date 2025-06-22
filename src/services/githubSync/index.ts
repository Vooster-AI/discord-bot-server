import { GitHubClient } from './client.js';
import { MappingManager } from './mapping.js';
import { IssueManager } from './issues.js';
import { CommentManager } from './comments.js';
import { ReactionManager } from './reactions.js';
import { GitHubConfig } from './types.js';
import { Message, Client } from 'discord.js';

export class GitHubSyncService {
    private config: GitHubConfig;
    private client: GitHubClient;
    private mappingManager: MappingManager;
    private issueManager: IssueManager;
    private commentManager: CommentManager;
    private reactionManager: ReactionManager;
    private webhookCallback: ((issueNumber: number, threadId: string) => void) | null = null;

    constructor(config: GitHubConfig, discordClient?: Client) {
        this.config = config;
        this.client = new GitHubClient();
        this.mappingManager = new MappingManager();
        this.issueManager = new IssueManager(this.client, this.mappingManager, discordClient);
        this.commentManager = new CommentManager(this.client, this.mappingManager, this.issueManager);
        this.reactionManager = new ReactionManager(this.client, this.mappingManager, this.issueManager);

        if (config.enabled && !this.client.validateCredentials()) {
            console.warn('⚠️ GitHub 동기화가 활성화되었지만 GITHUB_TOKEN 또는 GITHUB_REPOSITORY 환경변수가 설정되지 않았습니다.');
            this.config.enabled = false;
        }
    }

    public setEnabled(enabled: boolean) {
        this.config.enabled = enabled;
    }

    public setWebhookCallback(callback: (issueNumber: number, threadId: string) => void) {
        this.webhookCallback = callback;
    }

    public async createIssueForNewPost(message: Message, forumChannelName: string): Promise<string | null> {
        if (!this.config.enabled) {
            console.log('📤 GitHub 동기화가 비활성화되어 있습니다.');
            return null;
        }

        const result = await this.issueManager.createIssueForNewPost(message, forumChannelName);
        
        if (result && this.webhookCallback && message.channel) {
            const issueNumber = this.mappingManager.getIssueNumber(message.channel.id);
            if (issueNumber) {
                this.webhookCallback(issueNumber, message.channel.id);
                this.mappingManager.forceSave();
            }
        }
        
        return result;
    }

    public async addCommentForNewMessage(message: Message, forumChannelName: string): Promise<string | null> {
        if (!this.config.enabled) {
            console.log('📤 GitHub 동기화가 비활성화되어 있습니다.');
            return null;
        }

        return await this.commentManager.addCommentForNewMessage(message, forumChannelName);
    }

    public async deleteCommentForMessage(messageId: string): Promise<boolean> {
        if (!this.config.enabled) {
            console.log('📤 GitHub 동기화가 비활성화되어 있습니다.');
            return false;
        }

        return await this.commentManager.deleteCommentForMessage(messageId);
    }

    public async closeIssueForClosedPost(threadId: string, reason?: string): Promise<boolean> {
        if (!this.config.enabled) {
            console.log('📤 GitHub 동기화가 비활성화되어 있습니다.');
            return false;
        }

        return await this.issueManager.closeIssueForClosedPost(threadId, reason);
    }

    public async handleReaction(messageId: string, threadId: string, emoji: string, userId: string, userName: string, added: boolean, threadName?: string): Promise<boolean> {
        if (!this.config.enabled) {
            console.log(`❌ [GITHUB DEBUG] GitHub 동기화 비활성화됨`);
            return false;
        }

        return await this.reactionManager.handleReaction(messageId, threadId, emoji, userId, userName, added, threadName);
    }

    public async findExistingIssue(threadId: string, threadTitle: string): Promise<number | null> {
        return await this.issueManager.findExistingIssue(threadId, threadTitle);
    }

    public async testConnection(): Promise<boolean> {
        return await this.client.testConnection();
    }

    public getIssueNumber(threadId: string): number | undefined {
        return this.mappingManager.getIssueNumber(threadId);
    }

    public setIssueMapping(threadId: string, issueNumber: number): void {
        this.mappingManager.setIssueMapping(threadId, issueNumber);
    }

    public getConfig(): GitHubConfig {
        return this.config;
    }
}

export * from './types.js';
export { GitHubClient } from './client.js';
export { MappingManager } from './mapping.js';
export { FileStorage } from './fileStorage.js';
export { IssueManager } from './issues.js';
export { CommentManager } from './comments.js';
export { ReactionManager } from './reactions.js';
export { IssueResolver } from './issueResolver.js';