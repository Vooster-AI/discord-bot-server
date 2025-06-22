import type { 
    GitHubWebhookPayload, 
    SupportedWebhookEvent, 
    SupportedIssueAction, 
    SupportedCommentAction 
} from './types.js';

export class EventRouter {
    private static readonly SUPPORTED_EVENTS: SupportedWebhookEvent[] = ['issues', 'issue_comment', 'ping'];
    private static readonly ISSUE_ACTIONS: SupportedIssueAction[] = ['closed', 'reopened', 'labeled', 'unlabeled'];
    private static readonly COMMENT_ACTIONS: SupportedCommentAction[] = ['created', 'edited', 'deleted'];

    static getSupportedEvents(): SupportedWebhookEvent[] {
        return [...this.SUPPORTED_EVENTS];
    }

    static isEventSupported(event: string): event is SupportedWebhookEvent {
        return this.SUPPORTED_EVENTS.includes(event as SupportedWebhookEvent);
    }

    static validatePayload(payload: unknown): payload is GitHubWebhookPayload {
        if (!payload || typeof payload !== 'object') {
            return false;
        }
        
        const p = payload as Record<string, unknown>;
        
        if (!p.action || typeof p.action !== 'string') {
            return false;
        }
        
        if (!p.repository || typeof p.repository !== 'object') {
            return false;
        }
        
        return true;
    }

    static isDiscordForumIssue(payload: GitHubWebhookPayload): boolean {
        if (!payload.issue) {
            return false;
        }
        
        return payload.issue.labels.some(label => label.name === 'discord-forum');
    }

    static isDiscordBotComment(payload: GitHubWebhookPayload): boolean {
        if (!payload.comment) {
            return false;
        }
        
        return payload.comment.body.includes('This issue is automatically synchronized with a corresponding thread in Discord');
    }

    static getIssueActions(): SupportedIssueAction[] {
        return [...this.ISSUE_ACTIONS];
    }

    static getCommentActions(): SupportedCommentAction[] {
        return [...this.COMMENT_ACTIONS];
    }

    static isActionSupported(event: SupportedWebhookEvent, action: string): boolean {
        switch (event) {
            case 'issues':
                return this.ISSUE_ACTIONS.includes(action as SupportedIssueAction);
            case 'issue_comment':
                return this.COMMENT_ACTIONS.includes(action as SupportedCommentAction);
            case 'ping':
                return true;
            default:
                return false;
        }
    }
}