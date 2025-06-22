import { Collection, Client } from 'discord.js';
export declare class CommandHandler {
    commands: Collection<string, any>;
    client: Client;
    constructor(client: Client);
    initialize(): Promise<this>;
    loadCommands(): Promise<void>;
    registerSlashCommands(): Promise<void>;
    setupInteractionHandler(): void;
}
//# sourceMappingURL=Command.d.ts.map