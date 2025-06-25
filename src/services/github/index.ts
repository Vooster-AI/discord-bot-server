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
    private discordClient?: Client;

    constructor(config: GitHubConfig, discordClient?: Client) {
        this.config = config;
        this.client = new GitHubClient();
        this.mappingManager = new MappingManager();
        this.discordClient = discordClient;
        this.issueManager = new IssueManager(this.client, this.mappingManager, discordClient);
        this.commentManager = new CommentManager(this.client, this.mappingManager, this.issueManager);
        this.reactionManager = new ReactionManager(this.client, this.mappingManager, this.issueManager);
        
        // CommentManager를 IssueManager에 주입하여 순환 참조 해결
        this.issueManager.setCommentManager(this.commentManager);

        if (config.enabled && !this.client.validateCredentials()) {
            console.warn('⚠️ GitHub 동기화가 활성화되었지만 GITHUB_TOKEN 또는 GITHUB_REPOSITORY 환경변수가 설정되지 않았습니다.');
            this.config.enabled = false;
        }
    }

    public setEnabled(enabled: boolean) {
        this.config.enabled = enabled;
    }


    public async createIssueForNewPost(message: Message, forumChannelName: string): Promise<string | null> {
        if (!this.config.enabled) {
            console.log('📤 GitHub 동기화가 비활성화되어 있습니다.');
            return null;
        }

        const result = await this.issueManager.createIssueForNewPost(message, forumChannelName);
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

    public async reopenIssueForReopenedPost(threadId: string, reason?: string): Promise<boolean> {
        if (!this.config.enabled) {
            console.log('📤 GitHub 동기화가 비활성화되어 있습니다.');
            return false;
        }

        return await this.issueManager.reopenIssueForReopenedPost(threadId, reason);
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

    public async ensureIssueExists(threadId: string, threadName: string, forumChannelName: string): Promise<number | null> {
        if (!this.config.enabled) {
            return null;
        }

        // 먼저 기존 이슈가 있는지 확인
        let issueNumber: number | undefined = this.mappingManager.getIssueNumber(threadId) || undefined;
        
        if (!issueNumber) {
            // 매핑에 없으면 GitHub에서 검색
            const foundIssue = await this.issueManager.findExistingIssue(threadId, threadName);
            issueNumber = foundIssue || undefined;
        }
        
        if (!issueNumber && this.discordClient) {
            // 이슈가 없으면 새로 생성하고 전체 동기화
            console.log(`🔄 동기화되지 않은 포스트 발견, 자동 이슈 생성 및 전체 동기화 시작...`);
            console.log(`📝 스레드: ${threadName} (${threadId})`);
            
            try {
                // 스레드 정보 가져오기
                const channel = await this.discordClient.channels.fetch(threadId);
                if (channel && channel.isThread()) {
                    // 첫 번째 메시지 가져오기
                    let firstMessage: any = null;
                    
                    try {
                        firstMessage = await channel.fetchStarterMessage();
                    } catch {
                        const messages = await channel.messages.fetch({ limit: 50, cache: false });
                        firstMessage = messages.last();
                    }
                    
                    if (firstMessage) {
                        // 새 이슈 생성
                        const issueUrl = await this.issueManager.createIssueForNewPost(firstMessage, forumChannelName);
                        if (issueUrl) {
                            const newIssueNumber = this.mappingManager.getIssueNumber(threadId);
                            if (newIssueNumber) {
                                issueNumber = newIssueNumber;
                                console.log(`✅ 자동 이슈 생성 완료: #${issueNumber}`);
                                
                                // 기존 모든 메시지들을 댓글로 동기화 (첫 번째 메시지 제외)
                                await this.syncAllExistingMessages(channel, issueNumber, (firstMessage as any).id, forumChannelName);
                            }
                        }
                    }
                }
            } catch (error) {
                console.error('❌ 자동 이슈 생성 중 오류:', error);
            }
        }
        
        return issueNumber || null;
    }

    private async syncAllExistingMessages(thread: any, issueNumber: number, firstMessageId: string, forumChannelName: string): Promise<void> {
        try {
            console.log(`📝 기존 메시지들을 GitHub 이슈 #${issueNumber}에 동기화 시작...`);
            
            // 스레드의 모든 메시지 가져오기 (최대 100개)
            const messages = await thread.messages.fetch({ limit: 100 });
            
            // 메시지를 시간 순으로 정렬 (오래된 것부터)
            const sortedMessages = Array.from(messages.values())
                .filter((msg: any) => msg.id !== firstMessageId) // 첫 번째 메시지는 이미 이슈에 포함됨
                .sort((a: any, b: any) => a.createdTimestamp - b.createdTimestamp);
            
            console.log(`📝 동기화할 메시지 수: ${sortedMessages.length}개`);
            
            if (sortedMessages.length === 0) {
                console.log(`⚠️ 동기화할 기존 메시지가 없습니다.`);
                return;
            }
            
            // 각 메시지를 댓글로 추가 (봇 메시지 포함)
            for (const msg of sortedMessages) {
                try {
                    const message = msg as any;
                    console.log(`📝 메시지 동기화 중: ${message.author.username} (봇: ${message.author.bot})`);
                    
                    // CommentManager의 댓글 추가 기능 사용
                    if (this.commentManager) {
                        await this.commentManager.addCommentToExistingIssue(message, issueNumber, forumChannelName);
                    }
                    
                    // API 호출 간격 조절 (GitHub API rate limit 방지)
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                } catch (commentError: any) {
                    const message = msg as any;
                    console.error(`❌ 메시지 동기화 실패 (${message.id}):`, commentError.message);
                }
            }
            
            console.log(`✅ 기존 메시지 동기화 완료: ${sortedMessages.length}개 처리됨`);
            
        } catch (error: any) {
            console.error('❌ 기존 메시지 동기화 중 오류:', error.message);
        }
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