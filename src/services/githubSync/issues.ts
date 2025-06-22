import axios from 'axios';
import { GitHubClient } from './client.js';
import { MappingManager } from './mapping.js';
import { IssueResolver } from './issueResolver.js';
import { GitHubIssue } from './types.js';
import { Message, Client, ThreadChannel } from 'discord.js';

export class IssueManager {
    private client: GitHubClient;
    private mappingManager: MappingManager;
    private discordClient?: Client;
    private issueResolver: IssueResolver;

    constructor(client: GitHubClient, mappingManager: MappingManager, discordClient?: Client) {
        this.client = client;
        this.mappingManager = mappingManager;
        this.discordClient = discordClient;
        this.issueResolver = new IssueResolver(mappingManager, discordClient, this);
    }

    public async createIssueForNewPost(message: Message, forumChannelName: string): Promise<string | null> {
        try {
            if (!message.guild || !message.channel) {
                console.log('❌ 서버 또는 채널 정보가 없습니다.');
                return null;
            }

            const thread = message.channel as ThreadChannel;
            const postLink = `https://discord.com/channels/${message.guild.id}/${thread.id}`;
            const title = `${thread.name || 'Untitled Thread'}`;
            const body = `**${message.author.displayName || message.author.username}**
${message.content}

---
**Discord Forum:** ${forumChannelName}
**Source:** ${postLink}
**Thread ID:** ${thread.id}
*This issue is automatically synchronized with a corresponding thread in Discord.*`;

            const response = await axios.post<GitHubIssue>(
                `${this.client.getBaseUrl()}/repos/${this.client.getRepository()}/issues`,
                {
                    title,
                    body,
                    labels: ['discord-forum', 'new-post', forumChannelName.toLowerCase()]
                },
                { headers: this.client.getHeaders() }
            );

            const issue = response.data;
            this.mappingManager.setIssueMapping(thread.id, issue.number);

            console.log(`✅ GitHub 이슈 생성 완료: #${issue.number} - ${issue.html_url}`);
            return issue.html_url;

        } catch (error: any) {
            console.error('❌ GitHub 이슈 생성 중 오류:', error.response?.data || error.message);
            return null;
        }
    }

    public async closeIssueForClosedPost(threadId: string, reason?: string): Promise<boolean> {
        try {
            const issueNumber = await this.issueResolver.resolveIssueNumber(threadId);
            if (!issueNumber) {
                return false;
            }

            await axios.patch(
                `${this.client.getBaseUrl()}/repos/${this.client.getRepository()}/issues/${issueNumber}`,
                { state: 'closed' },
                { headers: this.client.getHeaders() }
            );

            this.mappingManager.deleteIssueMapping(threadId);
            console.log(`✅ GitHub 이슈 종료 완료: #${issueNumber}`);
            return true;

        } catch (error: any) {
            console.error('❌ GitHub 이슈 종료 중 오류:', error.response?.data || error.message);
            return false;
        }
    }

    public async findExistingIssue(threadId: string, threadTitle: string): Promise<number | null> {
        try {
            // First try to find by exact title match
            let searchQuery = `repo:${this.client.getRepository()} is:issue in:title "${threadTitle}"`;
            let response = await axios.get(
                `${this.client.getBaseUrl()}/search/issues?q=${encodeURIComponent(searchQuery)}`,
                { headers: this.client.getHeaders() }
            );
            
            let issues = response.data.items;
            let exactMatch = issues.find((issue: GitHubIssue) => issue.title === threadTitle);
            
            if (exactMatch) {
                const issueNumber = exactMatch.number;
                this.mappingManager.setIssueMapping(threadId, issueNumber);
                console.log(`✅ 정확한 제목으로 GitHub 이슈 찾음: #${issueNumber} - "${threadTitle}"`);
                return issueNumber;
            }

            // Try to find by thread ID in body
            searchQuery = `repo:${this.client.getRepository()} is:issue label:discord-forum`;
            response = await axios.get(
                `${this.client.getBaseUrl()}/search/issues?q=${encodeURIComponent(searchQuery)}`,
                { headers: this.client.getHeaders() }
            );
            
            issues = response.data.items;
            const issueWithThreadId = issues.find((issue: GitHubIssue) =>
                issue.body && issue.body.includes(threadId)
            );
            
            if (issueWithThreadId) {
                const issueNumber = issueWithThreadId.number;
                this.mappingManager.setIssueMapping(threadId, issueNumber);
                console.log(`✅ 스레드 ID로 GitHub 이슈 찾음: #${issueNumber} - "${issueWithThreadId.title}"`);
                return issueNumber;
            }

            // Try partial title match
            const partialMatch = issues.find((issue: GitHubIssue) =>
                issue.title.includes(threadTitle) || threadTitle.includes(issue.title)
            );
            
            if (partialMatch) {
                const issueNumber = partialMatch.number;
                this.mappingManager.setIssueMapping(threadId, issueNumber);
                console.log(`✅ 부분 매치로 GitHub 이슈 찾음: #${issueNumber} - "${partialMatch.title}"`);
                return issueNumber;
            }

            console.log(`🔍 GitHub에서 "${threadTitle}" 이슈를 찾을 수 없음`);
            return null;

        } catch (error: any) {
            console.error('❌ GitHub 이슈 검색 중 오류:', error.response?.data || error.message);
            return null;
        }
    }
}