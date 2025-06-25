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
    private serverUrl: string;

    constructor(serverUrl: string) {
        this.serverUrl = serverUrl;
    }

    /**
     * Save user score via API call
     */
    async saveUserScore(message: Message, forumChannelConfig: ForumChannelConfig): Promise<boolean> {
        try {
            const scoreData = {
                nickname: message.author.displayName || null,
                username: getDiscordFullName(message.author),
                discord_id: message.author.id,
                score: forumChannelConfig.score,
                scored_at: new Date().toISOString(),
                scored_by: {
                    channel: message.channel.id,
                    post_name: (message.channel as any).name || 'Unknown',
                    message_content: message.content.length > 500 ? message.content.substring(0, 500) + '...' : message.content,
                    message_link: `https://discord.com/channels/${message.guild?.id}/${message.channel.id}/${message.id}`
                }
            };

            const response = await fetch(`${this.serverUrl}/api/users/score`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(scoreData)
            });

            if (response.ok) {
                console.log(`✅ 사용자 점수 저장 성공: ${message.author.username} (+${forumChannelConfig.score}점)`);
                return true;
            } else {
                const errorText = await response.text();
                console.error(`❌ 사용자 점수 저장 실패:`, errorText);
                return false;
            }
        } catch (error) {
            console.error('❌ 사용자 점수 저장 중 오류:', error);
            return false;
        }
    }

    /**
     * Save user score directly using UserService (for internal operations)
     */
    async saveUserScoreDirect(message: Message, forumChannelConfig: ForumChannelConfig): Promise<boolean> {
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
            console.log(`✅ 사용자 점수 직접 저장 성공: ${message.author.username} (+${forumChannelConfig.score}점)`);
            return true;
        } catch (error) {
            console.error('❌ 사용자 점수 직접 저장 중 오류:', error);
            return false;
        }
    }
}