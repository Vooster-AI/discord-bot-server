import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { Collection, REST, Routes, Client } from 'discord.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

export class CommandHandler {
    commands: Collection<string, any>;
    client: Client;

    constructor(client: Client) {
        this.commands = new Collection();
        this.client = client;
    }

    async initialize() {
        await this.loadCommands();
        await this.registerSlashCommands();
        this.setupInteractionHandler();
        return this;
    }

    async loadCommands() {
        const commandsPath = path.join(__dirname, 'list');
        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
        
        for (const file of commandFiles) {
            const filePath = path.join(commandsPath, file);
            const command = await import(filePath);
            if (command.default.data && command.default.execute) {
                this.commands.set(command.default.data.name, command.default);
            }
        }
        
        console.log(this.commands.map((c: any) => c.data.name).join(', ') + ' 슬래시 명령어가 로드됨.');
    }

    async registerSlashCommands() {
        const commands = this.commands.map(command => command.data.toJSON());
        
        const rest = new REST().setToken(process.env.DISCORD_TOKEN!);
        
        try {
            console.log('슬래시 명령어 등록을 시작합니다...');
            
            // 글로벌 명령어로 등록 (모든 서버에서 사용 가능)
            await rest.put(
                Routes.applicationCommands(this.client.user!.id),
                { body: commands }
            );
            
            console.log('✅ 슬래시 명령어 등록이 완료되었습니다.');
        } catch (error) {
            console.error('❌ 슬래시 명령어 등록 중 오류 발생:', error);
        }
    }

    setupInteractionHandler() {
        this.client.on('interactionCreate', async (interaction) => {
            if (!interaction.isChatInputCommand()) return;

            const command = this.commands.get(interaction.commandName);
            if (!command) return;

            try {
                await command.execute(interaction);
            } catch (error) {
                console.error('명령어 실행 중 오류:', error);
                const reply = { content: '명령어 실행 중 오류가 발생했습니다.', ephemeral: true };
                
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp(reply);
                } else {
                    await interaction.reply(reply);
                }
            }
        });
    }
}