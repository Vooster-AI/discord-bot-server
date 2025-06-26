import { Message, PartialMessage } from 'discord.js';
import { GitHubSyncService } from '../github/index.js';
import { UserService } from '../../core/services/UserService.js';
import { getDiscordFullName } from '../../shared/utils/discordHelpers.js';

export interface MessageSyncOptions {
    enableScoring: boolean;
    enableGitHubSync: boolean;
    channelScore: number;
}

export class MessageSyncService {
    private githubService: GitHubSyncService;

    constructor() {
        this.githubService = GitHubSyncService.getInstance({
            enabled: true // MessageSync에서는 활성화 상태로 생성
        });
    }

    /**
     * Handle message deletion - reduce user score and sync to GitHub
     */
    public async handleMessageDelete(
        message: Message | PartialMessage, 
        options: MessageSyncOptions
    ): Promise<{ success: boolean; error?: string }> {
        try {
            console.log(`🗑️ Processing message deletion: ${message.id}`);

            let results = {
                scoreUpdated: false,
                githubSynced: false,
                error: null as string | null
            };

            // Handle score reduction if enabled
            if (options.enableScoring && options.channelScore !== 0) {
                const scoreResult = await this.reduceUserScore(message, options.channelScore);
                if (scoreResult.success) {
                    results.scoreUpdated = true;
                    console.log(`📉 User score reduced by ${options.channelScore} for deleted message`);
                } else {
                    console.error(`❌ Failed to reduce score: ${scoreResult.error}`);
                    results.error = scoreResult.error || 'Failed to reduce score';
                }
            }

            // Handle GitHub sync if enabled
            if (options.enableGitHubSync) {
                const githubResult = await this.githubService.deleteCommentForMessage(message.id);
                if (githubResult) {
                    results.githubSynced = true;
                    console.log(`🐙 GitHub comment/issue updated for deleted message`);
                } else {
                    console.error(`❌ Failed to sync to GitHub`);
                    if (!results.error) {
                        results.error = 'Failed to sync to GitHub';
                    }
                }
            }

            return { 
                success: results.scoreUpdated || results.githubSynced || (!options.enableScoring && !options.enableGitHubSync),
                error: results.error || undefined
            };
        } catch (error) {
            console.error('❌ Error handling message deletion:', error);
            return { success: false, error: (error as Error).message };
        }
    }

    /**
     * Reduce user score when message is deleted
     */
    private async reduceUserScore(
        message: Message | PartialMessage, 
        scoreReduction: number
    ): Promise<{ success: boolean; error?: string }> {
        try {
            if (!message.author?.id) {
                return { success: false, error: 'Cannot determine message author' };
            }

            const discordId = message.author.id.toString();
            const username = getDiscordFullName(message.author);

            // Generate message link for logging
            const messageLink = message.guild && message.channel?.id && message.id 
                ? `https://discord.com/channels/${message.guild.id}/${message.channel.id}/${message.id}`
                : undefined;

            // Use UserService to reduce score
            await UserService.reduceScoreFromUser(
                discordId, 
                scoreReduction, 
                'message_deleted', 
                messageLink
            );

            console.log(`📉 User score reduced: ${username} (-${scoreReduction})`);
            return { success: true };
        } catch (error) {
            console.error('❌ Error reducing user score:', error);
            return { success: false, error: (error as Error).message };
        }
    }

    /**
     * Get GitHub sync service for external access
     */
    public getGitHubService(): GitHubSyncService {
        return this.githubService;
    }
}