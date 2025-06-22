import type { Client } from 'discord.js';
import { WebhookMappingManager } from './mapping.js';
import { EventRouter } from './eventRouter.js';
import { IssueHandler } from './issueHandler.js';
import { CommentHandler } from './commentHandler.js';
import { NotificationManager } from './notifications.js';
import type { WebhookConfig, GitHubWebhookPayload, SupportedWebhookEvent } from './types.js';

export class WebhookSyncService {
    private readonly mappingManager: WebhookMappingManager;
    private readonly notificationManager: NotificationManager;
    private readonly issueHandler: IssueHandler;
    private readonly commentHandler: CommentHandler;

    constructor(
        private readonly client: Client,
        private readonly config: WebhookConfig
    ) {
        this.mappingManager = new WebhookMappingManager();
        this.notificationManager = new NotificationManager();
        this.issueHandler = new IssueHandler(client, this.mappingManager, this.notificationManager);
        this.commentHandler = new CommentHandler(client, this.mappingManager, this.notificationManager);
    }

    setIssueThreadMapping(issueNumber: number, threadId: string): void {
        this.mappingManager.setIssueThreadMapping(issueNumber, threadId);
    }

    async handleGitHubWebhook(event: string, payload: unknown): Promise<boolean> {
        try {
            console.log(`🔄 [WEBHOOK] GitHub 이벤트 처리 시작: ${event} - ${(payload as any)?.action}`);

            if (!EventRouter.validatePayload(payload)) {
                console.log(`❌ [WEBHOOK] 유효하지 않은 페이로드`);
                return false;
            }

            if (!EventRouter.isEventSupported(event)) {
                console.log(`⚠️ [WEBHOOK] 지원되지 않는 이벤트: ${event}`);
                return false;
            }

            return await this.routeEvent(event, payload);
        } catch (error) {
            console.error('❌ [WEBHOOK] GitHub 웹훅 처리 중 오류:', error);
            return false;
        }
    }

    private async routeEvent(event: SupportedWebhookEvent, payload: GitHubWebhookPayload): Promise<boolean> {
        switch (event) {
            case 'issues':
                return await this.issueHandler.handleIssueEvent(payload);
            case 'issue_comment':
                return await this.commentHandler.handleCommentEvent(payload);
            case 'ping':
                console.log(`🏓 [WEBHOOK] GitHub Ping 수신`);
                return true;
            default:
                console.log(`⚠️ [WEBHOOK] 처리되지 않는 이벤트: ${event}`);
                return false;
        }
    }

    getMappingManager(): WebhookMappingManager {
        return this.mappingManager;
    }

    getNotificationManager(): NotificationManager {
        return this.notificationManager;
    }

    getConfig(): WebhookConfig {
        return this.config;
    }
}

// Re-export all types and classes for external use
export * from './types.js';
export { WebhookMappingManager } from './mapping.js';
export { EventRouter } from './eventRouter.js';
export { IssueHandler } from './issueHandler.js';
export { CommentHandler } from './commentHandler.js';
export { NotificationManager } from './notifications.js';