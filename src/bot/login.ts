import { Client, GatewayIntentBits, Partials } from 'discord.js';
// import { CommandHandler } from './commands/Command.js'; // TODO: Implement command handler
import { ForumMonitor } from './monitors/ForumMonitor.js';
import { setDiscordClient } from '../api/app.js';

interface ExtendedClient extends Client {
    forumMonitor?: ForumMonitor;
}
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 상위 폴더의 .env 파일을 읽도록 설정
dotenv.config({ path: path.join(__dirname, '../.env') });
const token = process.env.DISCORD_TOKEN;

export function createDiscordClient() {
    const client = new Client({
        intents: [
            GatewayIntentBits.DirectMessages,
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent,
            GatewayIntentBits.GuildMessageReactions // 반응 이벤트용
        ],
        partials: [
            Partials.Channel,
            Partials.Message,    // 캐시되지 않은 메시지용
            Partials.Reaction   // 캐시되지 않은 반응용
        ]
    });

    // let commandHandler: CommandHandler; // TODO: Implement command handler
    let forumMonitor: ForumMonitor;

    // 준비 이벤트 핸들러
    client.on('ready', async () => {
        console.log(`${client.user?.tag || 'Discord Bot'} 에 로그인됨`);

        try {
            // CommandHandler 초기화 (클라이언트가 준비된 후)
            // commandHandler = await new CommandHandler(client).initialize(); // TODO: Implement

            // ForumMonitor 초기화
            forumMonitor = new ForumMonitor(client);
            (client as ExtendedClient).forumMonitor = forumMonitor;

            // Express 서버에 Discord 클라이언트 설정
            await setDiscordClient(client);
            console.log('✅ Express 서버에 Discord 클라이언트 연결 완료');

            // ForumMonitor가 완전히 초기화될 때까지 잠시 대기
            setTimeout(() => {
                const monitoredChannels = forumMonitor.getMonitoredChannels();
                if (monitoredChannels) {
                    console.log(`모니터링 중인 채널: ${monitoredChannels.length}개`);
                }
            }, 1000);
        } catch (error) {
            console.error('❌ Discord 클라이언트 초기화 중 오류:', error);
        }
    });

    return client;
}

export async function startDiscordBot() {
    const client = createDiscordClient();

    if (!token) {
        console.error('❌ DISCORD_TOKEN이 설정되지 않았습니다.');
        process.exit(1);
    }

    try {
        await client.login(token);
        console.log('✅ Discord 봇 로그인 성공');
        return client;
    } catch (error) {
        console.error('❌ Discord 봇 로그인 실패:', error);
        process.exit(1);
    }
}
