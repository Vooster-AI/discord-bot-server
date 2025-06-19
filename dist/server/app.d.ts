import { PrismaClient } from '@prisma/client';
declare const app: import("express-serve-static-core").Express;
declare const prisma: PrismaClient<import(".prisma/client").Prisma.PrismaClientOptions, never, import("@prisma/client/runtime/library").DefaultArgs>;
declare const supabase: import("@supabase/supabase-js").SupabaseClient<any, "public", any>;
export { app, prisma, supabase };
//# sourceMappingURL=app.d.ts.map