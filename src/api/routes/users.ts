import { Router } from 'express';
import { supabase } from '../../shared/utils/supabase.js';
import { UserService } from '../../core/services/UserService.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';

const router = Router();

// User score endpoint
router.post('/score', asyncHandler(async (req, res) => {
    try {
        const { nickname, username, discord_id, score, scored_at, scored_by, avatar_url } = req.body;
        
        // Ensure discord_id is treated as string to preserve precision
        const discordIdStr = discord_id?.toString();
        
        if (!username || !discordIdStr || typeof score !== 'number' || !scored_at || !scored_by) {
            return res.status(400).json({ error: 'Missing required fields: username, discord_id, score, scored_at, scored_by' });
        }

        // Get or create user in Users table
        // Users table schema: id, nickname, username, score, discord_id, created_at
        let { data: existingUser, error: selectError } = await supabase
            .from('Users')
            .select('*')
            .eq('discord_id', discordIdStr)
            .single();

        let userId;
        let currentScore = 0;

        if (selectError && selectError.code !== 'PGRST116') {
            console.error('Error checking existing user:', selectError);
            return res.status(500).json({ error: 'Database error while checking user' });
        } else if (!existingUser) {
            // Create new user
            const { data: newUser, error: insertError } = await supabase
                .from('Users')
                .insert({
                    discord_id: discordIdStr,
                    nickname: nickname || null,
                    username: username,
                    score: score
                })
                .select()
                .single();
                
            if (insertError) {
                console.error('Error creating user:', insertError);
                return res.status(500).json({ error: 'Failed to create user' });
            }
            
            userId = newUser.id;
            currentScore = score;
            console.log(`✅ New user created: ${username} (${discordIdStr}) with initial score: ${score}`);
        } else {
            // Update existing user's score
            userId = existingUser.id;
            currentScore = existingUser.score + score;
            
            const { error: updateError } = await supabase
                .from('Users')
                .update({
                    nickname: nickname,
                    username: username,
                    score: currentScore
                })
                .eq('id', userId);
                
            if (updateError) {
                console.error('Error updating user score:', updateError);
                return res.status(500).json({ error: 'Failed to update user score' });
            }
            
            console.log(`✅ User score updated: ${username} (${existingUser.score} + ${score} = ${currentScore})`);
        }

        // Record the score change in Logs table
        // Logs table schema: id, user, score_change, score, action, channel, post, content, changed_at, message_link
        const { error: logError } = await supabase
            .from('Logs')
            .insert({
                user: userId, // FK reference to Users table
                score_change: score,
                score: currentScore,
                action: score > 0 ? 'message_created' : 'message_deleted', // English action description
                channel: scored_by.channel || null,
                post: scored_by.post_name || null,
                content: scored_by.message_content || null,
                message_link: scored_by.message_link || null,
                changed_at: new Date(scored_at).toISOString()
            });
            
        if (logError) {
            console.error('❌ Error logging score change:', logError);
            // Don't fail the request if logging fails
        } else {
            console.log(`📝 Score change logged for user: ${username}`);
        }

        console.log(`📊 Score processed for user: ${username} (Discord ID: ${discordIdStr}, Score Change: ${score})`);

        return res.json({ 
            success: true, 
            user: {
                id: userId,
                discord_id: discordIdStr,
                nickname: nickname,
                username: username,
                score: currentScore
            }
        });
    } catch (error) {
        console.error('Error in user score endpoint:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}));

// Get active users endpoint
router.get('/', asyncHandler(async (req, res) => {
    try {
        const limit = parseInt(req.query.limit as string) || 50;
        
        const { data, error } = await supabase
            .from('Users')
            .select('*')
            .order('score', { ascending: false })
            .limit(limit);

        if (error) {
            console.error('Error fetching users:', error);
            return res.status(500).json({ error: error.message });
        }

        return res.json({ success: true, users: data });
    } catch (error) {
        console.error('Error in get users endpoint:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}));

// Get specific user endpoint
router.get('/:discordId', asyncHandler(async (req, res) => {
    try {
        const { discordId } = req.params;
        
        const { data, error } = await supabase
            .from('Users')
            .select('*')
            .eq('discord_id::text', discordId.toString())
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return res.status(404).json({ error: 'User not found' });
            }
            console.error('Error fetching user:', error);
            return res.status(500).json({ error: error.message });
        }

        return res.json({ success: true, user: data });
    } catch (error) {
        console.error('Error in get user endpoint:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}));

// Trigger user sync endpoint
router.post('/sync', asyncHandler(async (req, res) => {
    try {
        // This would typically trigger a sync operation
        // Implementation depends on your sync requirements
        return res.json({ success: true, message: 'User sync triggered' });
    } catch (error) {
        console.error('Error in user sync endpoint:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}));

export default router;