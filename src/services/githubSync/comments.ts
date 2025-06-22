import axios from 'axios';
import { GitHubClient } from './client.js';
import { MappingManager } from './mapping.js';
import { IssueManager } from './issues.js';
import { IssueResolver } from './issueResolver.js';
import { GitHubComment } from './types.js';
import { Message, ThreadChannel } from 'discord.js';

export class CommentManager {
    private client: GitHubClient;
    private mappingManager: MappingManager;
    private issueManager: IssueManager;
    private issueResolver: IssueResolver;

    constructor(client: GitHubClient, mappingManager: MappingManager, issueManager: IssueManager) {
        this.client = client;
        this.mappingManager = mappingManager;
        this.issueManager = issueManager;
        this.issueResolver = new IssueResolver(mappingManager, undefined, issueManager);
    }

    public async addCommentForNewMessage(message: Message, forumChannelName: string): Promise<string | null> {
        try {
            if (!message.guild || !message.channel) {
                console.log('❌ 서버 또는 채널 정보가 없습니다.');
                return null;
            }

            const thread = message.channel as ThreadChannel;
            const issueNumber = await this.issueResolver.resolveIssueNumberWithName(thread.id, thread.name || 'Untitled Thread');

            if (!issueNumber) {
                console.log(`❌ 스레드 "${thread.name || 'Untitled Thread'}"에 해당하는 GitHub 이슈를 찾을 수 없습니다.`);
                return null;
            }

            const messageLink = `https://discord.com/channels/${message.guild.id}/${thread.id}/${message.id}`;
            const commentBody = `**${message.author.displayName || message.author.username}**
${message.content}

---
**Discord Forum:** ${forumChannelName}
**Source:** ${messageLink}
* This issue is automatically synchronized with a corresponding thread in Discord.*`;

            const response = await axios.post<GitHubComment>(
                `${this.client.getBaseUrl()}/repos/${this.client.getRepository()}/issues/${issueNumber}/comments`,
                { body: commentBody },
                { headers: this.client.getHeaders() }
            );

            const comment = response.data;
            this.mappingManager.setCommentMapping(message.id, comment.id);

            console.log(`✅ GitHub 댓글 추가 완료: ${comment.html_url}`);
            return comment.html_url;

        } catch (error: any) {
            console.error('❌ GitHub 댓글 추가 중 오류:', error.response?.data || error.message);
            return null;
        }
    }

    public async deleteCommentForMessage(messageId: string): Promise<boolean> {
        try {
            const commentId = this.mappingManager.getCommentId(messageId);
            if (!commentId) {
                console.log(`⚠️ 메시지 ${messageId}에 해당하는 GitHub 댓글을 찾을 수 없습니다.`);
                return false;
            }

            console.log(`🐙 [GITHUB DEBUG] 댓글 삭제 시도: 댓글 ID ${commentId}`);

            const response = await axios.delete(
                `${this.client.getBaseUrl()}/repos/${this.client.getRepository()}/issues/comments/${commentId}`,
                { headers: this.client.getHeaders() }
            );

            if (response.status === 204) {
                this.mappingManager.deleteCommentMapping(messageId);
                console.log(`✅ [GITHUB DEBUG] 댓글 삭제 성공 및 매핑 제거: 메시지 ${messageId} -> 댓글 ${commentId}`);
                return true;
            } else {
                console.error(`❌ [GITHUB DEBUG] 댓글 삭제 실패: HTTP ${response.status}`);
                return false;
            }

        } catch (error: any) {
            if (error.response?.status === 404) {
                this.mappingManager.deleteCommentMapping(messageId);
                console.log(`⚠️ [GITHUB DEBUG] 댓글이 이미 삭제됨: 매핑 제거 ${messageId}`);
                return true;
            }

            console.error('❌ [GITHUB DEBUG] 댓글 삭제 중 오류:', error.response?.data || error.message);
            return false;
        }
    }
}