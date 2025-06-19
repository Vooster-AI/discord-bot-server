import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import { Client } from 'discord.js';
import { WebhookSyncService } from '../services/webhookSync';
import * as fs from 'fs';

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

// Discord client and webhook service will be injected
let discordClient: Client | null = null;
let webhookService: WebhookSyncService | null = null;

// Discord client 설정 함수
export function setDiscordClient(client: Client) {
    discordClient = client;
    
    // forum-config.json 읽기
    const configPath = path.join(__dirname, '../forum/forum-config.json');
    try {
        const configData = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        webhookService = new WebhookSyncService(client, configData);
        
        // ForumMonitor에 웹훅 콜백 설정
        const forumMonitor = (client as any).forumMonitor;
        if (forumMonitor) {
            forumMonitor.setWebhookCallback((issueNumber: number, threadId: string) => {
                webhookService?.setIssueThreadMapping(issueNumber, threadId);
            });
            console.log('✅ ForumMonitor와 WebhookService 연결 완료');
        }
        
        console.log('✅ WebhookSyncService 초기화 완료');
    } catch (error) {
        console.error('❌ WebhookSyncService 초기화 실패:', error);
    }
}

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

// User score endpoint
app.post('/api/users/score', async (req, res) => {
    try {
        const { name, discord_id, score, scored_at, scored_by } = req.body;
        
        if (!name || !discord_id || typeof score !== 'number' || !scored_at || !scored_by) {
            return res.status(400).json({ error: 'Missing required fields: name, discord_id, score, scored_at, scored_by' });
        }

        // 기존 사용자 데이터 조회
        const { data: existingUser, error: selectError } = await supabase
            .from('Users')
            .select('*')
            .eq('discord_id', discord_id)
            .single();

        if (selectError && selectError.code !== 'PGRST116') { // PGRST116 = no rows found
            console.error('Supabase select error:', selectError);
            return res.status(500).json({ error: 'Database select failed', details: selectError.message });
        }

        const newLogEntry = {
            post_name: scored_by.post_name,
            message_content: scored_by.message_content,
            message_link: scored_by.message_link,
            scored_at: scored_at,
            score: score
        };

        let result;
        if (existingUser) {
            // 기존 사용자: 점수 누적 및 로그 추가
            const currentScore = existingUser.score || 0;
            const currentLogs = Array.isArray(existingUser.scored_by) ? existingUser.scored_by : [];
            
            console.log(`📊 기존 사용자 업데이트: ${name} (현재 점수: ${currentScore}, 추가 점수: ${score})`);
            console.log(`📝 현재 로그 수: ${currentLogs.length}`);
            
            const { data, error } = await supabase
                .from('Users')
                .update({
                    name: name, // 이름 업데이트 (변경될 수 있음)
                    score: currentScore + score,
                    scored_by: [...currentLogs, newLogEntry]
                })
                .eq('discord_id', discord_id)
                .select();

            if (error) {
                console.error('Supabase update error:', error);
                return res.status(500).json({ error: 'Database update failed', details: error.message });
            }
            result = data;
        } else {
            // 새 사용자: 신규 생성
            const { data, error } = await supabase
                .from('Users')
                .insert({
                    name,
                    discord_id,
                    score,
                    scored_by: [newLogEntry]
                })
                .select();

            if (error) {
                console.error('Supabase insert error:', error);
                return res.status(500).json({ error: 'Database insert failed', details: error.message });
            }
            result = data;
        }

        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Error saving user score:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GitHub webhook endpoint
app.post('/webhook/github', async (req, res) => {
    try {
        const event = req.headers['x-github-event'] as string;
        const payload = req.body;
        
        console.log(`🔄 [WEBHOOK] GitHub 이벤트 수신: ${event}`);
        
        if (!webhookService) {
            console.error('❌ [WEBHOOK] WebhookSyncService가 초기화되지 않음');
            return res.status(500).json({ error: 'Webhook service not initialized' });
        }

        const success = await webhookService.handleGitHubWebhook(event, payload);
        
        if (success) {
            console.log(`✅ [WEBHOOK] GitHub 이벤트 처리 완료: ${event}`);
            res.status(200).json({ status: 'processed' });
        } else {
            console.log(`⚠️ [WEBHOOK] GitHub 이벤트 처리 실패 또는 무시: ${event}`);
            res.status(200).json({ status: 'ignored' });
        }
    } catch (error) {
        console.error('❌ GitHub 웹훅 처리 중 오류:', error);
        res.status(500).json({ error: 'Webhook processing failed' });
    }
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