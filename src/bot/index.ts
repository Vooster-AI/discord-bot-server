import { Client, GatewayIntentBits } from 'discord.js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { ForumMonitor } from './monitors/ForumMonitor.js';

interface ExtendedClient extends Client {
    forumMonitor?: ForumMonitor;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../../.env') });

export class DiscordBot {
    private client: Client;
    private forumMonitor: ForumMonitor | null = null;

    constructor() {
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.GuildMessageReactions,
                GatewayIntentBits.DirectMessages
            ]
        });

        this.setupEventListeners();
    }

    private setupEventListeners() {
        this.client.once('ready', () => {
            console.log(`🤖 Discord bot logged in as ${this.client.user?.tag}`);
            this.initializeServices();
        });

        this.client.on('error', (error) => {
            console.error('❌ Discord client error:', error);
        });
    }

    private initializeServices() {
        try {
            // Initialize forum monitor
            this.forumMonitor = new ForumMonitor(this.client);
            (this.client as ExtendedClient).forumMonitor = this.forumMonitor;

            console.log('✅ Discord bot services initialized');
        } catch (error) {
            console.error('❌ Failed to initialize Discord bot services:', error);
        }
    }

    public async start() {
        try {
            await this.client.login(process.env.DISCORD_TOKEN);
        } catch (error) {
            console.error('❌ Failed to start Discord bot:', error);
            throw error;
        }
    }

    public getClient(): Client {
        return this.client;
    }

    public getForumMonitor(): ForumMonitor | null {
        return this.forumMonitor;
    }
}
