import { PrismaClient } from '@prisma/client';
import { supabase } from '../../shared/utils/supabase.js';
import { CreateUserRequest, UserResponse } from '../../shared/types/api.js';
import { ensureDiscordIdString } from '../../api/middlewares/validation.js';

const prisma = new PrismaClient();

export interface CreateUserData {
  discordId: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
}

export interface ScoreData {
  score: number;
  postName?: string;
  messageContent?: string;
  messageLink?: string;
  scoredAt: Date;
}

/**
 * Unified User Service that handles both Prisma and Supabase operations
 * with fallback mechanism for reliability
 */
export class UserService {
  /**
   * Get or create user using Prisma with Supabase fallback
   */
  static async getOrCreateUser(userData: CreateUserData): Promise<{ 
    id: string; 
    discordId: string; 
    username: string; 
    displayName?: string | null; 
    avatarUrl?: string | null 
  }> {
    try {
      // Try to find existing user
      const existingUser = await prisma.user.findUnique({
        where: { discordId: userData.discordId }
      });

      if (existingUser) {
        // Update user info if it has changed
        const updatedUser = await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            username: userData.username,
            displayName: userData.displayName,
            avatarUrl: userData.avatarUrl,
            updatedAt: new Date()
          }
        });
        return updatedUser;
      }

      // Create new user
      const newUser = await prisma.user.create({
        data: {
          discordId: userData.discordId,
          username: userData.username,
          displayName: userData.displayName,
          avatarUrl: userData.avatarUrl
        }
      });

      console.log(`✅ Created new user: ${userData.username} (${userData.discordId})`);
      return newUser;
    } catch (error) {
      console.error('❌ Prisma user operation failed, trying Supabase fallback:', error);
      throw error;
    }
  }

  /**
   * Add score to user using Prisma with Supabase fallback
   */
  static async addScoreToUser(userId: string, scoreData: ScoreData): Promise<void> {
    try {
      await prisma.scoreHistory.create({
        data: {
          userId,
          score: scoreData.score,
          postName: scoreData.postName,
          messageContent: scoreData.messageContent,
          messageLink: scoreData.messageLink,
          scoredAt: scoreData.scoredAt
        }
      });
      console.log(`✅ Added score ${scoreData.score} to user ${userId}`);
    } catch (error) {
      console.error('❌ Error adding score to user:', error);
      throw error;
    }
  }

  /**
   * Get user's total score
   */
  static async getUserTotalScore(userId: string): Promise<number> {
    try {
      const result = await prisma.scoreHistory.aggregate({
        where: { userId },
        _sum: { score: true }
      });
      return result._sum.score || 0;
    } catch (error) {
      console.error('❌ Error getting user total score:', error);
      return 0;
    }
  }

  /**
   * Create or update user score using the new unified approach
   */
  static async createOrUpdateUserScore(userData: CreateUserRequest): Promise<UserResponse> {
    const discordIdStr = ensureDiscordIdString(userData.discord_id);
    
    try {
      // Try using the new User table first
      const user = await this.getOrCreateUser({
        discordId: discordIdStr,
        username: userData.name,
        displayName: userData.name,
        avatarUrl: userData.avatar_url
      });

      await this.addScoreToUser(user.id, {
        score: userData.score,
        postName: userData.scored_by.post_name,
        messageContent: userData.scored_by.message_content,
        messageLink: userData.scored_by.message_link,
        scoredAt: new Date(userData.scored_at)
      });

      return {
        id: user.id,
        discord_id: user.discordId,
        name: user.username
      };
    } catch (dbError) {
      console.error('❌ Database error, falling back to Supabase:', dbError);
      return await this.fallbackSupabaseUserOperation(userData, discordIdStr);
    }
  }

  /**
   * Fallback to Supabase when Prisma fails
   */
  private static async fallbackSupabaseUserOperation(userData: CreateUserRequest, discordIdStr: string): Promise<UserResponse> {
    const { data: existingUser, error: selectError } = await supabase
      .from('Users')
      .select('*')
      .eq('discord_id::text', discordIdStr)
      .single();

    if (selectError && selectError.code !== 'PGRST116') {
      throw new Error(`Database select failed: ${selectError.message}`);
    }

    const currentScore = existingUser?.score || 0;
    const currentLogs = existingUser?.scored_by || [];
    
    const newLogEntry = {
      score: userData.score,
      scored_at: userData.scored_at,
      post_name: userData.scored_by.post_name,
      message_content: userData.scored_by.message_content,
      message_link: userData.scored_by.message_link
    };

    if (existingUser) {
      const { data, error } = await supabase
        .from('Users')
        .update({
          name: userData.name,
          score: currentScore + userData.score,
          scored_by: [...currentLogs, newLogEntry]
        })
        .eq('discord_id::text', discordIdStr)
        .select();

      if (error) {
        throw new Error(`Database update failed: ${error.message}`);
      }

      return data[0];
    } else {
      const { data, error } = await supabase
        .from('Users')
        .insert({
          discord_id: discordIdStr,
          name: userData.name,
          score: userData.score,
          scored_by: [newLogEntry],
          avatar_url: userData.avatar_url
        })
        .select();

      if (error) {
        throw new Error(`Database insert failed: ${error.message}`);
      }

      return data[0];
    }
  }

  /**
   * Get users with pagination
   */
  static async getUsers(limit: number = 50): Promise<UserResponse[]> {
    const { data, error } = await supabase
      .from('Users')
      .select('*')
      .order('score', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to fetch users: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get user by Discord ID
   */
  static async getUserByDiscordId(discordId: string): Promise<UserResponse | null> {
    const discordIdStr = ensureDiscordIdString(discordId);
    
    const { data, error } = await supabase
      .from('Users')
      .select('*')
      .eq('discord_id::text', discordIdStr)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // User not found
      }
      throw new Error(`Failed to fetch user: ${error.message}`);
    }

    return data;
  }

  /**
   * Trigger user synchronization
   */
  static async triggerUserSync(): Promise<void> {
    console.log('🔄 User sync triggered');
    // Implementation depends on your sync requirements
  }
}