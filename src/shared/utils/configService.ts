import { supabase } from './supabase.js';
import { ForumChannelConfig } from '../types/common.js';

export async function getForumChannelsFromSupabase(): Promise<ForumChannelConfig[]> {
  try {
    const { data, error } = await supabase
      .from('Forums')
      .select('id, name, table_name, score, github_sync, channel_id::text, todo')
      .eq('todo', true); // Use 'todo' field instead of 'enabled'

    if (error) {
      console.error('❌ Error fetching forums from Supabase:', error);
      throw error;
    }

    // Map the database fields to our interface
    const mappedData = data?.map(forum => ({
      id: forum.channel_id?.toString() || '', // Use channel_id as the Discord channel ID
      name: forum.name,
      table: forum.table_name, // Use table_name field
      score: forum.score,
      enabled: forum.todo, // Use todo field as enabled
      channel_id: forum.channel_id?.toString(),
      todo: forum.todo,
      github_sync: forum.github_sync || false
    })) || [];
    console.log(`✅ Loaded ${mappedData.length} forum channels from Supabase`);
    return mappedData;
  } catch (error) {
    console.error('❌ Error loading forum channels from Supabase:', error);
    throw error;
  }
}

export async function getForumConfigFromSupabase(): Promise<any> {
  try {
    const forumChannels = await getForumChannelsFromSupabase();
    
    // Convert to the expected format
    const config = {
      monitoring: {
        enabled: true,
        forumChannels: forumChannels.map(channel => ({
          id: channel.id,
          name: channel.name,
          table: channel.table,
          score: channel.score,
          github_sync: channel.github_sync || false
        }))
      },
      settings: {
        maxMessageLength: 1000,
        checkDelay: 1000
      },
      supabase: {
        enabled: true,
        serverUrl: 'http://localhost:3000'
      },
      github: {
        enabled: !!(process.env.GITHUB_TOKEN && process.env.GITHUB_REPOSITORY),
        token: process.env.GITHUB_TOKEN,
        repository: process.env.GITHUB_REPOSITORY
      }
    };

    return config;
  } catch (error) {
    console.error('Error getting forum config from Supabase:', error);
    throw error;
  }
}

// Legacy function - deprecated, keeping for reference only
// Forum configuration is now managed entirely through Supabase Forums table

export async function getForumConfig(): Promise<any> {
  try {
    // Use Supabase Forums table as the single source of truth
    return await getForumConfigFromSupabase();
  } catch (supabaseError) {
    console.error('❌ Failed to load forum config from Supabase:', supabaseError);
    console.log('💡 Please ensure Supabase Forums table is properly configured');
    throw supabaseError;
  }
}

// Legacy function - forum config updates should be done through Supabase Forums table directly
// This function is no longer used as configuration is managed through the Forums table