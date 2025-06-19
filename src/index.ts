import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { CommandHandler } from './command/Command.ts';
import { ForumMonitor } from './forum/forum.ts';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 상위 폴더의 .env 파일을 읽도록 설정
dotenv.config({ path: path.join(__dirname, '../.env') });
const token = process.env.DISCORD_TOKEN;

const client = new Client({
    intents: [
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions, // 반응 이벤트용
    ],
    partials: [
        Partials.Channel,
        Partials.Message,    // 캐시되지 않은 메시지용
        Partials.Reaction,   // 캐시되지 않은 반응용
    ],
});

let commandHandler: CommandHandler;
let forumMonitor: ForumMonitor;

// CommandHandler 및 ForumMonitor 초기화
(async () => {
    commandHandler = await new CommandHandler().initialize();
    
    // ForumMonitor 초기화
    forumMonitor = new ForumMonitor(client);
    (client as any).forumMonitor = forumMonitor;
    
    // 준비
    client.on('ready', () => {
        console.log(`${client.user?.tag} 에 로그인됨`);
        console.log(`포럼 모니터링 중인 채널: ${forumMonitor.getMonitoredChannels().length}개`);
    });

    // 메세지 
    client.on('messageCreate', msg => {
        if (commandHandler) {
            commandHandler.handleMessage(client, msg);
        }
    });

    client.login(token);
})();  