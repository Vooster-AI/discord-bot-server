// Common types for webhook synchronization
export interface WebhookConfig {
    readonly enabled: boolean;
    readonly secret?: string;
}

export interface GitHubWebhookPayload {
    readonly action: string;
    readonly repository: {
        readonly id: number;
        readonly name: string;
        readonly full_name: string;
        readonly html_url: string;
    };
    readonly sender: {
        readonly login: string;
        readonly id: number;
        readonly avatar_url: string;
        readonly html_url: string;
    };
    readonly issue?: GitHubIssue;
    readonly comment?: GitHubComment;
}

export interface GitHubIssue {
    readonly id: number;
    readonly number: number;
    readonly title: string;
    readonly body: string;
    readonly state: 'open' | 'closed';
    readonly html_url: string;
    readonly labels: GitHubLabel[];
    readonly created_at: string;
    readonly updated_at: string;
}

export interface GitHubComment {
    readonly id: number;
    readonly body: string;
    readonly html_url: string;
    readonly created_at: string;
    readonly updated_at: string;
}

export interface GitHubLabel {
    readonly id: number;
    readonly name: string;
    readonly color: string;
    readonly description?: string;
}

export interface IssueThreadMapping {
    readonly issueNumber: number;
    readonly threadId: string;
    readonly createdAt: string;
}

export interface WebhookMappingData {
    readonly issueToThreadMap: Record<string, string>;
    readonly lastUpdated: string;
}

export interface MappingStats {
    readonly total: number;
    readonly entries: [number, string][];
}

export type SupportedWebhookEvent = 'issues' | 'issue_comment' | 'ping';
export type SupportedIssueAction = 'closed' | 'reopened' | 'labeled' | 'unlabeled';
export type SupportedCommentAction = 'created' | 'edited' | 'deleted';