import { Router } from 'express';
import { supabase } from '../../shared/utils/supabase.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';

const router = Router();

// Get forums endpoint
router.get('/', asyncHandler(async (_, res) => {
    try {
        const { data, error } = await supabase
            .from('Forums')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching forums:', error);
            return res.status(500).json({ error: error.message });
        }

        return res.json({ forums: data });
    } catch (error) {
        console.error('Error in get forums endpoint:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}));

// Get forum posts endpoint
router.get('/:channelId/posts', asyncHandler(async (req, res) => {
    try {
        const { channelId } = req.params;
        const { limit = '50', offset = '0' } = req.query;

        // Find which table this channel corresponds to
        const { data: forumConfig, error: configError } = await supabase
            .from('Forums')
            .select('table_name')
            .eq('channel_id::text', channelId.toString())
            .single();

        if (configError || !forumConfig) {
            return res.status(404).json({ error: 'Forum channel not found' });
        }

        // Get posts from the corresponding table
        const { data: posts, error: postsError } = await supabase
            .from(forumConfig.table_name)
            .select('*')
            .order('created_at', { ascending: false })
            .range(parseInt(offset as string), parseInt(offset as string) + parseInt(limit as string) - 1);

        if (postsError) {
            console.error('Error fetching posts:', postsError);
            return res.status(500).json({ error: postsError.message });
        }

        return res.json({ posts: posts || [] });
    } catch (error) {
        console.error('Error in get forum posts endpoint:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}));

// Get post messages endpoint
router.get('/posts/:postId/messages', asyncHandler(async (req, res) => {
    try {
        const { postId } = req.params;

        // This would need to be implemented based on your message storage structure
        // For now, return empty array
        return res.json({ messages: [] });
    } catch (error) {
        console.error('Error in get post messages endpoint:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}));

// Get Supabase forums endpoint
router.get('/supabase', asyncHandler(async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('Forums')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching Supabase forums:', error);
            return res.status(500).json({ error: error.message });
        }

        return res.json({ success: true, forums: data });
    } catch (error) {
        console.error('Error in get Supabase forums endpoint:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}));

// Create Supabase forum endpoint
router.post('/supabase', asyncHandler(async (req, res) => {
    try {
        const { name, channel_id, table_name, score, todo } = req.body;
        
        // Ensure channel_id is treated as string to preserve precision
        const channelIdStr = channel_id?.toString();
        
        if (!name || !channelIdStr || !table_name || score === undefined) {
            return res.status(400).json({ 
                error: 'Missing required fields: name, channel_id, table_name, score' 
            });
        }

        const { data, error } = await supabase
            .from('Forums')
            .insert({
                name,
                channel_id: channelIdStr, // Keep as string to preserve precision
                table_name,
                score: parseInt(score),
                todo: todo || false
            })
            .select();

        if (error) {
            console.error('Error creating forum:', error);
            return res.status(500).json({ error: error.message });
        }

        console.log(`✅ Forum created: ${name} (${channelIdStr})`);
        return res.json({ success: true, data: data[0] });
    } catch (error) {
        console.error('Error creating forum:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}));

// Update Supabase forum endpoint
router.patch('/supabase/:id', asyncHandler(async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        
        // Ensure channel_id in updates is treated as string if present
        if (updates.channel_id) {
            updates.channel_id = updates.channel_id.toString();
        }

        const { data, error } = await supabase
            .from('Forums')
            .update(updates)
            .eq('id', id)
            .select();

        if (error) {
            console.error('Error updating forum:', error);
            return res.status(500).json({ error: error.message });
        }

        console.log(`✅ Forum updated: ${id}`);
        return res.json({ success: true, data: data[0] });
    } catch (error) {
        console.error('Error updating forum:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}));

// Delete Supabase forum endpoint
router.delete('/supabase/:id', asyncHandler(async (req, res) => {
    try {
        const { id } = req.params;

        const { error } = await supabase
            .from('Forums')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting forum:', error);
            return res.status(500).json({ error: error.message });
        }

        console.log(`✅ Forum deleted: ${id}`);
        return res.json({ success: true });
    } catch (error) {
        console.error('Error deleting forum:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}));

export default router;