import { EmbedBuilder, type BaseGuildTextChannel, type NewsChannel, type TextChannel, type ThreadChannel } from 'discord.js';
import type { GitHubIssue, GitHubComment } from './types.js';

type SendableChannel = TextChannel | NewsChannel | ThreadChannel;

interface GitHubUser {
    readonly login: string;
    readonly avatar_url: string;
    readonly html_url?: string;
}

export class NotificationManager {
    async notifyIssueClosed(channel: SendableChannel, issue: GitHubIssue, sender: GitHubUser): Promise<void> {
        const embed = new EmbedBuilder()
            .setTitle('🔒 GitHub 이슈가 닫혔습니다')
            .setDescription(`**${issue.title}**\n\n[GitHub에서 보기](${issue.html_url})`)
            .setColor(0xFF6B6B)
            .setAuthor({
                name: sender.login,
                iconURL: sender.avatar_url,
                url: sender.html_url ? `https://github.com/${sender.login}` : undefined
            })
            .setTimestamp()
            .setFooter({ text: `이슈 #${issue.number}` });

        await channel.send({ embeds: [embed] });
        await this.addClosedReactionToFirstMessage(channel);
        console.log(`✅ [WEBHOOK] 이슈 종료 알림 전송: #${issue.number}`);
    }

    async notifyIssueReopened(channel: SendableChannel, issue: GitHubIssue, sender: GitHubUser): Promise<void> {
        const embed = new EmbedBuilder()
            .setTitle('🔓 GitHub 이슈가 다시 열렸습니다')
            .setDescription(`**${issue.title}**\n\n[GitHub에서 보기](${issue.html_url})`)
            .setColor(0x4ECDC4)
            .setAuthor({
                name: sender.login,
                iconURL: sender.avatar_url,
                url: sender.html_url ? `https://github.com/${sender.login}` : undefined
            })
            .setTimestamp()
            .setFooter({ text: `이슈 #${issue.number}` });

        await channel.send({ embeds: [embed] });
        console.log(`✅ [WEBHOOK] 이슈 재오픈 알림 전송: #${issue.number}`);
    }

    async notifyIssueLabeled(channel: SendableChannel, issue: GitHubIssue, action: 'labeled' | 'unlabeled', sender: GitHubUser): Promise<void> {
        const actionText = action === 'labeled' ? '라벨이 추가됨' : '라벨이 제거됨';
        const color = action === 'labeled' ? 0x45B7D1 : 0xFFA07A;
        
        const embed = new EmbedBuilder()
            .setTitle(`🏷️ GitHub 이슈 ${actionText}`)
            .setDescription(`**${issue.title}**\n\n[GitHub에서 보기](${issue.html_url})`)
            .setColor(color)
            .setAuthor({
                name: sender.login,
                iconURL: sender.avatar_url,
                url: sender.html_url ? `https://github.com/${sender.login}` : undefined
            })
            .setTimestamp()
            .setFooter({ text: `이슈 #${issue.number}` });

        await channel.send({ embeds: [embed] });
        console.log(`✅ [WEBHOOK] 이슈 라벨 변경 알림 전송: #${issue.number}`);
    }

    async notifyCommentCreated(channel: SendableChannel, issue: GitHubIssue, comment: GitHubComment, sender: GitHubUser): Promise<void> {
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
                url: sender.html_url ? `https://github.com/${sender.login}` : undefined
            })
            .setTimestamp()
            .setFooter({ text: `이슈 #${issue.number}` });

        await channel.send({ embeds: [embed] });
        console.log(`✅ [WEBHOOK] 댓글 생성 알림 전송: 이슈 #${issue.number}, 댓글 #${comment.id}`);
    }

    async notifyCommentEdited(channel: SendableChannel, issue: GitHubIssue, comment: GitHubComment, sender: GitHubUser): Promise<void> {
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
                url: sender.html_url ? `https://github.com/${sender.login}` : undefined
            })
            .setTimestamp()
            .setFooter({ text: `이슈 #${issue.number}` });

        await channel.send({ embeds: [embed] });
        console.log(`✅ [WEBHOOK] 댓글 수정 알림 전송: 이슈 #${issue.number}, 댓글 #${comment.id}`);
    }

    async notifyCommentDeleted(channel: SendableChannel, issue: GitHubIssue, comment: GitHubComment, sender: GitHubUser): Promise<void> {
        const embed = new EmbedBuilder()
            .setTitle('🗑️ GitHub 댓글 삭제됨')
            .setDescription(`**${issue.title}**에서 댓글이 삭제되었습니다.\n\n[이슈 보기](${issue.html_url})`)
            .setColor(0xFF6B6B)
            .setAuthor({
                name: sender.login,
                iconURL: sender.avatar_url,
                url: sender.html_url ? `https://github.com/${sender.login}` : undefined
            })
            .setTimestamp()
            .setFooter({ text: `이슈 #${issue.number}` });

        await channel.send({ embeds: [embed] });
        console.log(`✅ [WEBHOOK] 댓글 삭제 알림 전송: 이슈 #${issue.number}, 댓글 #${comment.id}`);
    }

    private async addClosedReactionToFirstMessage(channel: SendableChannel): Promise<void> {
        try {
            console.log(`✅ [WEBHOOK] 포스트 종료 - 첫 메시지에 완료 반응 추가 시도: ${channel.id}`);
            
            const messages = await channel.messages.fetch({ limit: 1 });
            const firstMessage = messages.first();
            
            if (firstMessage) {
                await firstMessage.react('✅');
                console.log(`✅ [WEBHOOK] 첫 메시지에 완료 반응 추가 성공: ${firstMessage.id}`);
            } else {
                console.log(`❌ [WEBHOOK] 첫 메시지를 찾을 수 없어서 반응을 추가할 수 없음`);
            }
        } catch (error) {
            console.error(`❌ [WEBHOOK] 첫 메시지에 반응 추가 실패:`, error);
        }
    }
}