import type { DiscordMessage, ForumPostData, ForumMessageData } from './types.js';

export class DataTransformer {
    static transformForumPost(message: DiscordMessage, githubUrl?: string): ForumPostData {
        const baseData = {
            post_name: message.channel.name || `thread_${message.channel.id}`,
            content: message.content,
            created_at: message.createdAt.toISOString(),
            details: {
                authorName: message.author.displayName || message.author.username,
                authorId: message.author.id,
                postId: message.channel.id,
                messageId: message.id,
                links: {
                    post: `https://discord.com/channels/${message.guild.id}/${message.channel.id}`,
                    message: `https://discord.com/channels/${message.guild.id}/${message.channel.id}/${message.id}`
                }
            }
        };

        return githubUrl ? { ...baseData, github: githubUrl } : baseData;
    }

    static transformForumMessage(message: DiscordMessage, postTitle: string, githubUrl?: string): ForumMessageData {
        const baseData = {
            post_name: `${postTitle}_${message.id}`,
            content: message.content,
            created_at: message.createdAt.toISOString(),
            details: {
                authorName: message.author.displayName || message.author.username,
                authorId: message.author.id,
                postId: message.channel.id,
                messageId: message.id,
                links: {
                    post: `https://discord.com/channels/${message.guild.id}/${message.channel.id}`,
                    message: `https://discord.com/channels/${message.guild.id}/${message.channel.id}/${message.id}`
                }
            }
        };

        return githubUrl ? { ...baseData, github: githubUrl } : baseData;
    }
}