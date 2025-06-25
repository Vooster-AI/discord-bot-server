import { Router } from 'express';
import { supabase } from '../../shared/utils/supabase.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';
import { getDiscordClient } from '../app.js';

const router = Router();

// Create todo endpoint
router.post('/create', asyncHandler(async (req, res) => {
    try {
        const { task_name, complexity, due_date, url } = req.body;
        
        if (!task_name || !complexity || !due_date || !url) {
            return res.status(400).json({ 
                error: 'Missing required fields: task_name, complexity, due_date, url' 
            });
        }

        // Extract Discord information from URL
        const urlPattern = /https:\/\/discord\.com\/channels\/(\d+)\/(\d+)\/(\d+)/;
        const urlParts = url.match(urlPattern);
        
        if (!urlParts) {
            return res.status(400).json({ 
                error: 'Invalid Discord URL format. Expected: https://discord.com/channels/{guild}/{channel}/{message}' 
            });
        }

        const [, guildId, channelId, messageId] = urlParts;
        
        // Ensure Discord IDs are treated as strings to preserve precision
        const guildIdStr = guildId.toString();
        const channelIdStr = channelId.toString();
        const messageIdStr = messageId.toString();

        // Validate complexity
        const complexityNum = parseInt(complexity);
        if (isNaN(complexityNum) || complexityNum < 1 || complexityNum > 10) {
            return res.status(400).json({ 
                error: 'Complexity must be a number between 1 and 10' 
            });
        }

        // Validate due_date
        const dueDate = new Date(due_date);
        if (isNaN(dueDate.getTime())) {
            return res.status(400).json({ 
                error: 'Invalid due_date format. Expected ISO date string' 
            });
        }

        // Create task in Supabase Todo table
        // Todo table schema: id, task_name, complexity, due_date, created_at, post_url, completed
        const { data: task, error } = await supabase
            .from('Todo')
            .insert({
                task_name: task_name,
                complexity: complexityNum,
                due_date: dueDate.toISOString().split('T')[0], // Date format for date column
                post_url: url,
                completed: false
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating todo in Supabase:', error);
            return res.status(500).json({ error: 'Failed to create todo' });
        }

        // Get Discord client and send message + reaction
        const discordClient = getDiscordClient();
        if (discordClient) {
            try {
                // Get the channel and message to add reaction and send reply
                const channel = await discordClient.channels.fetch(channelIdStr);
                if (channel && channel.isTextBased() && 'send' in channel) {
                    // Get the original message from URL
                    const originalMessage = await channel.messages.fetch(messageIdStr);
                    if (originalMessage) {
                        // Check if this is a thread and get the first message (starter message)
                        let targetMessage = originalMessage;
                        
                        if (channel.isThread()) {
                            try {
                                // Get the starter message (first message of the thread)
                                const starterMessage = await channel.fetchStarterMessage();
                                if (starterMessage) {
                                    targetMessage = starterMessage;
                                    console.log(`📌 포스트 첫 번째 메시지에 반응 추가: ${starterMessage.id}`);
                                } else {
                                    console.log(`⚠️ 스타터 메시지를 찾을 수 없어 원본 메시지에 반응: ${originalMessage.id}`);
                                }
                            } catch (starterError) {
                                console.log(`❌ 스타터 메시지 조회 실패, 원본 메시지에 반응: ${originalMessage.id}`, starterError);
                            }
                        }
                        
                        // Add 👀 emoji to the target message (starter message or original message)
                        await targetMessage.react('👀');
                        
                        // Send task info as a reply to the target message with proper markdown
                        const taskMessage = `\`\`\`
- task_name: ${task_name}
- complexity: ${complexityNum}
- due_date: ${dueDate.toISOString().split('T')[0]}
\`\`\``;
                        await targetMessage.reply(taskMessage);
                        
                        console.log(`✅ Discord message sent and reaction added for todo: ${task_name}`);
                    }
                }
            } catch (discordError) {
                console.error('❌ Discord interaction failed:', discordError);
                // Don't fail the API call if Discord interaction fails
            }
        }

        console.log(`✅ Todo created: ${task_name} (Complexity: ${complexity})`);
        return res.json({ 
            success: true, 
            task: {
                id: task.id,
                task_name: task.task_name,
                complexity: task.complexity,
                due_date: task.due_date,
                completed: task.completed,
                post_url: task.post_url,
                created_at: task.created_at
            }
        });
    } catch (error) {
        console.error('Error creating todo:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}));

// Complete todo endpoint
router.post('/:id/complete', asyncHandler(async (req, res) => {
    try {
        const { id } = req.params;
        
        // Get the todo first to extract Discord URL info
        const { data: existingTodo, error: fetchError } = await supabase
            .from('Todo')
            .select('*')
            .eq('id', id)
            .single();
            
        if (fetchError || !existingTodo) {
            return res.status(404).json({ error: 'Todo not found' });
        }
        
        // Update todo as completed in Supabase
        const { data: task, error } = await supabase
            .from('Todo')
            .update({ 
                completed: true
            })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error completing todo in Supabase:', error);
            return res.status(500).json({ error: 'Failed to complete todo' });
        }

        // Handle Discord interaction if post_url exists
        if (existingTodo.post_url) {
            const discordClient = getDiscordClient();
            if (discordClient) {
                try {
                    // Extract Discord info from URL
                    const urlPattern = /https:\/\/discord\.com\/channels\/(\d+)\/(\d+)\/(\d+)/;
                    const urlParts = existingTodo.post_url.match(urlPattern);
                    
                    if (urlParts) {
                        const [, guildId, channelId, messageId] = urlParts;
                        
                        const channel = await discordClient.channels.fetch(channelId);
                        if (channel && channel.isTextBased() && 'messages' in channel) {
                            const originalMessage = await channel.messages.fetch(messageId);
                            if (originalMessage) {
                                // Check if this is a thread and get the first message (starter message)
                                let targetMessage = originalMessage;
                                
                                if (channel.isThread()) {
                                    try {
                                        // Get the starter message (first message of the thread)
                                        const starterMessage = await channel.fetchStarterMessage();
                                        if (starterMessage) {
                                            targetMessage = starterMessage;
                                            console.log(`📌 포스트 첫 번째 메시지에서 반응 수정: ${starterMessage.id}`);
                                        } else {
                                            console.log(`⚠️ 스타터 메시지를 찾을 수 없어 원본 메시지에서 반응 수정: ${originalMessage.id}`);
                                        }
                                    } catch (starterError) {
                                        console.log(`❌ 스타터 메시지 조회 실패, 원본 메시지에서 반응 수정: ${originalMessage.id}`, starterError);
                                    }
                                }
                                
                                // Remove 👀 emoji and add ✅ emoji from target message
                                const reactions = targetMessage.reactions.cache;
                                const eyesReaction = reactions.find(reaction => reaction.emoji.name === '👀');
                                if (eyesReaction) {
                                    await eyesReaction.users.remove(discordClient.user?.id);
                                }
                                await targetMessage.react('✅');
                                
                                console.log(`✅ Discord emoji updated for completed todo: ${existingTodo.task_name}`);
                            }
                        }
                    }
                } catch (discordError) {
                    console.error('❌ Discord interaction failed:', discordError);
                    // Don't fail the API call if Discord interaction fails
                }
            }
        }

        // TODO: Add your custom completion logic here
        // This is where you can add additional functionality when a todo is completed
        // For example:
        // - Send notifications
        // - Update related records
        // - Trigger workflows
        // - Log completion events
        console.log(`🎯 Custom completion logic can be added here for todo: ${existingTodo.task_name}`);

        console.log(`✅ Todo completed: ${existingTodo.task_name}`);
        return res.json({ 
            success: true, 
            task: {
                id: task.id,
                task_name: task.task_name,
                complexity: task.complexity,
                due_date: task.due_date,
                completed: task.completed,
                post_url: task.post_url,
                created_at: task.created_at
            }
        });
    } catch (error) {
        console.error('Error completing todo:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}));

// Get todos with filters endpoint
router.get('/', asyncHandler(async (req, res) => {
    try {
        const { completed, limit = '50', offset = '0' } = req.query;
        
        // Build query based on filters
        let query = supabase
            .from('Todo')
            .select('*')
            .order('created_at', { ascending: false });
            
        // Filter by completion status if specified
        if (completed !== undefined) {
            const isCompleted = completed === 'true';
            query = query.eq('completed', isCompleted);
        }
        
        // Apply pagination
        const limitNum = parseInt(limit as string);
        const offsetNum = parseInt(offset as string);
        query = query.range(offsetNum, offsetNum + limitNum - 1);

        const { data: tasks, error } = await query;

        if (error) {
            console.error('Error fetching todos from Supabase:', error);
            return res.status(500).json({ error: 'Failed to fetch todos' });
        }

        return res.json({ 
            success: true, 
            tasks: tasks || [],
            count: tasks?.length || 0
        });
    } catch (error) {
        console.error('Error fetching todos:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}));

// Get specific todo endpoint
router.get('/:id', asyncHandler(async (req, res) => {
    try {
        const { id } = req.params;
        
        const { data: task, error } = await supabase
            .from('Todo')
            .select('*')
            .eq('id', id)
            .single();

        if (error || !task) {
            return res.status(404).json({ error: 'Todo not found' });
        }

        return res.json({ 
            success: true, 
            task: task
        });
    } catch (error) {
        console.error('Error fetching todo:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}));

export default router;