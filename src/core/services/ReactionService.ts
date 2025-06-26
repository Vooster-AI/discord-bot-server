import { Client, MessageReaction, User, PartialMessageReaction, PartialUser, ChannelType } from 'discord.js';
import { GitHubSyncService } from '../../services/github/index.js';
import { getDiscordFullName } from '../../shared/utils/discordHelpers.js';
import { ForumChannelConfig, ForumConfig } from '../../shared/types/common.js';

/**
 * Service responsible for handling Discord reactions and GitHub sync
 */
export class ReactionService {
    private forumChannelIds: string[];
    private config: ForumConfig;
    private githubService: GitHubSyncService;

    constructor(forumChannelIds: string[], config: ForumConfig, githubService: GitHubSyncService) {
        this.forumChannelIds = forumChannelIds;
        this.config = config;
        this.githubService = githubService;
    }

    /**
     * Handle reaction addition
     */
    async handleReactionAdd(reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser): Promise<void> {
        console.log(`🔍 [DEBUG] 반응 추가 이벤트 감지: ${reaction.emoji.name || reaction.emoji} by ${user.username}`);
        
        if (user.bot) {
            console.log(`🤖 [DEBUG] 봇 사용자 반응 무시: ${user.username}`);
            return;
        }

        try {
            // Partial 메시지 처리
            let message = reaction.message;
            if (message.partial) {
                try {
                    message = await message.fetch();
                    console.log(`📥 [DEBUG] Partial 메시지 fetch 완료`);
                } catch (fetchError) {
                    console.error('❌ [DEBUG] Partial 메시지 fetch 실패:', fetchError);
                    return;
                }
            }
            
            console.log(`📋 [DEBUG] 메시지 채널 타입: ${message.channel.type}, 스레드 여부: ${message.channel.type === ChannelType.PublicThread}`);
            
            if (message.channel.type === ChannelType.PublicThread && message.channel.parent) {
                const parentChannel = message.channel.parent;
                console.log(`📋 [DEBUG] 부모 채널: ${parentChannel.name} (${parentChannel.id})`);
                
                if (this.forumChannelIds.includes(parentChannel.id)) {
                    const forumChannelConfig = this.config.monitoring.forumChannels.find(ch => ch.id === parentChannel.id);
                    console.log(`📋 [DEBUG] 포럼 채널 설정 찾음: ${forumChannelConfig?.name || 'Unknown'}`);
                    
                    if (forumChannelConfig) {
                        const timestamp = new Date().toLocaleString('ko-KR');
                        const emoji = reaction.emoji.name || reaction.emoji.toString();
                        const threadName = message.channel.name;
                        const authorName = getDiscordFullName(user as any);
                        
                        console.log(`\n👍 [${timestamp}] 포럼 반응 추가 감지!`);
                        console.log(`📋 포럼: ${forumChannelConfig.name} (${parentChannel.id})`);
                        console.log(`📝 포스트: ${threadName}`);
                        console.log(`👤 사용자: ${authorName} (${user.id})`);
                        console.log(`😀 반응: ${emoji} (${reaction.emoji.identifier || reaction.emoji.id || reaction.emoji.name})`);
                        console.log(`🆔 메시지 ID: ${message.id}`);
                        
                        // GitHub 반응 동기화
                        if (this.config.github?.enabled && forumChannelConfig.github_sync) {
                            console.log(`🐙 GitHub 반응 동기화 시도...`);
                            
                            const result = await this.githubService.handleReaction(
                                message.id,
                                message.channel.id,
                                emoji,
                                user.id,
                                authorName,
                                true,
                                threadName
                            );
                            
                            if (result) {
                                console.log(`✅ GitHub 반응 추가 성공`);
                            } else {
                                console.log(`❌ GitHub 반응 추가 실패`);
                            }
                        } else {
                            console.log(`⚠️ GitHub 반응 동기화 건너뜀 - 조건 불충족`);
                        }
                    }
                } else {
                    console.log(`📋 [DEBUG] 모니터링 대상 포럼 채널이 아님: ${parentChannel.id}`);
                }
            } else {
                console.log(`📋 [DEBUG] 포럼 스레드가 아니거나 부모 채널 없음`);
            }
        } catch (error) {
            console.error('❌ 반응 추가 처리 중 오류:', error);
        }
    }

    /**
     * Handle reaction removal
     */
    async handleReactionRemove(reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser): Promise<void> {
        console.log(`🔍 [DEBUG] 반응 제거 이벤트 감지: ${reaction.emoji.name || reaction.emoji} by ${user.username}`);
        
        if (user.bot) {
            console.log(`🤖 [DEBUG] 봇 사용자 반응 무시: ${user.username}`);
            return;
        }

        try {
            // Partial 메시지 처리
            let message = reaction.message;
            if (message.partial) {
                try {
                    message = await message.fetch();
                    console.log(`📥 [DEBUG] Partial 메시지 fetch 완료`);
                } catch (fetchError) {
                    console.error('❌ [DEBUG] Partial 메시지 fetch 실패:', fetchError);
                    return;
                }
            }
            
            if (message.channel.type === ChannelType.PublicThread && message.channel.parent) {
                const parentChannel = message.channel.parent;
                
                if (this.forumChannelIds.includes(parentChannel.id)) {
                    const forumChannelConfig = this.config.monitoring.forumChannels.find(ch => ch.id === parentChannel.id);
                    
                    if (forumChannelConfig) {
                        const timestamp = new Date().toLocaleString('ko-KR');
                        const emoji = reaction.emoji.name || reaction.emoji.toString();
                        const threadName = message.channel.name;
                        const authorName = getDiscordFullName(user as any);
                        
                        console.log(`\n👎 [${timestamp}] 포럼 반응 제거 감지!`);
                        console.log(`📋 포럼: ${forumChannelConfig.name} (${parentChannel.id})`);
                        console.log(`📝 포스트: ${threadName}`);
                        console.log(`👤 사용자: ${authorName} (${user.id})`);
                        console.log(`😑 반응: ${emoji}`);
                        console.log(`🆔 메시지 ID: ${message.id}`);
                        
                        // GitHub 반응 제거 동기화
                        if (this.config.github?.enabled && forumChannelConfig.github_sync) {
                            console.log(`🐙 GitHub 반응 제거 동기화 시도...`);
                            
                            const result = await this.githubService.handleReaction(
                                message.id,
                                message.channel.id,
                                emoji,
                                user.id,
                                authorName,
                                false,
                                threadName
                            );
                            
                            if (result) {
                                console.log(`✅ GitHub 반응 제거 성공`);
                            } else {
                                console.log(`❌ GitHub 반응 제거 실패`);
                            }
                        } else {
                            console.log(`⚠️ GitHub 반응 동기화 건너뜀 - 조건 불충족`);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('❌ 반응 제거 처리 중 오류:', error);
        }
    }
}