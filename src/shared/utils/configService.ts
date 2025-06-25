import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface ForumChannelConfig {
  id: string;
  name: string;
  table: string;
  score: number;
  enabled?: boolean;
  channel_id?: string;
  todo?: boolean;
  github_sync?: boolean;
}

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

// Legacy functions for backward compatibility
export async function migrateForumConfigToDatabase(configPath: string): Promise<void> {
  try {
    // Read the JSON config file
    const configData = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    
    // Store each top-level config key as a separate record
    for (const [key, value] of Object.entries(configData)) {
      await prisma.forumConfig.upsert({
        where: { key },
        update: { value: JSON.stringify(value), updatedAt: new Date() },
        create: {
          key,
          value: JSON.stringify(value),
          description: `Migrated from forum-config.json - ${key} configuration`
        }
      });
    }
    
    console.log('✅ Forum config migrated to database successfully');
  } catch (error) {
    console.error('❌ Error migrating forum config:', error);
    console.log('⚠️  Using fallback: JSON file config');
    throw error;
  }
}

export async function getForumConfig(): Promise<any> {
  try {
    // First try to get from Supabase Forums table
    return await getForumConfigFromSupabase();
  } catch (supabaseError) {
    console.log('⚠️  Supabase Forums table not available, trying local database...');
    
    try {
      const configs = await prisma.forumConfig.findMany();
      const configObject: any = {};
      
      for (const config of configs) {
        try {
          configObject[config.key] = JSON.parse(config.value);
        } catch {
          configObject[config.key] = config.value;
        }
      }
      
      return configObject;
    } catch (error) {
      console.error('Error getting forum config:', error);
      throw error;
    }
  }
}

export async function updateForumConfig(key: string, value: any, description?: string): Promise<void> {
  try {
    await prisma.forumConfig.upsert({
      where: { key },
      update: { value: JSON.stringify(value), updatedAt: new Date(), description },
      create: { key, value: JSON.stringify(value), description }
    });
    
    console.log(`✅ Forum config updated: ${key}`);
  } catch (error) {
    console.error(`Error updating forum config ${key}:`, error);
    throw error;
  }
}