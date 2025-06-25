export interface GitHubConfig {
    enabled: boolean;
}

export interface GitHubIssue {
    number: number;
    title: string;
    body: string;
    state: 'open' | 'closed';
    html_url: string;
}

export interface GitHubComment {
    id: number;
    body: string;
    html_url: string;
}

export interface GitHubReaction {
    id: number;
    content: string;
    user: {
        login: string;
    };
}