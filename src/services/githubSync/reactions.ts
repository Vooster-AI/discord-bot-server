import axios from 'axios';
import { GitHubClient } from './client.js';
import { MappingManager } from './mapping.js';
import { IssueManager } from './issues.js';
import { IssueResolver } from './issueResolver.js';
import { GitHubReaction } from './types.js';

export class ReactionManager {
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

    public async handleReaction(
        messageId: string,
        threadId: string,
        emoji: string,
        userId: string,
        userName: string,
        added: boolean,
        threadName?: string
    ): Promise<boolean> {
        console.log(`🔍 [GITHUB DEBUG] handleReaction 호출: emoji=${emoji}, user=${userName}, added=${added}`);

        try {
            let issueNumber: number | undefined;
            
            if (threadName) {
                issueNumber = await this.issueResolver.resolveIssueNumberWithName(threadId, threadName);
            } else {
                issueNumber = this.mappingManager.getIssueNumber(threadId);
            }

            console.log(`🔍 [GITHUB DEBUG] 스레드 ${threadId}의 이슈 번호: ${issueNumber}`);

            if (!issueNumber) {
                console.log(`❌ [GITHUB DEBUG] 이슈 번호를 찾을 수 없음. 스레드 ID: ${threadId}, 이름: ${threadName || 'N/A'}`);
                return false;
            }

            const githubReaction = this.mapDiscordEmojiToGitHub(emoji);
            console.log(`🔍 [GITHUB DEBUG] 이모지 매핑: ${emoji} -> ${githubReaction}`);

            if (!githubReaction) {
                console.log(`⚠️ [GITHUB DEBUG] 지원되지 않는 이모지: ${emoji}`);
                return false;
            }

            const commentId = this.mappingManager.getCommentId(messageId);
            let targetUrl: string;
            let targetType: string;

            this.mappingManager.logCommentMappingDebug(messageId);

            if (commentId) {
                targetUrl = `${this.client.getBaseUrl()}/repos/${this.client.getRepository()}/issues/comments/${commentId}/reactions`;
                targetType = `댓글 #${commentId}`;
                console.log(`🎯 [GITHUB DEBUG] 댓글 반응 대상: 메시지 ${messageId} -> 댓글 ${commentId}`);
            } else {
                targetUrl = `${this.client.getBaseUrl()}/repos/${this.client.getRepository()}/issues/${issueNumber}/reactions`;
                targetType = `이슈 #${issueNumber}`;
                console.log(`🎯 [GITHUB DEBUG] 이슈 반응 대상: 첫 번째 메시지 -> 이슈 ${issueNumber}`);
                console.log(`⚠️ [GITHUB DEBUG] 댓글 매핑이 없는 이유: 첫 번째 메시지이거나 매핑이 손실됨`);
            }

            if (added) {
                await this.addReaction(targetUrl, targetType, githubReaction);
            } else {
                await this.removeReaction(issueNumber, githubReaction);
            }

            console.log(`✅ [GITHUB DEBUG] handleReaction 성공적으로 완료`);
            return true;

        } catch (error: any) {
            console.error('❌ [GITHUB DEBUG] GitHub 반응 동기화 중 오류:', error.response?.data || error.message);
            return false;
        }
    }

    private async addReaction(targetUrl: string, targetType: string, githubReaction: string): Promise<void> {
        console.log(`🔍 [GITHUB DEBUG] GitHub 반응 추가 시도: ${githubReaction} to ${targetType}`);
        
        const addResponse = await axios.post(
            targetUrl,
            { content: githubReaction },
            { headers: this.client.getReactionHeaders() }
        );
        
        console.log(`✅ [GITHUB DEBUG] GitHub 반응 추가 완료: ${githubReaction} to ${targetType}, 응답:`, addResponse.status);
    }

    private async removeReaction(issueNumber: number, githubReaction: string): Promise<void> {
        console.log(`🔍 [GITHUB DEBUG] GitHub 반응 제거 시도: ${githubReaction} from issue #${issueNumber}`);

        try {
            const reactionsResponse = await axios.get<GitHubReaction[]>(
                `${this.client.getBaseUrl()}/repos/${this.client.getRepository()}/issues/${issueNumber}/reactions`,
                { headers: this.client.getReactionHeaders() }
            );

            console.log(`🔍 [GITHUB DEBUG] 기존 반응 개수: ${reactionsResponse.data.length}`);

            const currentUser = await this.client.getCurrentUser();
            console.log(`🔍 [GITHUB DEBUG] 현재 사용자: ${currentUser}`);

            const userReaction = reactionsResponse.data.find(
                (reaction) => reaction.content === githubReaction && reaction.user.login === currentUser
            );

            if (userReaction) {
                console.log(`🔍 [GITHUB DEBUG] 제거할 반응 찾음: ID ${userReaction.id}`);
                
                await axios.delete(
                    `${this.client.getBaseUrl()}/repos/${this.client.getRepository()}/issues/${issueNumber}/reactions/${userReaction.id}`,
                    { headers: this.client.getReactionHeaders() }
                );
                
                console.log(`✅ [GITHUB DEBUG] GitHub 반응 제거 완료: ${githubReaction}`);
            } else {
                console.log(`ℹ️ [GITHUB DEBUG] 제거할 반응을 찾을 수 없습니다: ${githubReaction} by ${currentUser}`);
            }

        } catch (removeError: any) {
            console.error('❌ [GITHUB DEBUG] GitHub 반응 제거 중 오류:', removeError.response?.data || removeError.message);
        }
    }

    private mapDiscordEmojiToGitHub(discordEmoji: string): string | null {
        const emojiMap: Record<string, string> = {
            '👍': '+1',
            '👎': '-1',
            '😄': 'laugh',
            '🎉': 'hooray',
            '😕': 'confused',
            '❤️': 'heart',
            '🚀': 'rocket',
            '👀': 'eyes',
            '😂': 'laugh',
            '😍': 'heart',
            '🔥': 'rocket',
            '💯': 'hooray',
            '😭': 'confused',
            '👏': 'hooray',
            '✅': '+1',
            '❌': '-1',
            '💖': 'heart',
            '💜': 'heart',
            '💙': 'heart',
            '💚': 'heart',
            '💛': 'heart',
            '🧡': 'heart'
        };

        return emojiMap[discordEmoji] || null;
    }
}