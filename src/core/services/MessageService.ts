import { Client, Message, ChannelType } from 'discord.js';
import { SyncService } from '../../services/database/syncService.js';
import { GitHubSyncService } from '../../services/github/index.js';
import { UserService } from './UserService.js';
import { getDiscordFullName } from '../../shared/utils/discordHelpers.js';
import { ForumChannelConfig, ForumConfig } from '../../shared/types/common.js';

/**
 * Service responsible for handling Discord messages and their synchronization
 */
export class MessageService {
    private forumChannelIds: string[];
    private config: ForumConfig;
    // SyncService is now static, no need for instance
    private githubService: GitHubSyncService;

    constructor(
        forumChannelIds: string[], 
        config: ForumConfig, 
        syncService: null, // Legacy parameter, not used
        githubService: GitHubSyncService
    ) {
        this.forumChannelIds = forumChannelIds;
        this.config = config;
        // SyncService is now static, no need to store instance
        this.githubService = githubService;
    }

    /**
     * Handle new messages in forum threads
     */
    async handleMessage(message: Message): Promise<void> {
        // DM이나 봇 메시지는 무시
        if (!message.guild || message.author.bot) return;

        // 모니터링이 비활성화되어 있으면 return
        if (!this.config.monitoring.enabled) return;

        // 포럼 채널의 스레드에서 온 메시지인지 확인
        if (message.channel.type === ChannelType.PublicThread && 'parent' in message.channel && message.channel.parent) {
            const parentChannel = message.channel.parent;
            
            // 부모 채널이 모니터링 대상 포럼 채널인지 확인
            if (this.forumChannelIds.includes(parentChannel.id)) {
                const forumChannelConfig = this.config.monitoring.forumChannels.find(ch => ch.id === parentChannel.id);
                
                if (forumChannelConfig) {
                    await this.processForumMessage(message, forumChannelConfig);
                }
            }
        }
    }

    /**
     * Process forum message with all synchronization services
     */
    private async processForumMessage(message: Message, forumChannelConfig: ForumChannelConfig): Promise<void> {
        const timestamp = new Date().toLocaleString('ko-KR');
        
        console.log(`\n💬 [${timestamp}] 새 포럼 메시지 감지!`);
        console.log(`📋 포럼: ${forumChannelConfig.name} (${'parent' in message.channel ? message.channel.parent?.id : 'Unknown'})`);
        console.log(`📝 포스트: ${(message.channel as any).name}`);
        console.log(`👤 작성자: ${message.author.displayName || message.author.username} (${message.author.id})`);
        console.log(`💬 내용: ${message.content.length > 100 ? message.content.substring(0, 100) + '...' : message.content}`);

        // Supabase 동기화
        if (this.config.supabase?.enabled) {
            console.log(`💾 ${forumChannelConfig.table} 테이블에 Supabase 동기화 시도...`);
            try {
                const syncData = {
                    table: forumChannelConfig.table,
                    messageData: {
                        title: message.channel.isThread() ? message.channel.name : 'Message',
                        content: message.content,
                        details: {
                            messageId: message.id,
                            authorId: message.author.id,
                            authorName: message.author.displayName || message.author.username,
                            channelId: message.channel.id,
                            createdAt: message.createdAt.toISOString()
                        }
                    }
                };
                
                await SyncService.syncMessage(syncData);
                console.log(`✅ ${forumChannelConfig.table} 테이블 Supabase 동기화 성공`);
                
                // 사용자 점수 저장 (Supabase 동기화가 성공한 경우에만)
                if (forumChannelConfig.score !== 0) {
                    const userData = {
                        discord_id: message.author.id,
                        name: getDiscordFullName(message.author),
                        avatar_url: message.author.displayAvatarURL(),
                        score: forumChannelConfig.score,
                        scored_at: new Date().toISOString(),
                        scored_by: {
                            post_name: (message.channel as any).name || 'Unknown',
                            message_content: message.content.length > 500 ? message.content.substring(0, 500) + '...' : message.content,
                            message_link: `https://discord.com/channels/${message.guild?.id}/${message.channel.id}/${message.id}`
                        }
                    };
                    
                    await UserService.createOrUpdateUserScore(userData);
                    console.log(`✅ 사용자 점수 저장 성공: ${message.author.username} (+${forumChannelConfig.score}점)`);
                }
            } catch (error) {
                console.log(`❌ ${forumChannelConfig.table} 테이블 Supabase 동기화 실패:`, error);
            }
        }

        // GitHub 동기화 디버깅
        console.log(`🔍 [GITHUB DEBUG] 댓글 추가 조건 확인:`);
        console.log(`🔍 [GITHUB DEBUG] - config.github?.enabled: ${this.config.github?.enabled}`);
        console.log(`🔍 [GITHUB DEBUG] - forumChannelConfig?.github_sync: ${forumChannelConfig?.github_sync}`);
        console.log(`🔍 [GITHUB DEBUG] - GitHub 서비스 설정:`, this.githubService.getConfig());
        
        if (this.config.github?.enabled && forumChannelConfig?.github_sync) {
            console.log(`🐙 GitHub 댓글 동기화 시도...`);
            
            const result = await this.githubService.addCommentForNewMessage(message, forumChannelConfig.name);
            if (result) {
                console.log(`✅ GitHub 댓글 추가 성공: ${result}`);
            } else {
                console.log(`❌ GitHub 댓글 추가 실패 또는 연관된 이슈 없음`);
            }
        } else {
            console.log(`⚠️ GitHub 댓글 동기화 건너뜀 - 조건 불충족`);
        }
        
        this.logAlert(message);
    }

    /**
     * Handle bot messages (Todo, system messages)
     */
    async handleBotMessage(message: Message): Promise<void> {
        // 포럼 채널의 스레드에서 온 봇 메시지인지 확인
        if (message.channel.type === ChannelType.PublicThread && 'parent' in message.channel && message.channel.parent) {
            const parentChannel = message.channel.parent;
            
            // 부모 채널이 모니터링 대상 포럼 채널인지 확인
            if (this.forumChannelIds.includes(parentChannel.id)) {
                const forumChannelConfig = this.config.monitoring.forumChannels.find(ch => ch.id === parentChannel.id);
                
                // GitHub 동기화가 활성화된 경우에만 처리
                if (this.config.github?.enabled && forumChannelConfig?.github_sync) {
                    await this.processBotMessage(message, forumChannelConfig);
                }
            }
        }
    }

    /**
     * Process bot message for GitHub synchronization
     */
    private async processBotMessage(message: Message, forumChannelConfig: ForumChannelConfig): Promise<void> {
        // Todo 관련 메시지인지 확인 (코드블록으로 감싸진 Todo 정보)
        if (message.content.includes('task_name:') && message.content.includes('complexity:') && message.content.includes('due_date:')) {
            console.log(`\n🤖 [${new Date().toLocaleString('ko-KR')}] Todo 봇 메시지 감지!`);
            console.log(`📋 포럼: ${forumChannelConfig.name} (${'parent' in message.channel ? message.channel.parent?.id : 'Unknown'})`);
            console.log(`📝 포스트: ${'name' in message.channel ? message.channel.name : 'Unknown'}`);
            console.log(`🤖 봇: ${message.author.username} (${message.author.id})`);
            console.log(`💬 내용: ${message.content.length > 100 ? message.content.substring(0, 100) + '...' : message.content}`);
            
            // GitHub 동기화 (봇 메시지도 댓글로 추가)
            console.log(`🐙 GitHub Todo 메시지 동기화 시도...`);
            
            // 먼저 이슈가 존재하는지 확인하고 없으면 생성
            const issueNumber = await this.githubService.ensureIssueExists(message.channel.id, 'name' in message.channel ? message.channel.name || 'Unknown' : 'Unknown', forumChannelConfig.name);
            
            if (issueNumber) {
                const result = await this.githubService.addCommentForNewMessage(message, forumChannelConfig.name);
                if (result) {
                    console.log(`✅ GitHub Todo 메시지 추가 성공: ${result}`);
                } else {
                    console.log(`❌ GitHub Todo 메시지 추가 실패`);
                }
            } else {
                console.log(`❌ GitHub 이슈를 찾거나 생성할 수 없음`);
            }
        }
        // 기타 시스템 메시지들도 필요에 따라 동기화 가능
        else if (message.content.includes('**포스트 종료됨**') || message.content.includes('**포스트 재개됨**')) {
            console.log(`\n🔄 시스템 메시지 감지: ${message.content.substring(0, 50)}...`);
            
            // 먼저 이슈가 존재하는지 확인하고 없으면 생성
            const issueNumber = await this.githubService.ensureIssueExists(message.channel.id, 'name' in message.channel ? message.channel.name || 'Unknown' : 'Unknown', forumChannelConfig.name);
            
            if (issueNumber) {
                const result = await this.githubService.addCommentForNewMessage(message, forumChannelConfig.name);
                if (result) {
                    console.log(`✅ GitHub 시스템 메시지 추가 성공: ${result}`);
                }
            }
        }
    }

    /**
     * Log message activity
     */
    private logAlert(message: Message, isNewPost: boolean = false): void {
        // 모니터링이 비활성화되어 있으면 return
        if (!this.config.monitoring.enabled) return;

        // 포럼 채널 정보
        const forumChannel = message.channel.type === ChannelType.PublicThread ? message.channel.parent : null;
        if (!forumChannel) return;

        // 설정에서 포럼 채널 정보 가져오기
        const forumChannelConfig = this.config.monitoring.forumChannels.find(ch => ch.id === forumChannel.id);
        if (!forumChannelConfig) return;

        const timestamp = new Date().toLocaleString('ko-KR');
        const postLink = `https://discord.com/channels/${message.guild?.id}/${message.channel.id}`;
        const messageLink = `https://discord.com/channels/${message.guild?.id}/${message.channel.id}/${message.id}`;
        const threadName = message.channel.type === ChannelType.PublicThread ? message.channel.name : 'Unknown';
        const content = message.content.length > this.config.settings.maxMessageLength 
            ? message.content.substring(0, this.config.settings.maxMessageLength) + '...' 
            : message.content;

        console.log(`\n📊 [${timestamp}] ${isNewPost ? '새 포스트' : '새 메시지'} 로그`);
        console.log(`📋 포럼: ${forumChannelConfig.name} (${forumChannel.id})`);
        console.log(`📝 포스트: ${threadName}`);
        console.log(`👤 작성자: ${message.author.displayName || message.author.username} (${message.author.id})`);
        console.log(`💬 내용: ${content}`);
        console.log(`🔗 포스트: ${postLink}`);
        console.log(`🔗 메시지: ${messageLink}`);
        console.log(`🏢 서버: ${message.guild?.name}`);
        console.log(`✅ 로그 완료\n`);
    }
}