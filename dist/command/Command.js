import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { Collection } from 'discord.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);
export class CommandHandler {
    commands;
    prefix;
    constructor() {
        this.commands = new Collection();
        this.prefix = '/';
    }
    async initialize() {
        await this.loadCommands();
        return this;
    }
    async loadCommands() {
        const commandsPath = path.join(__dirname, 'list');
        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.ts'));
        for (const file of commandFiles) {
            const filePath = path.join(commandsPath, file);
            const command = await import(filePath);
            this.commands.set(command.default.name, command.default);
        }
        console.log(this.commands.map((c) => c.name).join(', ') + ' 명령어가 로드됨.');
    }
    handleMessage(client, msg) {
        if (msg.author.bot)
            return;
        if (!msg.content.startsWith(this.prefix))
            return;
        if (msg.content.slice(0, this.prefix.length) !== this.prefix)
            return;
        const args = msg.content.slice(this.prefix.length).trim().split(/ +/g);
        const command = args.shift().toLowerCase();
        let cmd = this.commands.get(command);
        if (cmd)
            cmd.run(client, msg, args);
    }
}
//# sourceMappingURL=Command.js.map