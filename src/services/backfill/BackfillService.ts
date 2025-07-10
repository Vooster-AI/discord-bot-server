import { Client, TextChannel, ThreadChannel, Message, ChannelType } from 'discord.js';
import { GitHubSyncService } from '../github/index.js';
import { UserService } from '../../core/services/UserService.js';
import { MessageService } from '../../core/services/MessageService.js';
import { SyncService } from '../database/syncService.js';
import { getForumConfig } from '../../shared/utils/configService.js';
import { MessageSyncService } from '../sync/messageSync.js';

export interface BackfillOptions {
    startDate?: Date;
    endDate?: Date;
    batchSize: number;
    delay: number;
    syncToGitHub: boolean;
    syncToSupabase: boolean;
    updateScores: boolean;
    onProgress?: (progress: BackfillProgress) => void;
}

export interface BackfillProgress {
    jobId: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    channelId: string;
    channelName: string;
    processed: number;
    total: number;
    errors: BackfillError[];
    startTime: Date;
    endTime?: Date;
}

export interface BackfillError {
    messageId: string;
    error: string;
    timestamp: Date;
}

export interface BackfillResult {
    jobId: string;
    success: boolean;
    totalProcessed: number;
    errors: BackfillError[];
    duration: number;
}

export class BackfillService {
    private client: Client;
    private githubService: GitHubSyncService;
    private activeJobs: Map<string, BackfillProgress> = new Map();

    constructor(client: Client) {
        this.client = client;
        this.githubService = GitHubSyncService.getInstance(client);
    }

    /**
     * 모든 모니터링 채널의 백필 실행
     */
    async backfillAllChannels(options: Partial<BackfillOptions> = {}): Promise<BackfillResult[]> {
        console.log('🔄 모든 채널 백필 시작...');
        
        const defaultOptions: BackfillOptions = {
            batchSize: 50,
            delay: 1000,
            syncToGitHub: true,
            syncToSupabase: true,
            updateScores: true,
            ...options
        };

        const results: BackfillResult[] = [];
        const guilds = this.client.guilds.cache.values();

        for (const guild of guilds) {
            const channels = guild.channels.cache.filter(channel => 
                channel.type === ChannelType.GuildForum
            );

            for (const [channelId, channel] of channels) {
                const forumConfig = await getForumConfig(channelId);
                if (forumConfig) {
                    console.log(`📋 포럼 채널 백필 시작: ${channel.name}`);
                    const result = await this.backfillChannel(channelId, defaultOptions);
                    results.push(result);
                }
            }
        }

        console.log(`✅ 전체 백필 완료: ${results.length}개 채널 처리`);
        return results;
    }

    /**
     * 특정 채널의 백필 실행
     */
    async backfillChannel(channelId: string, options: BackfillOptions): Promise<BackfillResult> {
        const jobId = `backfill-${channelId}-${Date.now()}`;
        const startTime = new Date();
        
        console.log(`🚀 채널 백필 시작: ${channelId} (Job ID: ${jobId})`);

        const progress: BackfillProgress = {
            jobId,
            status: 'pending',
            channelId,
            channelName: '',
            processed: 0,
            total: 0,
            errors: [],
            startTime
        };

        this.activeJobs.set(jobId, progress);

        try {
            const channel = await this.client.channels.fetch(channelId);
            if (!channel || channel.type !== ChannelType.GuildForum) {
                throw new Error(`채널을 찾을 수 없거나 포럼 채널이 아닙니다: ${channelId}`);
            }

            progress.channelName = channel.name;
            progress.status = 'running';

            const forumConfig = await getForumConfig(channelId);
            if (!forumConfig) {
                throw new Error(`포럼 설정을 찾을 수 없습니다: ${channelId}`);
            }

            // 활성 스레드 가져오기
            const activeThreads = await channel.threads.fetchActive();
            const archivedThreads = await channel.threads.fetchArchived();

            const allThreads = new Map([
                ...activeThreads.threads,
                ...archivedThreads.threads
            ]);

            progress.total = allThreads.size;
            console.log(`📊 총 ${allThreads.size}개의 스레드 발견`);

            // 스레드별로 백필 실행
            let processedCount = 0;
            for (const [threadId, thread] of allThreads) {
                try {
                    await this.backfillThread(thread, forumConfig, options);
                    processedCount++;
                    progress.processed = processedCount;

                    if (options.onProgress) {
                        options.onProgress(progress);
                    }

                    // 지연 시간 적용
                    if (options.delay > 0) {
                        await new Promise(resolve => setTimeout(resolve, options.delay));
                    }

                    if (processedCount % 10 === 0) {
                        console.log(`📈 진행률: ${processedCount}/${allThreads.size} (${Math.round(processedCount / allThreads.size * 100)}%)`);
                    }
                } catch (error) {
                    console.error(`❌ 스레드 백필 실패: ${threadId}`, error);
                    progress.errors.push({
                        messageId: threadId,
                        error: error instanceof Error ? error.message : String(error),
                        timestamp: new Date()
                    });
                }
            }

            progress.status = 'completed';
            progress.endTime = new Date();

            const result: BackfillResult = {
                jobId,
                success: true,
                totalProcessed: processedCount,
                errors: progress.errors,
                duration: progress.endTime.getTime() - startTime.getTime()
            };

            console.log(`✅ 채널 백필 완료: ${channel.name}`);
            console.log(`📊 처리된 스레드: ${processedCount}/${allThreads.size}`);
            console.log(`⏱️ 소요 시간: ${Math.round(result.duration / 1000)}초`);
            console.log(`❌ 오류: ${progress.errors.length}개`);

            return result;

        } catch (error) {
            console.error(`❌ 채널 백필 실패: ${channelId}`, error);
            
            progress.status = 'failed';
            progress.endTime = new Date();

            return {
                jobId,
                success: false,
                totalProcessed: progress.processed,
                errors: [{
                    messageId: channelId,
                    error: error instanceof Error ? error.message : String(error),
                    timestamp: new Date()
                }],
                duration: progress.endTime.getTime() - startTime.getTime()
            };
        } finally {
            this.activeJobs.delete(jobId);
        }
    }

    /**
     * 특정 스레드의 백필 실행
     */
    private async backfillThread(thread: ThreadChannel, forumConfig: any, options: BackfillOptions): Promise<void> {
        console.log(`🔄 스레드 백필 시작: ${thread.name} (${thread.id})`);

        // GitHub 이슈 확인 또는 생성
        if (options.syncToGitHub) {
            const issueNumber = await this.githubService.ensureIssueExists(
                thread.id,
                thread.name,
                forumConfig.name
            );

            if (!issueNumber) {
                console.log(`⚠️ GitHub 이슈를 찾거나 생성할 수 없습니다: ${thread.name}`);
            }
        }

        // 스레드의 모든 메시지 가져오기
        const messages = await this.fetchAllMessages(thread, options);
        console.log(`📝 스레드 메시지 수: ${messages.length}`);

        // 메시지를 배치로 나누어 처리
        const batches = this.chunkArray(messages, options.batchSize);
        
        for (const batch of batches) {
            await Promise.all(batch.map(message => this.processMessage(message, forumConfig, options)));
            
            // 배치 간 지연
            if (options.delay > 0) {
                await new Promise(resolve => setTimeout(resolve, options.delay));
            }
        }

        console.log(`✅ 스레드 백필 완료: ${thread.name}`);
    }

    /**
     * 스레드의 모든 메시지 가져오기
     */
    private async fetchAllMessages(thread: ThreadChannel, options: BackfillOptions): Promise<Message[]> {
        const messages: Message[] = [];
        let lastMessageId: string | undefined;

        while (true) {
            const fetchOptions: any = { limit: 100 };
            if (lastMessageId) {
                fetchOptions.before = lastMessageId;
            }

            const batch = await thread.messages.fetch(fetchOptions);
            if (batch.size === 0) break;

            const filteredMessages = batch.filter(message => {
                if (options.startDate && message.createdAt < options.startDate) return false;
                if (options.endDate && message.createdAt > options.endDate) return false;
                return true;
            });

            messages.push(...filteredMessages.values());
            lastMessageId = batch.last()?.id;

            // 더 이상 가져올 메시지가 없으면 종료
            if (batch.size < 100) break;
        }

        // 시간 순으로 정렬 (오래된 것부터)
        return messages.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    }

    /**
     * 개별 메시지 처리
     */
    private async processMessage(message: Message, forumConfig: any, options: BackfillOptions): Promise<void> {
        try {
            // 봇 메시지는 건너뛰기
            if (message.author.bot) return;

            // Supabase 동기화
            if (options.syncToSupabase) {
                await this.syncToSupabase(message, forumConfig);
            }

            // GitHub 동기화
            if (options.syncToGitHub) {
                await this.syncToGitHub(message, forumConfig);
            }

            // 사용자 점수 업데이트
            if (options.updateScores) {
                await this.updateUserScore(message, forumConfig);
            }

        } catch (error) {
            console.error(`❌ 메시지 처리 실패: ${message.id}`, error);
            throw error;
        }
    }

    /**
     * Supabase 동기화
     */
    private async syncToSupabase(message: Message, forumConfig: any): Promise<void> {
        const syncData = {
            message_id: message.id,
            author_id: message.author.id,
            author_name: message.author.username,
            content: message.content,
            timestamp: message.createdAt.toISOString(),
            channel_id: message.channel.id,
            guild_id: message.guild?.id || '',
            thread_id: message.channel.type === ChannelType.PublicThread ? message.channel.id : null,
            attachments: message.attachments.map(att => att.url),
            embeds: message.embeds.map(embed => embed.toJSON()),
            reactions: message.reactions.cache.map(reaction => ({
                emoji: reaction.emoji.name,
                count: reaction.count
            }))
        };

        await SyncService.syncMessage(syncData);
    }

    /**
     * GitHub 동기화
     */
    private async syncToGitHub(message: Message, forumConfig: any): Promise<void> {
        // 첫 번째 메시지인 경우 (스레드 생성 메시지)
        if (message.type === 18 || message.id === message.channel.id) {
            // 이미 ensureIssueExists에서 처리됨
            return;
        }

        // 일반 메시지인 경우 댓글로 추가
        await this.githubService.addCommentForNewMessage(message, forumConfig.name);
    }

    /**
     * 사용자 점수 업데이트
     */
    private async updateUserScore(message: Message, forumConfig: any): Promise<void> {
        const pointsPerMessage = forumConfig.points_per_message || 10;
        
        const userData = {
            discord_id: message.author.id,
            username: message.author.username,
            score: pointsPerMessage,
            source: 'backfill',
            message_id: message.id,
            channel_id: message.channel.id,
            timestamp: message.createdAt.toISOString()
        };

        await UserService.createOrUpdateUserScore(userData);
    }

    /**
     * 배열을 청크로 나누기
     */
    private chunkArray<T>(array: T[], chunkSize: number): T[][] {
        const chunks: T[][] = [];
        for (let i = 0; i < array.length; i += chunkSize) {
            chunks.push(array.slice(i, i + chunkSize));
        }
        return chunks;
    }

    /**
     * 백필 진행 상황 조회
     */
    getBackfillProgress(jobId: string): BackfillProgress | undefined {
        return this.activeJobs.get(jobId);
    }

    /**
     * 모든 활성 백필 작업 조회
     */
    getAllActiveJobs(): BackfillProgress[] {
        return Array.from(this.activeJobs.values());
    }

    /**
     * 백필 작업 취소
     */
    cancelBackfill(jobId: string): boolean {
        const progress = this.activeJobs.get(jobId);
        if (progress && progress.status === 'running') {
            progress.status = 'failed';
            progress.endTime = new Date();
            this.activeJobs.delete(jobId);
            return true;
        }
        return false;
    }
}