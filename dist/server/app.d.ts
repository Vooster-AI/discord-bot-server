import { PrismaClient } from '@prisma/client';
import { Client } from 'discord.js';
declare const app: import("express-serve-static-core").Express;
declare const prisma: PrismaClient<import("@prisma/client").Prisma.PrismaClientOptions, never, import("@prisma/client/runtime/library").DefaultArgs>;
declare const supabase: import("@supabase/supabase-js").SupabaseClient<any, "public", any>;
export declare function setDiscordClient(client: Client): void;
export { app, prisma, supabase };
//# sourceMappingURL=app.d.ts.map