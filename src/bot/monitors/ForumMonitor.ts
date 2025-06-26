import { Client, ChannelType, Message, MessageReaction, User, PartialMessage, PartialMessageReaction, PartialUser } from 'discord.js';
import { SyncService } from '../../services/database/syncService.js';
import { GitHubSyncService } from '../../services/github/index.js';
import { MessageSyncService } from '../../services/sync/messageSync.js';
import { MessageService } from '../../core/services/MessageService.js';
import { ReactionService } from '../../core/services/ReactionService.js';
import { getForumConfig } from '../../shared/utils/configService.js';
import { ForumChannelConfig, ForumConfig } from '../../shared/types/common.js';

/**
 * Refactored Forum Monitor with separated concerns
 * Now delegates responsibilities to specific services
 */
export class ForumMonitor {
    private client: Client;
    private config: ForumConfig = null as any;
    private forumChannelIds: string[];
    
    // Core services
    // SyncService is now static, no need for instance
    private githubService: GitHubSyncService;
    private messageSyncService: MessageSyncService;
    
    // Refactored services
    private messageService: MessageService;
    private reactionService: ReactionService;

    constructor(client: Client) {
        this.client = client;
        this.forumChannelIds = [];
        this.messageSyncService = new MessageSyncService();
        this.init();
    }

    private async init() {
        await this.loadConfig();
        this.forumChannelIds = this.config.monitoring.forumChannels.map(channel => channel.id);
        
        // Initialize services - SyncService is now static
        // SyncService is now static, no need to instantiate
        this.githubService = new GitHubSyncService({
            enabled: this.config.github?.enabled || false
        }, this.client);
        
        this.messageService = new MessageService(
            this.forumChannelIds, 
            this.config, 
            null, // syncService is now static, pass null
            this.githubService
        );
        this.reactionService = new ReactionService(this.forumChannelIds, this.config, this.githubService);

        this.setupEventListeners();
        this.logInitialization();
    }

    private setupEventListeners() {
        // 메시지 생성 이벤트
        this.client.on('messageCreate', async (message: Message) => {
            if (message.author.bot) {
                await this.messageService.handleBotMessage(message);
            } else {
                await this.messageService.handleMessage(message);
            }
        });

        // 스레드 생성 이벤트 (새 포럼 포스트)
        this.client.on('threadCreate', async (thread) => {
            await this.handleThreadCreate(thread);
        });

        // 스레드 업데이트 이벤트 (포스트 상태 변경)
        this.client.on('threadUpdate', async (oldThread, newThread) => {
            await this.handleThreadUpdate(oldThread, newThread);
        });

        // 메시지 삭제 이벤트
        this.client.on('messageDelete', async (message) => {
            await this.handleMessageDelete(message);
        });

        // 반응 추가 이벤트
        this.client.on('messageReactionAdd', async (reaction, user) => {
            await this.reactionService.handleReactionAdd(reaction, user);
        });

        // 반응 제거 이벤트
        this.client.on('messageReactionRemove', async (reaction, user) => {
            await this.reactionService.handleReactionRemove(reaction, user);
        });
    }

    private async handleThreadCreate(thread: any) {
        // 새로운 포럼 포스트(스레드) 생성 감지
        if (thread.parent && this.forumChannelIds.includes(thread.parent.id)) {
            const forumChannelConfig = this.config.monitoring.forumChannels.find(ch => ch.id === thread.parent.id);
            const timestamp = new Date().toLocaleString('ko-KR');
            
            console.log(`\n🆕 [${timestamp}] 새 포럼 포스트 생성!`);
            console.log(`📋 포럼: ${forumChannelConfig?.name || thread.parent.name} (${thread.parent.id})`);
            console.log(`📝 포스트 제목: ${thread.name}`);
            console.log(`🔗 포스트 링크: https://discord.com/channels/${thread.guild.id}/${thread.id}`);
            console.log(`⏳ ${this.config.settings.checkDelay}ms 후 첫 메시지 확인...`);
            
            // 잠시 대기 후 첫 번째 메시지 가져오기
            setTimeout(async () => {
                try {
                    const messages = await thread.messages.fetch({ limit: 1 });
                    const firstMessage = messages.first();
                    if (firstMessage) {
                        console.log(`✅ 첫 메시지 발견 - 작성자: ${firstMessage.author.displayName || firstMessage.author.username}`);
                        
                        await this.processNewPost(firstMessage, forumChannelConfig);
                    } else {
                        console.log(`❌ 첫 메시지를 찾을 수 없음`);
                    }
                } catch (error) {
                    console.error('❌ Error fetching thread messages:', error);
                }
            }, this.config.settings.checkDelay);
        }
    }

    private async processNewPost(firstMessage: Message, forumChannelConfig: ForumChannelConfig | undefined) {
        if (!forumChannelConfig) return;

        // Supabase 동기화 (새 포스트)
        if (this.config.supabase?.enabled) {
            console.log(`💾 ${forumChannelConfig.table} 테이블에 새 포스트 Supabase 동기화 시도...`);
            try {
                const syncData = {
                    table: forumChannelConfig.table,
                    postData: {
                        title: firstMessage.channel.isThread() ? firstMessage.channel.name : 'New Post',
                        content: firstMessage.content,
                        details: {
                            postId: firstMessage.id,
                            messageId: firstMessage.id,
                            authorId: firstMessage.author.id,
                            authorName: firstMessage.author.displayName || firstMessage.author.username,
                            channelId: firstMessage.channel.id,
                            createdAt: firstMessage.createdAt.toISOString(),
                            isNewPost: true
                        }
                    }
                };
                
                await SyncService.syncPost(syncData);
                console.log(`✅ ${forumChannelConfig.table} 테이블 새 포스트 Supabase 동기화 성공`);
            } catch (error) {
                console.log(`❌ ${forumChannelConfig.table} 테이블 새 포스트 Supabase 동기화 실패:`, error);
            }
        }

        // GitHub 동기화 (새 이슈)
        if (this.config.github?.enabled && forumChannelConfig?.github_sync) {
            console.log(`🐙 GitHub 이슈 생성 시도...`);
            
            const result = await this.githubService.createIssueForNewPost(firstMessage, forumChannelConfig.name);
            if (result) {
                console.log(`✅ GitHub 이슈 생성 성공: ${result}`);
                
                // 이슈 번호를 스레드의 첫 메시지에 반응으로 추가
                try {
                    await firstMessage.react('🐙');
                } catch (reactionError) {
                    console.log('⚠️  GitHub 이슈 생성 반응 추가 실패:', reactionError);
                }
            } else {
                console.error(`❌ GitHub 이슈 생성 실패`);
            }
        }
        
        this.messageService['logAlert'](firstMessage, true);
    }

    private async handleThreadUpdate(oldThread: any, newThread: any) {
        try {
            // 포럼 채널의 스레드인지 확인
            if (newThread.parent && this.forumChannelIds.includes(newThread.parent.id)) {
                const forumChannelConfig = this.config.monitoring.forumChannels.find(ch => ch.id === newThread.parent.id);
                const timestamp = new Date().toLocaleString('ko-KR');
                
                // 스레드가 잠겼거나 아카이브된 경우 (포스트 종료)
                if ((newThread.locked && !oldThread.locked) || (newThread.archived && !oldThread.archived)) {
                    console.log(`\n🔒 [${timestamp}] 포럼 포스트 종료 감지!`);
                    console.log(`📋 포럼: ${forumChannelConfig?.name} (${newThread.parent.id})`);
                    console.log(`📝 포스트: ${newThread.name} (${newThread.id})`);
                    console.log(`🔒 상태: ${newThread.locked ? '잠김' : ''} ${newThread.archived ? '아카이브됨' : ''}`);
                    
                    // GitHub 이슈 종료 동기화
                    if (this.config.github?.enabled && forumChannelConfig?.github_sync) {
                        console.log(`🐙 GitHub 이슈 종료 동기화 시도...`);
                        
                        const issueNumber = await this.githubService.ensureIssueExists(newThread.id, newThread.name, forumChannelConfig.name);
                        
                        if (issueNumber) {
                            const result = await this.githubService.closeIssueForClosedPost(newThread.id, '포스트가 종료되었습니다.');
                            if (result) {
                                console.log(`✅ GitHub 이슈 종료 성공`);
                            } else {
                                console.log(`❌ GitHub 이슈 종료 실패`);
                            }
                        } else {
                            console.log(`❌ GitHub 이슈를 찾거나 생성할 수 없음`);
                        }
                    }
                }
                
                // 스레드가 다시 열린 경우 (포스트 재개)
                if ((!newThread.locked && oldThread.locked) || (!newThread.archived && oldThread.archived)) {
                    console.log(`\n🔓 [${timestamp}] 포럼 포스트 재개 감지!`);
                    console.log(`📋 포럼: ${forumChannelConfig?.name} (${newThread.parent.id})`);
                    console.log(`📝 포스트: ${newThread.name} (${newThread.id})`);
                    console.log(`🔓 상태: ${!newThread.locked ? '잠금 해제' : ''} ${!newThread.archived ? '아카이브 해제' : ''}`);
                    
                    // GitHub 이슈 다시 열기 동기화
                    if (this.config.github?.enabled && forumChannelConfig?.github_sync) {
                        console.log(`🐙 GitHub 이슈 재개 동기화 시도...`);
                        
                        const issueNumber = await this.githubService.ensureIssueExists(newThread.id, newThread.name, forumChannelConfig.name);
                        
                        if (issueNumber) {
                            const result = await this.githubService.reopenIssueForReopenedPost(newThread.id, '포스트가 다시 열렸습니다.');
                            if (result) {
                                console.log(`✅ GitHub 이슈 재개 성공`);
                            } else {
                                console.log(`❌ GitHub 이슈 재개 실패`);
                            }
                        } else {
                            console.log(`❌ GitHub 이슈를 찾거나 생성할 수 없음`);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('❌ 스레드 업데이트 처리 중 오류:', error);
        }
    }

    private async handleMessageDelete(message: Message | PartialMessage) {
        // 부분 메시지인 경우 처리
        if (message.partial) {
            try {
                await message.fetch();
            } catch (error) {
                console.error('❌ 삭제된 메시지 정보를 가져올 수 없음:', error);
            }
        }

        // DM이나 봇 메시지는 무시
        if (!message.guild || message.author?.bot) return;

        // 포럼 채널의 스레드에서 온 메시지인지 확인
        if (message.channel?.type === ChannelType.PublicThread && message.channel.parent) {
            const parentChannel = message.channel.parent;
            
            if (this.forumChannelIds.includes(parentChannel.id)) {
                const forumChannelConfig = this.config.monitoring.forumChannels.find(ch => ch.id === parentChannel.id);
                const timestamp = new Date().toLocaleString('ko-KR');
                
                console.log(`\n🗑️ [${timestamp}] 포럼 메시지 삭제 감지!`);
                console.log(`📋 포럼: ${forumChannelConfig?.name || parentChannel.name} (${parentChannel.id})`);
                console.log(`📝 포스트: ${message.channel.name}`);
                console.log(`👤 작성자: ${message.author?.displayName || message.author?.username} (${message.author?.id})`);
                console.log(`🆔 메시지 ID: ${message.id}`);
                
                if (forumChannelConfig) {
                    const syncOptions = {
                        enableScoring: !!(this.config.supabase?.enabled && forumChannelConfig.score !== 0),
                        enableGitHubSync: !!(this.config.github?.enabled && forumChannelConfig.github_sync === true),
                        channelScore: Math.abs(forumChannelConfig.score)
                    };

                    console.log(`🔄 메시지 삭제 처리 시작...`);
                    const result = await this.messageSyncService.handleMessageDelete(message, syncOptions);
                    
                    if (result.success) {
                        console.log(`✅ 메시지 삭제 처리 완료`);
                    } else {
                        console.error(`❌ 메시지 삭제 처리 실패: ${result.error}`);
                    }
                }
            }
        }
    }

    private async loadConfig(): Promise<void> {
        try {
            this.config = await getForumConfig();
            console.log('✅ Supabase에서 포럼 설정을 성공적으로 로드했습니다.');
        } catch (error) {
            console.error('❌ 포럼 설정을 로드할 수 없습니다:', error);
            console.error('💡 Supabase Forums 테이블에 데이터가 있는지 확인하세요.');
            process.exit(1);
        }
    }

    private logInitialization(): void {
        console.log('\\n🔧 포럼 모니터링 시스템 초기화 완료');
        console.log(`📊 모니터링 상태: ${this.config.monitoring.enabled ? '활성화' : '비활성화'}`);
        console.log(`📋 모니터링 채널 수: ${this.config.monitoring.forumChannels.length}개`);
        
        this.config.monitoring.forumChannels.forEach((channel, index) => {
            console.log(`  ${index + 1}. ${channel.name} (${channel.id})`);
        });
        
        console.log(`⚙️  설정: 메시지 최대 길이 ${this.config.settings.maxMessageLength}자, 체크 지연 ${this.config.settings.checkDelay}ms`);
        
        const supabaseStatus = this.config.supabase?.enabled ? '활성화' : '비활성화';
        console.log(`💾 Supabase 동기화: ${supabaseStatus}`);
        if (this.config.supabase?.enabled) {
            console.log(`🔗 서버 URL: ${this.config.supabase.serverUrl}`);
            // SyncService is now static, no need for instance methods
        }

        const githubStatus = this.config.github?.enabled ? '활성화' : '비활성화';
        console.log(`🐙 GitHub 동기화: ${githubStatus}`);
        if (this.config.github?.enabled) {
            console.log(`🔗 GitHub 설정:`, this.config.github);
            this.githubService.testConnection();
        }
    }

    public setWebhookCallback() {
        console.log('👂 포럼 활동 모니터링 시작...\\n');
    }

    public getMonitoredChannels(): string[] {
        return this.forumChannelIds;
    }

    public getConfig(): ForumConfig {
        return this.config;
    }

    public addForumChannel(channelId: string) {
        if (!this.forumChannelIds.includes(channelId)) {
            this.forumChannelIds.push(channelId);
        }
    }

    public removeForumChannel(channelId: string) {
        this.forumChannelIds = this.forumChannelIds.filter(id => id !== channelId);
    }
}

export default ForumMonitor;