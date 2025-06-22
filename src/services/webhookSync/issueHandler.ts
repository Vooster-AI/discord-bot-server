import { ChannelType, type Client, type PublicThreadChannel } from 'discord.js';
import { EventRouter } from './eventRouter.js';
import type { WebhookMappingManager } from './mapping.js';
import type { NotificationManager } from './notifications.js';
import type { GitHubWebhookPayload, GitHubIssue, SupportedIssueAction } from './types.js';

interface GitHubUser {
    readonly login: string;
    readonly avatar_url: string;
    readonly html_url?: string;
}

export class IssueHandler {
    constructor(
        private readonly client: Client,
        private readonly mappingManager: WebhookMappingManager,
        private readonly notificationManager: NotificationManager
    ) {}

    async handleIssueEvent(payload: GitHubWebhookPayload): Promise<boolean> {
        if (!payload.issue) return false;

        const { action, issue, repository, sender } = payload;
        console.log(`📋 [WEBHOOK] 이슈 이벤트: ${action} - #${issue.number} "${issue.title}"`);

        if (!EventRouter.isDiscordForumIssue(payload)) {
            console.log(`⚠️ [WEBHOOK] Discord 포럼 이슈가 아님: #${issue.number}`);
            return false;
        }

        if (!EventRouter.isActionSupported('issues', action)) {
            console.log(`⚠️ [WEBHOOK] 처리되지 않는 이슈 액션: ${action}`);
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

            return await this.processIssueAction(action as SupportedIssueAction, channel, issue, sender);
        } catch (error) {
            console.error(`❌ [WEBHOOK] 이슈 이벤트 처리 실패:`, error);
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

    private async processIssueAction(
        action: SupportedIssueAction,
        channel: PublicThreadChannel,
        issue: GitHubIssue,
        sender: GitHubUser
    ): Promise<boolean> {
        switch (action) {
            case 'closed':
                await this.notificationManager.notifyIssueClosed(channel, issue, sender);
                break;
            case 'reopened':
                await this.notificationManager.notifyIssueReopened(channel, issue, sender);
                break;
            case 'labeled':
            case 'unlabeled':
                await this.notificationManager.notifyIssueLabeled(channel, issue, action, sender);
                break;
            default:
                return false;
        }

        return true;
    }
}