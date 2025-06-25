import { Message } from 'discord.js';
import { UserService } from './UserService.js';
import { getDiscordFullName } from '../../shared/utils/discordHelpers.js';

export interface ForumChannelConfig {
    id: string;
    name: string;
    table: string;
    score: number;
    github_sync?: boolean;
}

/**
 * Service responsible for handling user scoring operations
 */
export class ScoreService {
    // No longer needs serverUrl as we use direct UserService calls
    constructor(serverUrl?: string) {
        // Legacy parameter for backward compatibility
    }

    /**
     * Save user score using UserService directly (unified approach)
     */
    async saveUserScore(message: Message, forumChannelConfig: ForumChannelConfig): Promise<boolean> {
        try {
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
            return true;
        } catch (error) {
            console.error('❌ 사용자 점수 저장 중 오류:', error);
            return false;
        }
    }

    /**
     * @deprecated Use saveUserScore instead - both methods now do the same thing
     */
    async saveUserScoreDirect(message: Message, forumChannelConfig: ForumChannelConfig): Promise<boolean> {
        // Delegate to the unified saveUserScore method
        return this.saveUserScore(message, forumChannelConfig);
    }
}