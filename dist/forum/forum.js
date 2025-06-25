import { ChannelType } from 'discord.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SyncService } from '../services/supabaseSync/index.js';
import { GitHubSyncService } from '../services/github/index.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export class ForumMonitor {
    client;
    config = null;
    forumChannelIds;
    syncService;
    githubService;
    constructor(client) {
        this.client = client;
        this.loadConfig();
        this.forumChannelIds = this.config.monitoring.forumChannels.map(channel => channel.id);
        this.syncService = new SyncService(this.config.supabase?.serverUrl || 'http://localhost:3000');
        this.githubService = new GitHubSyncService({
            enabled: this.config.github?.enabled || false
        });
        this.setupEventListeners();
        console.log('\n🔧 포럼 모니터링 시스템 초기화 완료');
        console.log(`📊 모니터링 상태: ${this.config.monitoring.enabled ? '활성화' : '비활성화'}`);
        console.log(`📋 모니터링 채널 수: ${this.config.monitoring.forumChannels.length}개`);
        this.config.monitoring.forumChannels.forEach((channel, index) => {
            console.log(`  ${index + 1}. ${channel.name} (${channel.id})`);
        });
        console.log(`⚙️  설정: 메시지 최대 길이 ${this.config.settings.maxMessageLength}자, 체크 지연 ${this.config.settings.checkDelay}ms`);
        const supabaseStatus = this.config.supabase?.enabled ? '활성화' : '비활성화';
        console.log(`💾 Supabase 동기화: ${supabaseStatus}`);
        if (this.config.supabase?.enabled) {
            console.log(`🔗 서버 URL: ${this.config.supabase.serverUrl}`);
            this.syncService.setEnabled(true);
            this.syncService.testConnection();
        }
        else {
            this.syncService.setEnabled(false);
        }
        const githubStatus = this.config.github?.enabled ? '활성화' : '비활성화';
        console.log(`🐙 GitHub 동기화: ${githubStatus}`);
        if (this.config.github?.enabled) {
            console.log(`📁 저장소: ${process.env.GITHUB_REPOSITORY || '설정되지 않음'}`);
            this.githubService.setEnabled(true);
            this.githubService.testConnection();
        }
        else {
            this.githubService.setEnabled(false);
        }
    }
    setWebhookCallback(callback) {
        this.githubService.setWebhookCallback(callback);
        console.log('👂 포럼 활동 모니터링 시작...\n');
    }
    loadConfig() {
        try {
            const configPath = path.join(__dirname, './forum-config.json');
            const configFile = fs.readFileSync(configPath, 'utf8');
            this.config = JSON.parse(configFile);
        }
        catch (error) {
            console.error('Error loading forum config:', error);
            // 기본 설정으로 fallback
            this.config = {
                monitoring: {
                    enabled: true,
                    forumChannels: []
                },
                settings: {
                    maxMessageLength: 1000,
                    checkDelay: 1000
                },
                supabase: {
                    enabled: false,
                    serverUrl: 'http://localhost:3000'
                }
            };
        }
    }
    setupEventListeners() {
        this.client.on('messageCreate', async (message) => {
            await this.handleMessage(message);
        });
        this.client.on('threadCreate', async (thread) => {
            await this.handleThreadCreate(thread);
        });
        this.client.on('messageReactionAdd', async (reaction, user) => {
            await this.handleReactionAdd(reaction, user);
        });
        this.client.on('messageReactionRemove', async (reaction, user) => {
            await this.handleReactionRemove(reaction, user);
        });
        this.client.on('threadUpdate', async (oldThread, newThread) => {
            await this.handleThreadUpdate(oldThread, newThread);
        });
        this.client.on('messageDelete', async (message) => {
            await this.handleMessageDelete(message);
        });
    }
    async handleMessage(message) {
        // DM이나 봇 메시지는 무시
        if (!message.guild || message.author.bot)
            return;
        // 포럼 채널의 스레드에서 온 메시지인지 확인
        if (message.channel.type === ChannelType.PublicThread && message.channel.parent) {
            const parentChannel = message.channel.parent;
            // 부모 채널이 모니터링 대상 포럼 채널인지 확인
            if (this.forumChannelIds.includes(parentChannel.id)) {
                const forumChannelConfig = this.config.monitoring.forumChannels.find(ch => ch.id === parentChannel.id);
                const timestamp = new Date().toLocaleString('ko-KR');
                console.log(`\n🔔 [${timestamp}] 포럼 메시지 감지!`);
                console.log(`📋 포럼: ${forumChannelConfig?.name || parentChannel.name} (${parentChannel.id})`);
                console.log(`📝 포스트: ${message.channel.name}`);
                console.log(`👤 작성자: ${message.author.displayName || message.author.username} (${message.author.id})`);
                console.log(`💬 내용: ${message.content.length > 100 ? message.content.substring(0, 100) + '...' : message.content}`);
                console.log(`🔗 링크: https://discord.com/channels/${message.guild.id}/${message.channel.id}/${message.id}`);
                // GitHub 동기화 (새 메시지를 댓글로 추가)
                let githubUrl = null;
                if (this.config.github?.enabled && forumChannelConfig) {
                    console.log(`🐙 GitHub 이슈에 댓글 추가 시도...`);
                    githubUrl = await this.githubService.addCommentForNewMessage(message, forumChannelConfig.name);
                    if (githubUrl) {
                        console.log(`✅ GitHub 댓글 추가 성공: ${githubUrl}`);
                    }
                    else {
                        console.log(`❌ GitHub 댓글 추가 실패`);
                    }
                }
                // Supabase 동기화
                if (this.config.supabase?.enabled && forumChannelConfig) {
                    console.log(`💾 ${forumChannelConfig.table} 테이블에 Supabase 동기화 시도...`);
                    const syncSuccess = await this.syncService.syncForumMessage(message, forumChannelConfig.table, message.channel.name, githubUrl || undefined);
                    if (syncSuccess) {
                        console.log(`✅ ${forumChannelConfig.table} 테이블 Supabase 동기화 성공`);
                    }
                    else {
                        console.log(`❌ ${forumChannelConfig.table} 테이블 Supabase 동기화 실패`);
                    }
                }
                // 유저 점수 저장
                if (this.config.supabase?.enabled && forumChannelConfig && typeof forumChannelConfig.score === 'number') {
                    console.log(`🏆 사용자 점수 저장 시도... (점수: ${forumChannelConfig.score})`);
                    await this.saveUserScore(message, forumChannelConfig);
                }
                this.logAlert(message);
            }
        }
    }
    async handleThreadCreate(thread) {
        // 새로운 포럼 포스트(스레드) 생성 감지
        if (thread.parent && this.forumChannelIds.includes(thread.parent.id)) {
            const forumChannelConfig = this.config.monitoring.forumChannels.find(ch => ch.id === thread.parent.id);
            const timestamp = new Date().toLocaleString('ko-KR');
            console.log(`\n🆕 [${timestamp}] 새 포럼 포스트 생성!`);
            console.log(`📋 포럼: ${forumChannelConfig?.name || thread.parent.name} (${thread.parent.id})`);
            console.log(`📝 포스트 제목: ${thread.name}`);
            console.log(`🔗 포스트 링크: https://discord.com/channels/${thread.guild.id}/${thread.id}`);
            console.log(`⏳ ${this.config.settings.checkDelay}ms 후 첫 메시지 확인...`);
            // 잠시 대기 후 첫 번째 메시지 가져오기
            setTimeout(async () => {
                try {
                    const messages = await thread.messages.fetch({ limit: 1 });
                    const firstMessage = messages.first();
                    if (firstMessage) {
                        console.log(`✅ 첫 메시지 발견 - 작성자: ${firstMessage.author.displayName || firstMessage.author.username}`);
                        // GitHub 동기화 (새 이슈 생성)
                        let githubUrl = null;
                        if (this.config.github?.enabled && forumChannelConfig) {
                            console.log(`🐙 GitHub 이슈 생성 시도...`);
                            githubUrl = await this.githubService.createIssueForNewPost(firstMessage, forumChannelConfig.name);
                            if (githubUrl) {
                                console.log(`✅ GitHub 이슈 생성 성공: ${githubUrl}`);
                            }
                            else {
                                console.log(`❌ GitHub 이슈 생성 실패`);
                            }
                        }
                        // Supabase 동기화 (새 포스트)
                        if (this.config.supabase?.enabled && forumChannelConfig) {
                            console.log(`💾 ${forumChannelConfig.table} 테이블에 새 포스트 Supabase 동기화 시도...`);
                            const syncSuccess = await this.syncService.syncForumPost(firstMessage, forumChannelConfig.table, true, githubUrl || undefined);
                            if (syncSuccess) {
                                console.log(`✅ ${forumChannelConfig.table} 테이블 새 포스트 Supabase 동기화 성공`);
                            }
                            else {
                                console.log(`❌ ${forumChannelConfig.table} 테이블 새 포스트 Supabase 동기화 실패`);
                            }
                        }
                        this.logAlert(firstMessage, true);
                    }
                    else {
                        console.log(`❌ 첫 메시지를 찾을 수 없음`);
                    }
                }
                catch (error) {
                    console.error('❌ Error fetching thread messages:', error);
                }
            }, this.config.settings.checkDelay);
        }
    }
    logAlert(message, isNewPost = false) {
        // 모니터링이 비활성화되어 있으면 return
        if (!this.config.monitoring.enabled)
            return;
        // 포럼 채널 정보
        const forumChannel = message.channel.type === ChannelType.PublicThread ? message.channel.parent : null;
        if (!forumChannel)
            return;
        // 설정에서 포럼 채널 정보 가져오기
        const forumChannelConfig = this.config.monitoring.forumChannels.find(ch => ch.id === forumChannel.id);
        if (!forumChannelConfig)
            return;
        const timestamp = new Date().toLocaleString('ko-KR');
        const postLink = `https://discord.com/channels/${message.guild?.id}/${message.channel.id}`;
        const messageLink = `https://discord.com/channels/${message.guild?.id}/${message.channel.id}/${message.id}`;
        const threadName = message.channel.type === ChannelType.PublicThread ? message.channel.name : 'Unknown';
        const content = message.content.length > this.config.settings.maxMessageLength
            ? message.content.substring(0, this.config.settings.maxMessageLength) + '...'
            : message.content;
        console.log(`\n📊 [${timestamp}] ${isNewPost ? '새 포스트' : '새 메시지'} 로그`);
        console.log(`📋 포럼: ${forumChannelConfig.name} (${forumChannel.id})`);
        console.log(`📝 포스트: ${threadName}`);
        console.log(`👤 작성자: ${message.author.displayName || message.author.username} (${message.author.id})`);
        console.log(`💬 내용: ${content}`);
        console.log(`🔗 포스트: ${postLink}`);
        console.log(`🔗 메시지: ${messageLink}`);
        console.log(`🏢 서버: ${message.guild?.name}`);
        console.log(`✅ 로그 완료\n`);
    }
    async handleReactionAdd(reaction, user) {
        console.log(`🔍 [DEBUG] 반응 추가 이벤트 감지: ${reaction.emoji.name || reaction.emoji} by ${user.username}`);
        if (user.bot) {
            console.log(`🤖 [DEBUG] 봇 사용자 반응 무시: ${user.username}`);
            return;
        }
        try {
            // Partial 메시지 처리
            let message = reaction.message;
            if (message.partial) {
                try {
                    message = await message.fetch();
                    console.log(`📥 [DEBUG] Partial 메시지 fetch 완료`);
                }
                catch (fetchError) {
                    console.error('❌ [DEBUG] Partial 메시지 fetch 실패:', fetchError);
                    return;
                }
            }
            console.log(`📋 [DEBUG] 메시지 채널 타입: ${message.channel.type}, 스레드 여부: ${message.channel.type === ChannelType.PublicThread}`);
            if (message.channel.type === ChannelType.PublicThread && message.channel.parent) {
                const parentChannel = message.channel.parent;
                console.log(`📂 [DEBUG] 부모 채널: ${parentChannel.name} (${parentChannel.id})`);
                console.log(`🎯 [DEBUG] 모니터링 채널 포함 여부: ${this.forumChannelIds.includes(parentChannel.id)}`);
                if (this.forumChannelIds.includes(parentChannel.id)) {
                    const forumChannelConfig = this.config.monitoring.forumChannels.find(ch => ch.id === parentChannel.id);
                    console.log(`⚙️ [DEBUG] 포럼 설정 찾음: ${forumChannelConfig?.name}`);
                    console.log(`🐙 [DEBUG] GitHub 활성화: ${this.config.github?.enabled}`);
                    if (this.config.github?.enabled && forumChannelConfig) {
                        const emoji = reaction.emoji.name || reaction.emoji.toString();
                        console.log(`😀 [DEBUG] GitHub 반응 동기화 시도: ${emoji}`);
                        const result = await this.githubService.handleReaction(message.id, message.channel.id, emoji, user.id, user.displayName || user.username, true, message.channel.name // 스레드 이름 추가
                        );
                        console.log(`✅ [DEBUG] GitHub 반응 결과: ${result}`);
                    }
                }
            }
        }
        catch (error) {
            console.error('❌ 반응 추가 처리 중 오류:', error);
        }
    }
    async handleReactionRemove(reaction, user) {
        console.log(`🔍 [DEBUG] 반응 제거 이벤트 감지: ${reaction.emoji.name || reaction.emoji} by ${user.username}`);
        if (user.bot) {
            console.log(`🤖 [DEBUG] 봇 사용자 반응 무시: ${user.username}`);
            return;
        }
        try {
            // Partial 메시지 처리
            let message = reaction.message;
            if (message.partial) {
                try {
                    message = await message.fetch();
                    console.log(`📥 [DEBUG] Partial 메시지 fetch 완료`);
                }
                catch (fetchError) {
                    console.error('❌ [DEBUG] Partial 메시지 fetch 실패:', fetchError);
                    return;
                }
            }
            console.log(`📋 [DEBUG] 메시지 채널 타입: ${message.channel.type}, 스레드 여부: ${message.channel.type === ChannelType.PublicThread}`);
            if (message.channel.type === ChannelType.PublicThread && message.channel.parent) {
                const parentChannel = message.channel.parent;
                console.log(`📂 [DEBUG] 부모 채널: ${parentChannel.name} (${parentChannel.id})`);
                if (this.forumChannelIds.includes(parentChannel.id)) {
                    const forumChannelConfig = this.config.monitoring.forumChannels.find(ch => ch.id === parentChannel.id);
                    console.log(`⚙️ [DEBUG] 포럼 설정 찾음: ${forumChannelConfig?.name}`);
                    if (this.config.github?.enabled && forumChannelConfig) {
                        const emoji = reaction.emoji.name || reaction.emoji.toString();
                        console.log(`😀 [DEBUG] GitHub 반응 제거 동기화 시도: ${emoji}`);
                        const result = await this.githubService.handleReaction(message.id, message.channel.id, emoji, user.id, user.displayName || user.username, false, message.channel.name // 스레드 이름 추가
                        );
                        console.log(`✅ [DEBUG] GitHub 반응 제거 결과: ${result}`);
                    }
                }
            }
        }
        catch (error) {
            console.error('❌ 반응 제거 처리 중 오류:', error);
        }
    }
    async handleThreadUpdate(oldThread, newThread) {
        try {
            if (newThread.parent && this.forumChannelIds.includes(newThread.parent.id)) {
                // 스레드가 잠겼거나 아카이브된 경우 (포스트 종료)
                if ((newThread.locked && !oldThread.locked) || (newThread.archived && !oldThread.archived)) {
                    const forumChannelConfig = this.config.monitoring.forumChannels.find(ch => ch.id === newThread.parent.id);
                    if (this.config.github?.enabled && forumChannelConfig) {
                        const reason = newThread.locked ? '포스트가 잠김' : '포스트가 아카이브됨';
                        console.log(`🔒 포럼 포스트 종료 감지: ${newThread.name} (${reason})`);
                        const closeSuccess = await this.githubService.closeIssueForClosedPost(newThread.id, reason);
                        if (closeSuccess) {
                            console.log(`✅ GitHub 이슈 종료 성공`);
                        }
                        else {
                            console.log(`❌ GitHub 이슈 종료 실패`);
                        }
                    }
                }
            }
        }
        catch (error) {
            console.error('❌ 스레드 업데이트 처리 중 오류:', error);
        }
    }
    getMonitoredChannels() {
        return this.forumChannelIds;
    }
    getConfig() {
        return this.config;
    }
    addForumChannel(channelId) {
        if (!this.forumChannelIds.includes(channelId)) {
            this.forumChannelIds.push(channelId);
        }
    }
    removeForumChannel(channelId) {
        this.forumChannelIds = this.forumChannelIds.filter(id => id !== channelId);
    }
    async saveUserScore(message, forumChannelConfig) {
        try {
            const scoreData = {
                name: message.author.displayName || message.author.username,
                discord_id: message.author.id,
                score: forumChannelConfig.score,
                scored_at: new Date().toISOString(),
                scored_by: {
                    post_name: message.channel.name || 'Unknown',
                    message_content: message.content.length > 500 ? message.content.substring(0, 500) + '...' : message.content,
                    message_link: `https://discord.com/channels/${message.guild?.id}/${message.channel.id}/${message.id}`
                }
            };
            const response = await fetch(`${this.config.supabase?.serverUrl}/api/users/score`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(scoreData)
            });
            if (response.ok) {
                console.log(`✅ 사용자 점수 저장 성공: ${message.author.username} (+${forumChannelConfig.score}점)`);
            }
            else {
                const errorText = await response.text();
                console.error(`❌ 사용자 점수 저장 실패:`, errorText);
            }
        }
        catch (error) {
            console.error('❌ 사용자 점수 저장 중 오류:', error);
        }
    }
    async handleMessageDelete(message) {
        // 부분 메시지인 경우 처리
        if (message.partial) {
            try {
                await message.fetch();
            }
            catch (error) {
                console.error('❌ 삭제된 메시지 정보를 가져올 수 없음:', error);
                return;
            }
        }
        // DM이나 봇 메시지는 무시
        if (!message.guild || message.author?.bot)
            return;
        // 포럼 채널의 스레드에서 온 메시지인지 확인
        if (message.channel.type === ChannelType.PublicThread && message.channel.parent) {
            const parentChannel = message.channel.parent;
            // 부모 채널이 모니터링 대상 포럼 채널인지 확인
            if (this.forumChannelIds.includes(parentChannel.id)) {
                const forumChannelConfig = this.config.monitoring.forumChannels.find(ch => ch.id === parentChannel.id);
                const timestamp = new Date().toLocaleString('ko-KR');
                console.log(`\n🗑️ [${timestamp}] 포럼 메시지 삭제 감지!`);
                console.log(`📋 포럼: ${forumChannelConfig?.name || parentChannel.name} (${parentChannel.id})`);
                console.log(`📝 포스트: ${message.channel.name}`);
                console.log(`👤 작성자: ${message.author?.displayName || message.author?.username} (${message.author?.id})`);
                console.log(`🆔 메시지 ID: ${message.id}`);
                // GitHub 댓글 삭제
                if (this.config.github?.enabled && forumChannelConfig) {
                    console.log(`🐙 GitHub 댓글 삭제 시도...`);
                    const deleteSuccess = await this.githubService.deleteCommentForMessage(message.id);
                    if (deleteSuccess) {
                        console.log(`✅ GitHub 댓글 삭제 성공`);
                    }
                    else {
                        console.log(`❌ GitHub 댓글 삭제 실패`);
                    }
                }
            }
        }
    }
}
export default {
    name: 'forum',
    run: (client, msg, args) => {
        const subcommand = args[0];
        switch (subcommand) {
            case 'list':
                const forumMonitor = client.forumMonitor;
                if (forumMonitor) {
                    const config = forumMonitor.getConfig();
                    const channels = config.monitoring.forumChannels;
                    if (channels.length === 0) {
                        msg.reply('모니터링 중인 포럼 채널이 없습니다.');
                    }
                    else {
                        const channelList = channels.map((ch) => `• **${ch.name}** (${ch.id})`).join('\n\n');
                        msg.reply(`모니터링 중인 포럼 채널 (${channels.length}개):\n\n${channelList}\n\n*콘솔 출력으로만 모니터링됩니다.*`);
                    }
                }
                else {
                    msg.reply('포럼 모니터링이 설정되지 않았습니다.');
                }
                break;
            case 'status':
                const monitor = client.forumMonitor;
                if (monitor) {
                    const config = monitor.getConfig();
                    const status = config.monitoring.enabled ? '활성화' : '비활성화';
                    const channelCount = config.monitoring.forumChannels.length;
                    msg.reply(`포럼 모니터링 상태:\n• 전체 모니터링: **${status}**\n• 모니터링 채널 수: **${channelCount}개**\n• 출력 방식: **콘솔 로그만**`);
                }
                else {
                    msg.reply('포럼 모니터링이 설정되지 않았습니다.');
                }
                break;
            case 'help':
                msg.reply('포럼 모니터링 명령어:\n`/forum list` - 모니터링 중인 채널 목록\n`/forum status` - 모니터링 상태 확인\n`/forum help` - 도움말');
                break;
            default:
                msg.reply('사용법: `/forum [list|status|help]`');
                break;
        }
    }
};
//# sourceMappingURL=forum.js.map