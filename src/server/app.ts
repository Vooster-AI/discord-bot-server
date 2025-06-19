import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 상위 폴더의 .env 파일을 읽도록 설정
dotenv.config({ path: path.join(__dirname, '../../.env') });

const app = express();
const prisma = new PrismaClient();
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// API Routes
app.get('/api/forums', async (req, res) => {
    try {
        const forums = await prisma.forumChannel.findMany({
            include: {
                guild: true,
                posts: {
                    take: 10,
                    orderBy: { lastMessageAt: 'desc' },
                    include: {
                        messages: {
                            take: 1,
                            orderBy: { createdAt: 'desc' }
                        }
                    }
                }
            }
        });
        
        res.json(forums);
    } catch (error) {
        console.error('Error fetching forums:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/forums/:channelId/posts', async (req, res) => {
    try {
        const { channelId } = req.params;
        const { page = 1, limit = 20 } = req.query;
        
        const posts = await prisma.forumPost.findMany({
            where: { channelId },
            include: {
                messages: {
                    take: 3,
                    orderBy: { createdAt: 'desc' }
                }
            },
            orderBy: { lastMessageAt: 'desc' },
            skip: (Number(page) - 1) * Number(limit),
            take: Number(limit)
        });
        
        const total = await prisma.forumPost.count({
            where: { channelId }
        });
        
        res.json({
            posts,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                totalPages: Math.ceil(total / Number(limit))
            }
        });
    } catch (error) {
        console.error('Error fetching posts:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/posts/:postId/messages', async (req, res) => {
    try {
        const { postId } = req.params;
        const { page = 1, limit = 50 } = req.query;
        
        const messages = await prisma.forumMessage.findMany({
            where: { postId },
            orderBy: { createdAt: 'asc' },
            skip: (Number(page) - 1) * Number(limit),
            take: Number(limit)
        });
        
        const total = await prisma.forumMessage.count({
            where: { postId }
        });
        
        res.json({
            messages,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                totalPages: Math.ceil(total / Number(limit))
            }
        });
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Supabase direct sync endpoint
app.post('/api/sync/supabase', async (req, res) => {
    try {
        const { table, data } = req.body;
        
        if (!table || !data) {
            return res.status(400).json({ error: 'Table name and data are required' });
        }

        // Validate table name
        const allowedTables = ['Suggestions', 'Reports', 'Questions'];
        if (!allowedTables.includes(table)) {
            return res.status(400).json({ error: 'Invalid table name' });
        }

        // Insert data into Supabase
        const { data: result, error } = await supabase
            .from(table)
            .insert(data)
            .select();

        if (error) {
            console.error(`Error inserting into ${table}:`, error);
            console.error(`Error details:`, error.details, error.hint, error.code);
            return res.status(500).json({ error: error.message, details: error.details });
        }

        console.log(`✅ Successfully inserted into ${table}:`, result);
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Error in Supabase sync:', error);
        res.status(500).json({ error: 'Sync failed' });
    }
});

// Legacy sync endpoint for Discord bot
app.post('/api/sync/post', async (req, res) => {
    try {
        const { 
            id, 
            title, 
            content, 
            authorId, 
            authorName, 
            authorAvatar,
            channelId, 
            guildId,
            tags = [],
            createdAt 
        } = req.body;

        // Create or update guild
        await prisma.guild.upsert({
            where: { id: guildId },
            update: { updatedAt: new Date() },
            create: {
                id: guildId,
                name: req.body.guildName || 'Unknown Guild'
            }
        });

        // Create or update forum channel
        await prisma.forumChannel.upsert({
            where: { id: channelId },
            update: { updatedAt: new Date() },
            create: {
                id: channelId,
                name: req.body.channelName || 'Unknown Channel',
                guildId: guildId
            }
        });

        // Create forum post
        const post = await prisma.forumPost.create({
            data: {
                id,
                title,
                content,
                authorId,
                authorName,
                authorAvatar,
                channelId,
                guildId,
                tags,
                createdAt: new Date(createdAt),
                lastMessageAt: new Date(createdAt)
            }
        });

        // Log sync action
        await prisma.syncLog.create({
            data: {
                action: 'post_created',
                discordId: id,
                success: true,
                metadata: { title, authorName, channelId }
            }
        });

        res.json({ success: true, post });
    } catch (error) {
        console.error('Error syncing post:', error);
        
        // Log sync error
        await prisma.syncLog.create({
            data: {
                action: 'post_created',
                discordId: req.body.id || 'unknown',
                success: false,
                error: (error as Error).message
            }
        });
        
        res.status(500).json({ error: 'Sync failed' });
    }
});

app.post('/api/sync/message', async (req, res) => {
    try {
        const {
            id,
            content,
            authorId,
            authorName,
            authorAvatar,
            postId,
            guildId,
            createdAt
        } = req.body;

        // Create forum message
        const message = await prisma.forumMessage.create({
            data: {
                id,
                content,
                authorId,
                authorName,
                authorAvatar,
                postId,
                guildId,
                createdAt: new Date(createdAt)
            }
        });

        // Update post message count and last message time
        await prisma.forumPost.update({
            where: { id: postId },
            data: {
                messageCount: { increment: 1 },
                lastMessageAt: new Date(createdAt)
            }
        });

        // Log sync action
        await prisma.syncLog.create({
            data: {
                action: 'message_created',
                discordId: id,
                success: true,
                metadata: { authorName, postId }
            }
        });

        res.json({ success: true, message });
    } catch (error) {
        console.error('Error syncing message:', error);
        
        // Log sync error
        await prisma.syncLog.create({
            data: {
                action: 'message_created',
                discordId: req.body.id || 'unknown',
                success: false,
                error: (error as Error).message
            }
        });
        
        res.status(500).json({ error: 'Sync failed' });
    }
});

// Supabase stats endpoint
app.get('/api/supabase/stats', async (req, res) => {
    try {
        const tables = ['Suggestions', 'Reports', 'Questions'];
        const stats: any = {};
        
        for (const table of tables) {
            const { count, error } = await supabase
                .from(table)
                .select('*', { count: 'exact', head: true });
            
            if (error) {
                console.error(`Error counting ${table}:`, error);
                stats[table] = 0;
            } else {
                stats[table] = count || 0;
            }
        }
        
        const total = Object.values(stats).reduce((sum: number, count: any) => sum + count, 0);
        
        res.json({
            tables: stats,
            total,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error fetching Supabase stats:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Combined stats endpoint
app.get('/api/stats', async (req, res) => {
    try {
        // Get Supabase stats
        const tables = ['Suggestions', 'Reports', 'Questions'];
        const supabaseStats: any = {};
        let supabaseTotal = 0;
        
        for (const table of tables) {
            const { count, error } = await supabase
                .from(table)
                .select('*', { count: 'exact', head: true });
            
            if (!error && count !== null) {
                supabaseStats[table] = count;
                supabaseTotal += count;
            } else {
                supabaseStats[table] = 0;
            }
        }
        
        // Legacy Prisma stats (for backward compatibility)
        let prismaStats = {};
        try {
            const [
                totalPosts,
                totalMessages,
                totalChannels,
                recentSyncs
            ] = await Promise.all([
                prisma.forumPost.count(),
                prisma.forumMessage.count(),
                prisma.forumChannel.count(),
                prisma.syncLog.findMany({
                    take: 10,
                    orderBy: { createdAt: 'desc' }
                })
            ]);
            
            prismaStats = {
                totalPosts,
                totalMessages,
                totalChannels,
                recentSyncs
            };
        } catch (prismaError) {
            console.log('Prisma stats not available');
            prismaStats = {
                totalPosts: 0,
                totalMessages: 0,
                totalChannels: 0,
                recentSyncs: []
            };
        }

        res.json({
            supabase: {
                tables: supabaseStats,
                total: supabaseTotal
            },
            legacy: prismaStats,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

const PORT = process.env.PORT || 3000;

export { app, prisma, supabase };

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`📝 API docs: http://localhost:${PORT}/api`);
});