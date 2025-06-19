import axios from 'axios';
export class SyncService {
    baseUrl;
    enabled;
    constructor(serverUrl = 'http://localhost:3000') {
        this.baseUrl = serverUrl;
        this.enabled = true;
    }
    setEnabled(enabled) {
        this.enabled = enabled;
    }
    async syncForumPost(message, tableName, isNewPost = true) {
        if (!this.enabled) {
            console.log('📤 동기화가 비활성화되어 있습니다.');
            return false;
        }
        try {
            if (!message.guild || !message.channel) {
                console.log('❌ 길드 또는 채널 정보가 없습니다.');
                return false;
            }
            // 포럼 포스트인지 확인
            if (message.channel.type !== 11) { // PublicThread
                console.log('❌ 포럼 스레드가 아닙니다.');
                return false;
            }
            const thread = message.channel;
            const parentChannel = thread.parent;
            if (!parentChannel || parentChannel.type !== 15) { // ForumChannel
                console.log('❌ 부모 채널이 포럼 채널이 아닙니다.');
                return false;
            }
            const postData = {
                post_name: thread.name,
                content: message.content,
                created_at: message.createdAt.toISOString(),
                detail: {
                    id: thread.id,
                    authorId: message.author.id,
                    authorName: message.author.displayName || message.author.username,
                    authorAvatar: message.author.displayAvatarURL(),
                    channelId: parentChannel.id,
                    guildId: message.guild.id,
                    guildName: message.guild.name,
                    channelName: parentChannel.name,
                    tags: thread.appliedTags || [],
                    messageId: message.id,
                    links: {
                        post: `https://discord.com/channels/${message.guild.id}/${thread.id}`,
                        message: `https://discord.com/channels/${message.guild.id}/${thread.id}/${message.id}`
                    }
                }
            };
            const response = await axios.post(`${this.baseUrl}/api/sync/supabase`, {
                table: tableName,
                data: postData
            });
            if (response.data.success) {
                console.log(`✅ ${tableName} 테이블에 포스트 동기화 완료: ${thread.name}`);
                return true;
            }
            else {
                console.log(`❌ ${tableName} 테이블 포스트 동기화 실패: ${response.data.error}`);
                return false;
            }
        }
        catch (error) {
            console.error('❌ 포스트 동기화 중 오류:', error);
            return false;
        }
    }
    async syncForumMessage(message, tableName, postTitle) {
        if (!this.enabled) {
            console.log('📤 동기화가 비활성화되어 있습니다.');
            return false;
        }
        try {
            if (!message.guild || !message.channel) {
                console.log('❌ 길드 또는 채널 정보가 없습니다.');
                return false;
            }
            const thread = message.channel;
            const parentChannel = thread.parent;
            if (!parentChannel) {
                console.log('❌ 부모 채널 정보가 없습니다.');
                return false;
            }
            const messageData = {
                post_name: postTitle,
                content: message.content,
                created_at: message.createdAt.toISOString(),
                detail: {
                    id: thread.id,
                    authorId: message.author.id,
                    authorName: message.author.displayName || message.author.username,
                    authorAvatar: message.author.displayAvatarURL(),
                    channelId: parentChannel.id,
                    guildId: message.guild.id,
                    guildName: message.guild.name,
                    channelName: parentChannel.name,
                    tags: thread.appliedTags || [],
                    messageId: message.id,
                    links: {
                        post: `https://discord.com/channels/${message.guild.id}/${thread.id}`,
                        message: `https://discord.com/channels/${message.guild.id}/${thread.id}/${message.id}`
                    }
                }
            };
            const response = await axios.post(`${this.baseUrl}/api/sync/supabase`, {
                table: tableName,
                data: messageData
            });
            if (response.data.success) {
                console.log(`✅ ${tableName} 테이블에 메시지 동기화 완료: ${message.author.username}`);
                return true;
            }
            else {
                console.log(`❌ ${tableName} 테이블 메시지 동기화 실패: ${response.data.error}`);
                return false;
            }
        }
        catch (error) {
            console.error('❌ 메시지 동기화 중 오류:', error);
            return false;
        }
    }
    async getStats() {
        try {
            const response = await axios.get(`${this.baseUrl}/api/stats`);
            return response.data;
        }
        catch (error) {
            console.error('❌ 통계 조회 중 오류:', error);
            return null;
        }
    }
    async healthCheck() {
        try {
            const response = await axios.get(`${this.baseUrl}/health`);
            return response.status === 200;
        }
        catch (error) {
            console.error('❌ 서버 상태 확인 실패:', error);
            return false;
        }
    }
    async testConnection() {
        console.log('🔍 Supabase 연결 테스트 중...');
        const isHealthy = await this.healthCheck();
        if (isHealthy) {
            console.log('✅ API 서버 연결 성공');
            const stats = await this.getStats();
            if (stats) {
                console.log('📊 현재 통계:');
                console.log(`  • 총 포스트: ${stats.totalPosts}개`);
                console.log(`  • 총 메시지: ${stats.totalMessages}개`);
                console.log(`  • 총 채널: ${stats.totalChannels}개`);
            }
        }
        else {
            console.log('❌ API 서버 연결 실패');
        }
    }
}
//# sourceMappingURL=SyncService.js.map