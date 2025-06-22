import type { DiscordMessage } from './types.js';

export class DataValidator {
    private static readonly FORUM_THREAD_TYPE = 11;
    private static readonly FORUM_CHANNEL_TYPE = 15;

    static validateMessage(message: DiscordMessage): boolean {
        if (!message.guild || !message.channel) {
            console.log('❌ 서버 또는 채널 정보가 없습니다.');
            return false;
        }
        
        return true;
    }

    static validateForumPost(message: DiscordMessage): boolean {
        if (!this.validateMessage(message)) {
            return false;
        }

        if (message.channel.type !== this.FORUM_THREAD_TYPE) {
            console.log('❌ 포럼 스레드가 아닙니다.');
            return false;
        }

        const parentChannel = message.channel.parent;
        if (!parentChannel || parentChannel.type !== this.FORUM_CHANNEL_TYPE) {
            console.log('❌ 부모 채널이 포럼 채널이 아닙니다.');
            return false;
        }

        return true;
    }

    static validateForumMessage(message: DiscordMessage): boolean {
        if (!this.validateMessage(message)) {
            return false;
        }

        const parentChannel = message.channel.parent;
        if (!parentChannel) {
            console.log('❌ 부모 채널 정보가 없습니다.');
            return false;
        }

        return true;
    }
}