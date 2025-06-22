import { ChannelType, type Client, type PublicThreadChannel } from 'discord.js';
import { EventRouter } from './eventRouter.js';
import type { WebhookMappingManager } from './mapping.js';
import type { NotificationManager } from './notifications.js';
import type { GitHubWebhookPayload, GitHubIssue, GitHubComment, SupportedCommentAction } from './types.js';

interface GitHubUser {
    readonly login: string;
    readonly avatar_url: string;
    readonly html_url?: string;
}

export class CommentHandler {
    constructor(
        private readonly client: Client,
        private readonly mappingManager: WebhookMappingManager,
        private readonly notificationManager: NotificationManager
    ) {}

    async handleCommentEvent(payload: GitHubWebhookPayload): Promise<boolean> {
        if (!payload.issue || !payload.comment) return false;

        const { action, issue, comment, repository, sender } = payload;
        console.log(`💬 [WEBHOOK] 댓글 이벤트: ${action} - 이슈 #${issue.number}`);

        if (!EventRouter.isDiscordForumIssue(payload)) {
            console.log(`⚠️ [WEBHOOK] Discord 포럼 이슈가 아님: #${issue.number}`);
            return false;
        }

        if (EventRouter.isDiscordBotComment(payload)) {
            console.log(`🤖 [WEBHOOK] Discord 봇 댓글 무시: ${comment.id}`);
            return false;
        }

        if (!EventRouter.isActionSupported('issue_comment', action)) {
            console.log(`⚠️ [WEBHOOK] 처리되지 않는 댓글 액션: ${action}`);
            return false;
        }

        const threadId = this.mappingManager.getThreadId(issue.number);
        if (!threadId) {
            console.log(`⚠️ [WEBHOOK] 이슈 #${issue.number}에 해당하는 Discord 스레드를 찾을 수 없음`);
            return false;
        }

        try {
            const channel = await this.getValidThread(threadId);
            if (!channel) {
                return false;
            }

            return await this.processCommentAction(action as SupportedCommentAction, channel, issue, comment, sender);
        } catch (error) {
            console.error(`❌ [WEBHOOK] 댓글 이벤트 처리 실패:`, error);
            return false;
        }
    }

    private async getValidThread(threadId: string): Promise<PublicThreadChannel | null> {
        try {
            const channel = await this.client.channels.fetch(threadId);
            
            if (!channel || channel.type !== ChannelType.PublicThread) {
                console.log(`❌ [WEBHOOK] 유효하지 않은 스레드: ${threadId}`);
                return null;
            }

            return channel;
        } catch (error) {
            console.error(`❌ [WEBHOOK] 스레드 가져오기 실패: ${threadId}`, error);
            return null;
        }
    }

    private async processCommentAction(
        action: SupportedCommentAction,
        channel: PublicThreadChannel,
        issue: GitHubIssue,
        comment: GitHubComment,
        sender: GitHubUser
    ): Promise<boolean> {
        switch (action) {
            case 'created':
                await this.notificationManager.notifyCommentCreated(channel, issue, comment, sender);
                break;
            case 'edited':
                await this.notificationManager.notifyCommentEdited(channel, issue, comment, sender);
                break;
            case 'deleted':
                await this.notificationManager.notifyCommentDeleted(channel, issue, comment, sender);
                break;
            default:
                return false;
        }

        return true;
    }
}