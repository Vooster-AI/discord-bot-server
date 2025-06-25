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
    private commentManager?: any; // CommentManager는 나중에 주입됨

    constructor(client: GitHubClient, mappingManager: MappingManager, discordClient?: Client) {
        this.client = client;
        this.mappingManager = mappingManager;
        this.discordClient = discordClient;
        this.issueResolver = new IssueResolver(mappingManager, discordClient, this);
    }

    public setCommentManager(commentManager: any): void {
        this.commentManager = commentManager;
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

*This issue is automatically synchronized with a corresponding thread in Discord.*
*Source: ${postLink}*`;

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
            
            // 기존 메시지들을 모두 댓글로 추가
            if (this.commentManager) {
                await this.addExistingMessagesAsComments(thread, issue.number, message.id, forumChannelName);
            }
            
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

            const body: any = { state: 'closed' };
            if (reason) {
                // 종료 사유를 댓글로 추가
                await axios.post(
                    `${this.client.getBaseUrl()}/repos/${this.client.getRepository()}/issues/${issueNumber}/comments`,
                    { body: `🔒 **포스트 종료됨**\n\n${reason}` },
                    { headers: this.client.getHeaders() }
                );
            }

            await axios.patch(
                `${this.client.getBaseUrl()}/repos/${this.client.getRepository()}/issues/${issueNumber}`,
                body,
                { headers: this.client.getHeaders() }
            );

            console.log(`✅ GitHub 이슈 종료 완료: #${issueNumber}`);
            return true;

        } catch (error: any) {
            console.error('❌ GitHub 이슈 종료 중 오류:', error.response?.data || error.message);
            return false;
        }
    }

    public async reopenIssueForReopenedPost(threadId: string, reason?: string): Promise<boolean> {
        try {
            const issueNumber = await this.issueResolver.resolveIssueNumber(threadId);
            if (!issueNumber) {
                console.log(`⚠️ 스레드 ${threadId}에 연관된 GitHub 이슈를 찾을 수 없음`);
                return false;
            }

            const body: any = { state: 'open' };
            if (reason) {
                // 재개 사유를 댓글로 추가
                await axios.post(
                    `${this.client.getBaseUrl()}/repos/${this.client.getRepository()}/issues/${issueNumber}/comments`,
                    { body: `🔓 **포스트 재개됨**\n\n${reason}` },
                    { headers: this.client.getHeaders() }
                );
            }

            await axios.patch(
                `${this.client.getBaseUrl()}/repos/${this.client.getRepository()}/issues/${issueNumber}`,
                body,
                { headers: this.client.getHeaders() }
            );

            console.log(`✅ GitHub 이슈 재개 완료: #${issueNumber}`);
            return true;

        } catch (error: any) {
            console.error('❌ GitHub 이슈 재개 중 오류:', error.response?.data || error.message);
            return false;
        }
    }

    public async findExistingIssue(threadId: string, threadTitle: string): Promise<number | null> {
        try {
            console.log(`🔍 [GITHUB DEBUG] 이슈 검색 시작:`);
            console.log(`🔍 [GITHUB DEBUG] - 스레드 ID: ${threadId}`);
            console.log(`🔍 [GITHUB DEBUG] - 스레드 제목: "${threadTitle}"`);
            console.log(`🔍 [GITHUB DEBUG] - 리포지토리: ${this.client.getRepository()}`);
            
            // First try to find by exact title match
            let searchQuery = `repo:${this.client.getRepository()} is:issue in:title "${threadTitle}"`;
            console.log(`🔍 [GITHUB DEBUG] 정확한 제목 검색: ${searchQuery}`);
            
            let response = await axios.get(
                `${this.client.getBaseUrl()}/search/issues?q=${encodeURIComponent(searchQuery)}`,
                { headers: this.client.getHeaders() }
            );
            
            let issues = response.data.items;
            console.log(`🔍 [GITHUB DEBUG] 제목 검색 결과: ${issues.length}개 이슈 발견`);
            
            let exactMatch = issues.find((issue: GitHubIssue) => issue.title === threadTitle);
            
            if (exactMatch) {
                const issueNumber = exactMatch.number;
                this.mappingManager.setIssueMapping(threadId, issueNumber);
                console.log(`✅ 정확한 제목으로 GitHub 이슈 찾음: #${issueNumber} - "${threadTitle}"`);
                return issueNumber;
            } else if (issues.length > 0) {
                console.log(`🔍 [GITHUB DEBUG] 정확한 매치 없음. 발견된 이슈들:`);
                issues.forEach((issue: GitHubIssue) => {
                    console.log(`🔍 [GITHUB DEBUG] - #${issue.number}: "${issue.title}"`);
                });
            }

            // Try to find by thread ID in body
            console.log(`🔍 [GITHUB DEBUG] 스레드 ID로 검색 시작...`);
            searchQuery = `repo:${this.client.getRepository()} is:issue label:discord-forum`;
            console.log(`🔍 [GITHUB DEBUG] Discord 포럼 라벨 검색: ${searchQuery}`);
            
            response = await axios.get(
                `${this.client.getBaseUrl()}/search/issues?q=${encodeURIComponent(searchQuery)}`,
                { headers: this.client.getHeaders() }
            );
            
            issues = response.data.items;
            console.log(`🔍 [GITHUB DEBUG] Discord 포럼 이슈: ${issues.length}개 발견`);
            
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
            console.log(`🔍 [GITHUB DEBUG] 부분 제목 매치 시도...`);
            const partialMatch = issues.find((issue: GitHubIssue) =>
                issue.title.includes(threadTitle) || threadTitle.includes(issue.title)
            );
            
            if (partialMatch) {
                const issueNumber = partialMatch.number;
                this.mappingManager.setIssueMapping(threadId, issueNumber);
                console.log(`✅ 부분 매치로 GitHub 이슈 찾음: #${issueNumber} - "${partialMatch.title}"`);
                return issueNumber;
            }

            console.log(`❌ [GITHUB DEBUG] GitHub에서 "${threadTitle}" 이슈를 찾을 수 없음`);
            console.log(`🔍 [GITHUB DEBUG] 검색된 모든 Discord 포럼 이슈:`);
            issues.forEach((issue: GitHubIssue) => {
                console.log(`🔍 [GITHUB DEBUG] - #${issue.number}: "${issue.title}"`);
            });
            return null;

        } catch (error: any) {
            console.error('❌ GitHub 이슈 검색 중 오류:', error.response?.data || error.message);
            return null;
        }
    }

    private async addExistingMessagesAsComments(thread: ThreadChannel, issueNumber: number, firstMessageId: string, forumChannelName: string): Promise<void> {
        try {
            console.log(`📝 기존 메시지들을 GitHub 이슈 #${issueNumber}에 댓글로 추가 시작...`);
            
            // 스레드의 모든 메시지 가져오기 (최대 100개)
            const messages = await thread.messages.fetch({ limit: 100 });
            
            // 메시지를 시간 순으로 정렬 (오래된 것부터)
            const sortedMessages = Array.from(messages.values())
                .filter(msg => !msg.author.bot && msg.id !== firstMessageId) // 봇 메시지와 첫 번째 메시지 제외
                .sort((a, b) => a.createdTimestamp - b.createdTimestamp);
            
            console.log(`📝 추가할 메시지 수: ${sortedMessages.length}개`);
            
            if (sortedMessages.length === 0) {
                console.log(`⚠️ 추가할 기존 메시지가 없습니다.`);
                return;
            }
            
            // CommentManager를 사용하여 각 메시지를 댓글로 추가
            for (const msg of sortedMessages) {
                try {
                    console.log(`📝 메시지 댓글 추가 중: ${msg.author.username}`);
                    
                    // CommentManager의 댓글 추가 기능 사용
                    await this.commentManager.addCommentToExistingIssue(msg, issueNumber, forumChannelName);
                    
                    // API 호출 간격 조절 (GitHub API rate limit 방지)
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                } catch (commentError: any) {
                    console.error(`❌ 메시지 댓글 추가 실패 (${msg.id}):`, commentError.response?.data || commentError.message);
                }
            }
            
            console.log(`✅ 기존 메시지 댓글 추가 완료: ${sortedMessages.length}개 처리됨`);
            
        } catch (error: any) {
            console.error('❌ 기존 메시지 댓글 추가 중 오류:', error.response?.data || error.message);
        }
    }
}