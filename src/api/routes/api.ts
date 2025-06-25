import { Router } from 'express';
import { supabase } from '../../shared/utils/supabase.js';
import { PrismaClient } from '@prisma/client';
import { getDiscordClient } from '../app.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';

const router = Router();
const prisma = new PrismaClient();

// API documentation endpoint
router.get('/', (_, res) => {
    res.json({
        name: 'Discord Bot API',
        version: '1.0.0',
        endpoints: {
            'GET /health': 'Health check',
            'GET /api': 'API documentation',
            
            // Todo endpoints  
            'POST /api/todo/create': 'Create todo (task_name, complexity, due_date, url) - Auto-sends Discord message with 👀 emoji',
            'POST /api/todo/:id/complete': 'Complete todo - Changes 👀 to ✅ emoji on Discord',
            'GET /api/todo': 'Get todos with filters (completed=true/false)',
            'GET /api/todo/:id': 'Get specific todo',
            
            // User endpoints
            'GET /api/users': 'Get active users',
            'GET /api/users/:discordId': 'Get specific user',
            'POST /api/users/sync': 'Trigger user sync',
            'POST /api/users/score': 'Add user score (name, discord_id, score, scored_at, scored_by) - Auto-logs to Logs table',
            
            // Forum endpoints
            'GET /api/forums': 'Get forums',
            'GET /api/forums/:channelId/posts': 'Get forum posts',
            'GET /api/forums/posts/:postId/messages': 'Get post messages',
            'GET /api/forums/supabase': 'Get Supabase forums',
            'POST /api/forums/supabase': 'Add new forum',
            'PATCH /api/forums/supabase/:id': 'Update forum',
            'DELETE /api/forums/supabase/:id': 'Delete forum',
            
            // Sync endpoints (Updated for real schema)
            'POST /api/sync/supabase': 'Sync data to Suggestions table with proper schema',
            'POST /api/sync/post': 'Sync forum post to Suggestions table',
            'POST /api/sync/message': 'Sync forum message to Suggestions table',
            
            // GitHub endpoints
            'GET /api/github/issues': 'List GitHub issues',
            'POST /api/github/issues': 'Create GitHub issue',
            
            // Other endpoints
            'GET /api/stats': 'Get server statistics',
            'GET /api/config': 'Get configuration',
            'GET /api/supabase/stats': 'Get Supabase statistics',
            'GET /api/supabase/tables': 'Get table structures',
            'GET /api/logs': 'Get recent logs',
            'GET /api/logs/channel/:channelId': 'Get channel logs',
            'GET /api/logs/user/:userId': 'Get user logs',
            'POST /api/discord/reply': 'Send Discord reply (task_name, complexity, due_date, thread_id)'
        }
    });
});

// Get server statistics endpoint
router.get('/stats', asyncHandler(async (_, res) => {
    try {
        // Get counts from various tables
        const [taskCount, userCount] = await Promise.all([
            prisma.task.count(),
            prisma.user.count()
        ]);

        // Get Supabase table counts
        const tables = ['Suggestions', 'Reports', 'Questions', 'Todo', 'Users', 'Forums'];
        const tableCounts: Record<string, number> = {};

        for (const table of tables) {
            try {
                const { count, error } = await supabase
                    .from(table)
                    .select('*', { count: 'exact', head: true });

                tableCounts[table] = error ? 0 : (count || 0);
            } catch {
                tableCounts[table] = 0;
            }
        }

        const totalSupabase = Object.values(tableCounts).reduce((sum, count) => sum + count, 0);

        return res.json({
            success: true,
            stats: {
                local_db: {
                    tasks: taskCount,
                    users: userCount
                },
                supabase: tableCounts,
                totals: {
                    local_tasks: taskCount,
                    local_users: userCount,
                    supabase_records: totalSupabase
                },
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}));

// Get configuration endpoint
router.get('/config', asyncHandler(async (_, res) => {
    try {
        const { data, error } = await supabase
            .from('Forums')
            .select('*');

        if (error) {
            console.error('Error fetching config:', error);
            return res.status(500).json({ error: error.message });
        }

        return res.json({ 
            success: true, 
            config: {
                forums: data,
                monitoring: {
                    enabled: true,
                    checkInterval: 1000
                }
            }
        });
    } catch (error) {
        console.error('Error in config endpoint:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}));

// Get Supabase statistics endpoint
router.get('/supabase/stats', asyncHandler(async (_, res) => {
    try {
        const tables = ['Suggestions', 'Reports', 'Questions', 'Todo', 'Users', 'Forums'];
        const stats: Record<string, number> = {};

        for (const table of tables) {
            try {
                const { count, error } = await supabase
                    .from(table)
                    .select('*', { count: 'exact', head: true });

                stats[table] = error ? 0 : (count || 0);
            } catch {
                stats[table] = 0;
            }
        }

        const total = Object.values(stats).reduce((sum, count) => sum + count, 0);

        return res.json({
            success: true,
            tables: stats,
            total: total,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error fetching Supabase stats:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}));

// Get table structures endpoint
router.get('/supabase/tables', asyncHandler(async (_, res) => {
    try {
        // This would typically return table schema information
        const tables = {
            Suggestions: ['id', 'post_name', 'content', 'created_at', 'details', 'user'],
            Reports: ['id', 'post_name', 'content', 'created_at', 'details', 'user'],
            Questions: ['id', 'post_name', 'content', 'created_at', 'details', 'user'],
            Todo: ['id', 'post_name', 'content', 'created_at', 'details', 'user'],
            Users: ['id', 'discord_id', 'name', 'score', 'scored_by', 'avatar_url'],
            Forums: ['id', 'name', 'channel_id', 'table_name', 'score', 'github_sync', 'todo']
        };

        return res.json({ success: true, tables });
    } catch (error) {
        console.error('Error fetching table structures:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}));

// Get recent logs endpoint
router.get('/logs', asyncHandler(async (req, res) => {
    try {
        const { limit = '50' } = req.query;
        
        // This would typically fetch from a logs table or service
        return res.json({ 
            success: true, 
            logs: [],
            message: 'Logs endpoint not fully implemented'
        });
    } catch (error) {
        console.error('Error fetching logs:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}));

// Get channel logs endpoint
router.get('/logs/channel/:channelId', asyncHandler(async (req, res) => {
    try {
        const { channelId } = req.params;
        
        // This would typically fetch channel-specific logs
        return res.json({ 
            success: true, 
            logs: [],
            channel_id: channelId,
            message: 'Channel logs endpoint not fully implemented'
        });
    } catch (error) {
        console.error('Error fetching channel logs:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}));

// Get user logs endpoint
router.get('/logs/user/:userId', asyncHandler(async (req, res) => {
    try {
        const { userId } = req.params;
        
        // This would typically fetch user-specific logs
        return res.json({ 
            success: true, 
            logs: [],
            user_id: userId,
            message: 'User logs endpoint not fully implemented'
        });
    } catch (error) {
        console.error('Error fetching user logs:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}));

// Send Discord reply endpoint
router.post('/discord/reply', asyncHandler(async (req, res) => {
    try {
        const { task_name, complexity, due_date, thread_id } = req.body;
        
        if (!task_name || !complexity || !due_date || !thread_id) {
            return res.status(400).json({ 
                error: 'Missing required fields: task_name, complexity, due_date, thread_id' 
            });
        }

        const discordClient = getDiscordClient();
        if (!discordClient) {
            return res.status(500).json({ error: 'Discord client not initialized' });
        }

        // Find the thread channel
        const channel = await discordClient.channels.fetch(thread_id);
        if (!channel || !channel.isThread()) {
            return res.status(404).json({ error: 'Thread not found' });
        }

        // Save task to database
        const task = await prisma.task.create({
            data: {
                taskName: task_name,
                complexity: parseInt(complexity),
                dueDate: new Date(due_date),
                url: `https://discord.com/channels/${channel.guildId}/${thread_id}`,
                threadId: thread_id,
                channelId: channel.parentId || thread_id,
                guildId: channel.guildId || 'unknown',
                status: 'pending'
            }
        });

        // Format the reply message
        const replyMessage = `🤖 **Task Created**\n` +
            `📋 **Task:** ${task_name}\n` +
            `⚡ **Complexity:** ${complexity}/10\n` +
            `📅 **Due Date:** ${new Date(due_date).toLocaleDateString('ko-KR')}\n` +
            `🆔 **Task ID:** ${task.id.substring(0, 8)}`;

        // Send the reply
        const sentMessage = await channel.send(replyMessage);
        
        console.log(`✅ Discord task reply sent to thread ${thread_id}: ${task_name}`);
        
        return res.json({ 
            success: true, 
            message_id: sentMessage.id,
            thread_id: thread_id,
            task_id: task.id
        });
    } catch (error) {
        console.error('Error sending Discord reply:', error);
        return res.status(500).json({ error: 'Failed to send Discord reply' });
    }
}));

export default router;