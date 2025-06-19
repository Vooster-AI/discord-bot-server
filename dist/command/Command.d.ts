export declare class CommandHandler {
    commands: any;
    prefix: string;
    constructor();
    initialize(): Promise<this>;
    loadCommands(): Promise<void>;
    handleMessage(client: any, msg: any): void;
}
//# sourceMappingURL=Command.d.ts.map