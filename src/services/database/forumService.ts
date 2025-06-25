import { supabase } from '../../shared/utils/supabase.js';
import { CreateForumRequest, ForumResponse } from '../../shared/types/api.js';
import { ensureDiscordIdString } from '../../api/middlewares/validation.js';

export class ForumService {
    static async getForums(): Promise<ForumResponse[]> {
        const { data, error } = await supabase
            .from('Forums')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            throw new Error(`Failed to fetch forums: ${error.message}`);
        }

        return data || [];
    }

    static async getForumPosts(channelId: string, limit: number = 50, offset: number = 0): Promise<any[]> {
        const channelIdStr = ensureDiscordIdString(channelId);

        // Find which table this channel corresponds to
        const { data: forumConfig, error: configError } = await supabase
            .from('Forums')
            .select('table_name')
            .eq('channel_id::text', channelIdStr)
            .single();

        if (configError || !forumConfig) {
            throw new Error('Forum channel not found');
        }

        // Get posts from the corresponding table
        const { data: posts, error: postsError } = await supabase
            .from(forumConfig.table_name)
            .select('*')
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (postsError) {
            throw new Error(`Failed to fetch posts: ${postsError.message}`);
        }

        return posts || [];
    }

    static async getPostMessages(postId: string): Promise<any[]> {
        // This would need to be implemented based on your message storage structure
        return [];
    }

    static async createForum(forumData: CreateForumRequest): Promise<ForumResponse> {
        const channelIdStr = ensureDiscordIdString(forumData.channel_id);
        
        const { data, error } = await supabase
            .from('Forums')
            .insert({
                name: forumData.name,
                channel_id: channelIdStr,
                table_name: forumData.table_name,
                score: parseInt(forumData.score.toString()),
                todo: forumData.todo || false,
                github_sync: forumData.github_sync || false
            })
            .select();

        if (error) {
            throw new Error(`Failed to create forum: ${error.message}`);
        }

        return data[0];
    }

    static async updateForum(id: string, updates: Partial<CreateForumRequest>): Promise<ForumResponse> {
        // Ensure channel_id in updates is treated as string if present
        if (updates.channel_id) {
            updates.channel_id = ensureDiscordIdString(updates.channel_id);
        }

        const { data, error } = await supabase
            .from('Forums')
            .update(updates)
            .eq('id', id)
            .select();

        if (error) {
            throw new Error(`Failed to update forum: ${error.message}`);
        }

        return data[0];
    }

    static async deleteForum(id: string): Promise<void> {
        const { error } = await supabase
            .from('Forums')
            .delete()
            .eq('id', id);

        if (error) {
            throw new Error(`Failed to delete forum: ${error.message}`);
        }
    }
}