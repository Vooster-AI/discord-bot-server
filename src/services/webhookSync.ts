import { Client, TextChannel, ThreadChannel, ChannelType, EmbedBuilder } from 'discord.js';

interface GitHubWebhookPayload {
    action: string;
    issue?: {
        number: number;
        title: string;
        body: string;
        html_url: string;
        user: {
            login: string;
            avatar_url: string;
        };
        state: 'open' | 'closed';
        labels: Array<{ name: string; color: string }>;
    };
    comment?: {
        id: number;
        body: string;
        html_url: string;
        user: {
            login: string;
            avatar_url: string;
        };
    };
    repository: {
        name: string;
        full_name: string;
        html_url: string;
    };
    sender: {
        login: string;
        avatar_url: string;
    };
}

interface ForumChannelConfig {
    id: string;
    name: string;
    table: string;
    score: number;
}

interface WebhookConfig {
    monitoring: {
        forumChannels: ForumChannelConfig[];
    };
}

export class WebhookSyncService {
    private client: Client;
    private config: WebhookConfig;
    private issueToThreadMap: Map<number, string> = new Map(); // GitHub issue number -> Discord thread ID

    constructor(client: Client, config: WebhookConfig) {
        this.client = client;
        this.config = config;
    }

    public setIssueThreadMapping(issueNumber: number, threadId: string) {
        this.issueToThreadMap.set(issueNumber, threadId);
        console.log(`📝 [WEBHOOK] 이슈-스레드 매핑 저장: 이슈 #${issueNumber} -> 스레드 ${threadId}`);
    }

    public async handleGitHubWebhook(event: string, payload: GitHubWebhookPayload): Promise<boolean> {
        try {
            console.log(`🔄 [WEBHOOK] GitHub 이벤트 처리 시작: ${event} - ${payload.action}`);

            switch (event) {
                case 'issues':
                    return await this.handleIssueEvent(payload);
                case 'issue_comment':
                    return await this.handleCommentEvent(payload);
                case 'ping':
                    console.log(`🏓 [WEBHOOK] GitHub Ping 수신`);
                    return true;
                default:
                    console.log(`⚠️ [WEBHOOK] 지원되지 않는 이벤트: ${event}`);
                    return false;
            }
        } catch (error) {
            console.error('❌ [WEBHOOK] GitHub 웹훅 처리 중 오류:', error);
            return false;
        }
    }

    private async handleIssueEvent(payload: GitHubWebhookPayload): Promise<boolean> {
        if (!payload.issue) return false;

        const { action, issue, repository, sender } = payload;
        console.log(`📋 [WEBHOOK] 이슈 이벤트: ${action} - #${issue.number} "${issue.title}"`);

        // Discord forum labels가 있는 이슈만 처리
        const isDiscordForumIssue = issue.labels.some(label => label.name === 'discord-forum');
        if (!isDiscordForumIssue) {
            console.log(`⚠️ [WEBHOOK] Discord 포럼 이슈가 아님: #${issue.number}`);
            return false;
        }

        const threadId = this.issueToThreadMap.get(issue.number);
        if (!threadId) {
            console.log(`⚠️ [WEBHOOK] 이슈 #${issue.number}에 해당하는 Discord 스레드를 찾을 수 없음`);
            return false;
        }

        try {
            const channel = await this.client.channels.fetch(threadId) as ThreadChannel;
            if (!channel || channel.type !== ChannelType.PublicThread) {
                console.log(`❌ [WEBHOOK] 유효하지 않은 스레드: ${threadId}`);
                return false;
            }

            switch (action) {
                case 'closed':
                    await this.notifyIssueClosed(channel, issue, sender);
                    break;
                case 'reopened':
                    await this.notifyIssueReopened(channel, issue, sender);
                    break;
                case 'labeled':
                case 'unlabeled':
                    await this.notifyIssueLabeled(channel, issue, action, sender);
                    break;
                default:
                    console.log(`⚠️ [WEBHOOK] 처리되지 않는 이슈 액션: ${action}`);
                    return false;
            }

            return true;
        } catch (error) {
            console.error(`❌ [WEBHOOK] 이슈 이벤트 처리 실패:`, error);
            return false;
        }
    }

    private async handleCommentEvent(payload: GitHubWebhookPayload): Promise<boolean> {
        if (!payload.issue || !payload.comment) return false;

        const { action, issue, comment, repository, sender } = payload;
        console.log(`💬 [WEBHOOK] 댓글 이벤트: ${action} - 이슈 #${issue.number}`);

        // Discord forum 이슈만 처리
        const isDiscordForumIssue = issue.labels.some(label => label.name === 'discord-forum');
        if (!isDiscordForumIssue) {
            console.log(`⚠️ [WEBHOOK] Discord 포럼 이슈가 아님: #${issue.number}`);
            return false;
        }

        // Discord 봇이 생성한 댓글은 무시 (무한 루프 방지)
        if (comment.body.includes('This issue is automatically synchronized with a corresponding thread in Discord')) {
            console.log(`🤖 [WEBHOOK] Discord 봇 댓글 무시: ${comment.id}`);
            return false;
        }

        const threadId = this.issueToThreadMap.get(issue.number);
        if (!threadId) {
            console.log(`⚠️ [WEBHOOK] 이슈 #${issue.number}에 해당하는 Discord 스레드를 찾을 수 없음`);
            return false;
        }

        try {
            const channel = await this.client.channels.fetch(threadId) as ThreadChannel;
            if (!channel || channel.type !== ChannelType.PublicThread) {
                console.log(`❌ [WEBHOOK] 유효하지 않은 스레드: ${threadId}`);
                return false;
            }

            switch (action) {
                case 'created':
                    await this.notifyCommentCreated(channel, issue, comment, sender);
                    break;
                case 'edited':
                    await this.notifyCommentEdited(channel, issue, comment, sender);
                    break;
                case 'deleted':
                    await this.notifyCommentDeleted(channel, issue, comment, sender);
                    break;
                default:
                    console.log(`⚠️ [WEBHOOK] 처리되지 않는 댓글 액션: ${action}`);
                    return false;
            }

            return true;
        } catch (error) {
            console.error(`❌ [WEBHOOK] 댓글 이벤트 처리 실패:`, error);
            return false;
        }
    }

    private async notifyIssueClosed(channel: ThreadChannel, issue: any, sender: any) {
        const embed = new EmbedBuilder()
            .setTitle('🔒 GitHub 이슈가 닫혔습니다')
            .setDescription(`**${issue.title}**\n\n[GitHub에서 보기](${issue.html_url})`)
            .setColor(0xFF6B6B)
            .setAuthor({
                name: sender.login,
                iconURL: sender.avatar_url,
                url: `https://github.com/${sender.login}`
            })
            .setTimestamp()
            .setFooter({ text: `이슈 #${issue.number}` });

        await channel.send({ embeds: [embed] });
        console.log(`✅ [WEBHOOK] 이슈 종료 알림 전송: #${issue.number}`);
    }

    private async notifyIssueReopened(channel: ThreadChannel, issue: any, sender: any) {
        const embed = new EmbedBuilder()
            .setTitle('🔓 GitHub 이슈가 다시 열렸습니다')
            .setDescription(`**${issue.title}**\n\n[GitHub에서 보기](${issue.html_url})`)
            .setColor(0x4ECDC4)
            .setAuthor({
                name: sender.login,
                iconURL: sender.avatar_url,
                url: `https://github.com/${sender.login}`
            })
            .setTimestamp()
            .setFooter({ text: `이슈 #${issue.number}` });

        await channel.send({ embeds: [embed] });
        console.log(`✅ [WEBHOOK] 이슈 재오픈 알림 전송: #${issue.number}`);
    }

    private async notifyIssueLabeled(channel: ThreadChannel, issue: any, action: string, sender: any) {
        const actionText = action === 'labeled' ? '라벨이 추가됨' : '라벨이 제거됨';
        const color = action === 'labeled' ? 0x45B7D1 : 0xFFA07A;

        const embed = new EmbedBuilder()
            .setTitle(`🏷️ GitHub 이슈 ${actionText}`)
            .setDescription(`**${issue.title}**\n\n[GitHub에서 보기](${issue.html_url})`)
            .setColor(color)
            .setAuthor({
                name: sender.login,
                iconURL: sender.avatar_url,
                url: `https://github.com/${sender.login}`
            })
            .setTimestamp()
            .setFooter({ text: `이슈 #${issue.number}` });

        await channel.send({ embeds: [embed] });
        console.log(`✅ [WEBHOOK] 이슈 라벨 변경 알림 전송: #${issue.number}`);
    }

    private async notifyCommentCreated(channel: ThreadChannel, issue: any, comment: any, sender: any) {
        const maxLength = 1000;
        const commentBody = comment.body.length > maxLength 
            ? comment.body.substring(0, maxLength) + '...' 
            : comment.body;

        const embed = new EmbedBuilder()
            .setTitle('💬 새 GitHub 댓글')
            .setDescription(`**${issue.title}**\n\n${commentBody}\n\n[댓글 보기](${comment.html_url})`)
            .setColor(0x96CEB4)
            .setAuthor({
                name: sender.login,
                iconURL: sender.avatar_url,
                url: `https://github.com/${sender.login}`
            })
            .setTimestamp()
            .setFooter({ text: `이슈 #${issue.number}` });

        await channel.send({ embeds: [embed] });
        console.log(`✅ [WEBHOOK] 댓글 생성 알림 전송: 이슈 #${issue.number}, 댓글 #${comment.id}`);
    }

    private async notifyCommentEdited(channel: ThreadChannel, issue: any, comment: any, sender: any) {
        const maxLength = 1000;
        const commentBody = comment.body.length > maxLength 
            ? comment.body.substring(0, maxLength) + '...' 
            : comment.body;

        const embed = new EmbedBuilder()
            .setTitle('✏️ GitHub 댓글 수정됨')
            .setDescription(`**${issue.title}**\n\n${commentBody}\n\n[댓글 보기](${comment.html_url})`)
            .setColor(0xFFCE56)
            .setAuthor({
                name: sender.login,
                iconURL: sender.avatar_url,
                url: `https://github.com/${sender.login}`
            })
            .setTimestamp()
            .setFooter({ text: `이슈 #${issue.number}` });

        await channel.send({ embeds: [embed] });
        console.log(`✅ [WEBHOOK] 댓글 수정 알림 전송: 이슈 #${issue.number}, 댓글 #${comment.id}`);
    }

    private async notifyCommentDeleted(channel: ThreadChannel, issue: any, comment: any, sender: any) {
        const embed = new EmbedBuilder()
            .setTitle('🗑️ GitHub 댓글 삭제됨')
            .setDescription(`**${issue.title}**에서 댓글이 삭제되었습니다.\n\n[이슈 보기](${issue.html_url})`)
            .setColor(0xFF6B6B)
            .setAuthor({
                name: sender.login,
                iconURL: sender.avatar_url,
                url: `https://github.com/${sender.login}`
            })
            .setTimestamp()
            .setFooter({ text: `이슈 #${issue.number}` });

        await channel.send({ embeds: [embed] });
        console.log(`✅ [WEBHOOK] 댓글 삭제 알림 전송: 이슈 #${issue.number}, 댓글 #${comment.id}`);
    }
}