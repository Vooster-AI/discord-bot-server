import { Router } from 'express';
import { supabase } from '../../shared/utils/supabase.js';
import { UserService } from '../../core/services/UserService.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';

const router = Router();

// Supabase direct sync endpoint
router.post('/supabase', asyncHandler(async (req, res) => {
    try {
        const { table, data } = req.body;
        
        if (!table || !data) {
            return res.status(400).json({ error: 'Table name and data are required' });
        }

        // Validate table name
        const allowedTables = ['Suggestions'];
        if (!allowedTables.includes(table)) {
            return res.status(400).json({ error: 'Invalid table name. Only Suggestions is supported.' });
        }

        // Process user first to get user ID
        let userId = null;
        if (data.details && data.details.authorId && data.details.authorName) {
            const discordId = data.details.authorId.toString();
            const fullName = data.details.authorName;
            // Extract username from authorName (format: username#discriminator or just username)
            const username = fullName.includes('#') ? fullName.split('#')[0] : fullName;
            const nickname = data.details.authorDisplayName || null;
            
            try {
                // Get or create user in Users table
                let { data: existingUser, error: selectError } = await supabase
                    .from('Users')
                    .select('*')
                    .eq('discord_id', discordId)
                    .single();

                if (selectError && selectError.code !== 'PGRST116') {
                    console.error('Error checking existing user:', selectError);
                } else if (!existingUser) {
                    // Create new user
                    const { data: newUser, error: insertError } = await supabase
                        .from('Users')
                        .insert({
                            discord_id: discordId,
                            nickname: nickname,
                            username: username,
                            score: 0
                        })
                        .select()
                        .single();
                        
                    if (insertError) {
                        console.error('Error creating user:', insertError);
                    } else {
                        console.log(`✅ User created: ${username} (${discordId})`);
                        userId = newUser.id;
                    }
                } else {
                    console.log(`✅ User exists: ${username} (${discordId})`);
                    userId = existingUser.id;
                }
            } catch (userError) {
                console.error('❌ Error processing user:', userError);
            }
        }

        // Process data according to actual table schema
        let processedData;
        
        if (table === 'Suggestions') {
            // Clean post_name by removing _숫자 suffix (e.g., "테스트 6.24_1387054729791668426" -> "테스트 6.24")
            let cleanPostName = data.post_name || 'Untitled';
            if (cleanPostName !== 'Untitled') {
                cleanPostName = cleanPostName.replace(/_\d+$/, '');
            }
            
            // Generate message_link if we have the required IDs (ensure they're strings for precision)
            let messageLink: string | null = null;
            if (data.details?.guildId && data.details?.channelId && data.details?.messageId) {
                const guildIdStr = data.details.guildId.toString();
                const channelIdStr = data.details.channelId.toString();
                const messageIdStr = data.details.messageId.toString();
                messageLink = `https://discord.com/channels/${guildIdStr}/${channelIdStr}/${messageIdStr}`;
            } else if (data.details?.messageLink) {
                messageLink = data.details.messageLink;
            }
            
            console.log('🔗 Message link processing:', {
                guildId: data.details?.guildId,
                channelId: data.details?.channelId, 
                messageId: data.details?.messageId,
                providedLink: data.details?.messageLink,
                generatedLink: messageLink
            });
            
            // Suggestions table schema: id, post_name, content, user, post_id, message_id, message_link, created_at
            processedData = {
                post_name: cleanPostName,
                content: data.content || '',
                user: userId, // FK reference to Users table
                post_id: data.details?.postId?.toString() || null,
                message_id: data.details?.messageId?.toString() || null,
                message_link: messageLink,
                created_at: data.created_at || new Date().toISOString()
            };
        }

        // Insert data into Supabase with correct schema
        const { data: result, error } = await supabase
            .from(table)
            .insert(processedData)
            .select();

        if (error) {
            console.error(`Error inserting into ${table}:`, error);
            console.error(`Error details:`, error.details, error.hint, error.code);
            return res.status(500).json({ error: error.message, details: error.details });
        }

        console.log(`✅ Successfully inserted into ${table}:`, result);
        return res.json({ success: true, data: result });
    } catch (error) {
        console.error('Error in Supabase sync:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}));

// Sync forum post endpoint
router.post('/post', asyncHandler(async (req, res) => {
    try {
        const { table, postData } = req.body;
        
        if (!table || !postData) {
            return res.status(400).json({ error: 'Table and post data are required' });
        }

        // Validate table - only Suggestions is supported now
        const allowedTables = ['Suggestions'];
        if (!allowedTables.includes(table)) {
            return res.status(400).json({ error: 'Invalid table name. Only Suggestions is supported.' });
        }

        // Process user first to get user ID
        let userId = null;
        if (postData.details && postData.details.authorId && postData.details.authorName) {
            const discordId = postData.details.authorId.toString();
            const fullName = postData.details.authorName;
            // Extract username from authorName (format: username#discriminator or just username)
            const username = fullName.includes('#') ? fullName.split('#')[0] : fullName;
            const nickname = postData.details.authorDisplayName || null;
            
            try {
                // Get or create user in Users table
                let { data: existingUser, error: selectError } = await supabase
                    .from('Users')
                    .select('*')
                    .eq('discord_id', discordId)
                    .single();

                if (selectError && selectError.code !== 'PGRST116') {
                    console.error('Error checking existing user:', selectError);
                } else if (!existingUser) {
                    // Create new user
                    const { data: newUser, error: insertError } = await supabase
                        .from('Users')
                        .insert({
                            discord_id: discordId,
                            nickname: nickname,
                            username: username,
                            score: 0
                        })
                        .select()
                        .single();
                        
                    if (insertError) {
                        console.error('Error creating user:', insertError);
                    } else {
                        console.log(`✅ User created for post: ${username} (${discordId})`);
                        userId = newUser.id;
                    }
                } else {
                    console.log(`✅ User exists for post: ${username} (${discordId})`);
                    userId = existingUser.id;
                }
            } catch (userError) {
                console.error('❌ Error processing user for post:', userError);
            }
        }

        // Process data according to actual table schema
        let processedData;
        if (table === 'Suggestions') {
            // Clean post_name by removing _숫자 suffix (e.g., "테스트 6.24_1387054729791668426" -> "테스트 6.24")
            let cleanPostName = postData.post_name || 'Untitled';
            if (cleanPostName !== 'Untitled') {
                cleanPostName = cleanPostName.replace(/_\d+$/, '');
            }
            
            // Generate message_link if we have the required IDs (ensure they're strings for precision)
            let messageLink: string | null = null;
            if (postData.details?.guildId && postData.details?.channelId && postData.details?.messageId) {
                const guildIdStr = postData.details.guildId.toString();
                const channelIdStr = postData.details.channelId.toString();
                const messageIdStr = postData.details.messageId.toString();
                messageLink = `https://discord.com/channels/${guildIdStr}/${channelIdStr}/${messageIdStr}`;
            } else if (postData.details?.messageLink) {
                messageLink = postData.details.messageLink;
            }
            
            console.log('🔗 Post message link processing:', {
                guildId: postData.details?.guildId,
                channelId: postData.details?.channelId, 
                messageId: postData.details?.messageId,
                providedLink: postData.details?.messageLink,
                generatedLink: messageLink
            });
            
            // Suggestions table schema: id, post_name, content, user, post_id, message_id, message_link, created_at
            processedData = {
                post_name: cleanPostName,
                content: postData.content || '',
                user: userId, // FK reference to Users table
                post_id: postData.details?.postId?.toString() || null,
                message_id: postData.details?.messageId?.toString() || null,
                message_link: messageLink,
                created_at: postData.created_at || new Date().toISOString()
            };
        }

        const { data, error } = await supabase
            .from(table)
            .insert(processedData)
            .select();

        if (error) {
            console.error(`Error syncing post to ${table}:`, error);
            return res.status(500).json({ error: error.message });
        }

        console.log(`✅ Post synced to ${table}`);
        return res.json({ success: true, data: data[0] });
    } catch (error) {
        console.error('Error in post sync:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}));

// Sync forum message endpoint
router.post('/message', asyncHandler(async (req, res) => {
    try {
        const { table, messageData } = req.body;
        
        if (!table || !messageData) {
            return res.status(400).json({ error: 'Table and message data are required' });
        }

        // Validate table - only Suggestions is supported now
        const allowedTables = ['Suggestions'];
        if (!allowedTables.includes(table)) {
            return res.status(400).json({ error: 'Invalid table name. Only Suggestions is supported.' });
        }

        // Process user first to get user ID
        let userId = null;
        if (messageData.details && messageData.details.authorId && messageData.details.authorName) {
            const discordId = messageData.details.authorId.toString();
            const fullName = messageData.details.authorName;
            // Extract username from authorName (format: username#discriminator or just username)
            const username = fullName.includes('#') ? fullName.split('#')[0] : fullName;
            const nickname = messageData.details.authorDisplayName || null;
            
            try {
                // Get or create user in Users table
                let { data: existingUser, error: selectError } = await supabase
                    .from('Users')
                    .select('*')
                    .eq('discord_id', discordId)
                    .single();

                if (selectError && selectError.code !== 'PGRST116') {
                    console.error('Error checking existing user:', selectError);
                } else if (!existingUser) {
                    // Create new user
                    const { data: newUser, error: insertError } = await supabase
                        .from('Users')
                        .insert({
                            discord_id: discordId,
                            nickname: nickname,
                            username: username,
                            score: 0
                        })
                        .select()
                        .single();
                        
                    if (insertError) {
                        console.error('Error creating user:', insertError);
                    } else {
                        console.log(`✅ User created for message: ${username} (${discordId})`);
                        userId = newUser.id;
                    }
                } else {
                    console.log(`✅ User exists for message: ${username} (${discordId})`);
                    userId = existingUser.id;
                }
            } catch (userError) {
                console.error('❌ Error processing user for message:', userError);
            }
        }

        // Process data according to actual table schema
        let processedData;
        if (table === 'Suggestions') {
            // Clean post_name by removing _숫자 suffix (e.g., "테스트 6.24_1387054729791668426" -> "테스트 6.24")
            let cleanPostName = messageData.post_name || 'Untitled';
            if (cleanPostName !== 'Untitled') {
                cleanPostName = cleanPostName.replace(/_\d+$/, '');
            }
            
            // Generate message_link if we have the required IDs (ensure they're strings for precision)
            let messageLink: string | null = null;
            if (messageData.details?.guildId && messageData.details?.channelId && messageData.details?.messageId) {
                const guildIdStr = messageData.details.guildId.toString();
                const channelIdStr = messageData.details.channelId.toString();
                const messageIdStr = messageData.details.messageId.toString();
                messageLink = `https://discord.com/channels/${guildIdStr}/${channelIdStr}/${messageIdStr}`;
            } else if (messageData.details?.messageLink) {
                messageLink = messageData.details.messageLink;
            }
            
            console.log('🔗 Message sync link processing:', {
                guildId: messageData.details?.guildId,
                channelId: messageData.details?.channelId, 
                messageId: messageData.details?.messageId,
                providedLink: messageData.details?.messageLink,
                generatedLink: messageLink
            });
            
            // Suggestions table schema: id, post_name, content, user, post_id, message_id, message_link, created_at
            processedData = {
                post_name: cleanPostName,
                content: messageData.content || '',
                user: userId, // FK reference to Users table
                post_id: messageData.details?.postId?.toString() || null,
                message_id: messageData.details?.messageId?.toString() || null,
                message_link: messageLink,
                created_at: messageData.created_at || new Date().toISOString()
            };
        }

        const { data, error } = await supabase
            .from(table)
            .insert(processedData)
            .select();

        if (error) {
            console.error(`Error syncing message to ${table}:`, error);
            return res.status(500).json({ error: error.message });
        }

        console.log(`✅ Message synced to ${table}`);
        return res.json({ success: true, data: data[0] });
    } catch (error) {
        console.error('Error in message sync:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}));

export default router;