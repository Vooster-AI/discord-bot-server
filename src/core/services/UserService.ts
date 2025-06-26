import { supabase } from '../../shared/utils/supabase.js';
import { CreateUserRequest, UserResponse } from '../../shared/types/api.js';
import { CreateUserData, ScoreData } from '../../shared/types/common.js';
import { ensureDiscordIdString } from '../../api/middlewares/validation.js';

/**
 * Unified User Service that handles both Prisma and Supabase operations
 * with fallback mechanism for reliability
 */
export class UserService {
  /**
   * Get or create user using Supabase only
   */
  static async getOrCreateUser(userData: CreateUserData): Promise<{ 
    id: string; 
    discordId: string; 
    username: string; 
    displayName?: string | null; 
    avatarUrl?: string | null 
  }> {
    try {
      // Try to find existing user in Supabase
      const { data: existingUser, error: selectError } = await supabase
        .from('Users')
        .select('*')
        .eq('discord_id::text', userData.discordId)
        .single();

      if (selectError && selectError.code !== 'PGRST116') {
        throw new Error(`Database select failed: ${selectError.message}`);
      }

      if (existingUser) {
        // Update user info if it has changed
        const { data: updatedUser, error: updateError } = await supabase
          .from('Users')
          .update({
            name: userData.username,
            avatar_url: userData.avatarUrl
          })
          .eq('discord_id::text', userData.discordId)
          .select()
          .single();

        if (updateError) {
          throw new Error(`User update failed: ${updateError.message}`);
        }

        return {
          id: updatedUser.id.toString(),
          discordId: updatedUser.discord_id,
          username: updatedUser.name,
          displayName: updatedUser.name,
          avatarUrl: updatedUser.avatar_url
        };
      }

      // Create new user
      const { data: newUser, error: insertError } = await supabase
        .from('Users')
        .insert({
          discord_id: userData.discordId,
          name: userData.username,
          score: 0,
          scored_by: [],
          avatar_url: userData.avatarUrl
        })
        .select()
        .single();

      if (insertError) {
        throw new Error(`User creation failed: ${insertError.message}`);
      }

      console.log(`✅ Created new user: ${userData.username} (${userData.discordId})`);
      return {
        id: newUser.id.toString(),
        discordId: newUser.discord_id,
        username: newUser.name,
        displayName: newUser.name,
        avatarUrl: newUser.avatar_url
      };
    } catch (error) {
      console.error('❌ Supabase user operation failed:', error);
      throw error;
    }
  }

  /**
   * Add score to user using Supabase only
   */
  static async addScoreToUser(discordId: string, scoreData: ScoreData): Promise<void> {
    try {
      // Get current user data
      const { data: existingUser, error: selectError } = await supabase
        .from('Users')
        .select('*')
        .eq('discord_id::text', discordId)
        .single();

      if (selectError) {
        throw new Error(`Failed to find user: ${selectError.message}`);
      }

      const currentScore = existingUser.score || 0;
      const currentLogs = existingUser.scored_by || [];
      
      const newLogEntry = {
        score: scoreData.score,
        scored_at: scoreData.scoredAt.toISOString(),
        post_name: scoreData.postName,
        message_content: scoreData.messageContent,
        message_link: scoreData.messageLink
      };

      // Update user with new score and log entry
      const { error: updateError } = await supabase
        .from('Users')
        .update({
          score: currentScore + scoreData.score,
          scored_by: [...currentLogs, newLogEntry]
        })
        .eq('discord_id::text', discordId);

      if (updateError) {
        throw new Error(`Score update failed: ${updateError.message}`);
      }

      console.log(`✅ Added score ${scoreData.score} to user ${discordId}`);
    } catch (error) {
      console.error('❌ Error adding score to user:', error);
      throw error;
    }
  }

  /**
   * Reduce score from user using Supabase only
   */
  static async reduceScoreFromUser(discordId: string, scoreReduction: number, reason: string, messageLink?: string): Promise<void> {
    try {
      // Get current user data
      const { data: existingUser, error: selectError } = await supabase
        .from('Users')
        .select('*')
        .eq('discord_id::text', discordId)
        .single();

      if (selectError) {
        if (selectError.code === 'PGRST116') {
          throw new Error('User not found in database');
        }
        throw new Error(`Failed to find user: ${selectError.message}`);
      }

      const currentScore = existingUser.score || 0;
      const newScore = Math.max(0, currentScore - scoreReduction);

      // Update user with reduced score
      const { error: updateError } = await supabase
        .from('Users')
        .update({
          score: newScore
        })
        .eq('discord_id::text', discordId);

      if (updateError) {
        throw new Error(`Score reduction failed: ${updateError.message}`);
      }

      // Log the score change in Logs table
      const { error: logError } = await supabase
        .from('Logs')
        .insert({
          user: existingUser.id,
          score_change: -scoreReduction,
          score: newScore,
          action: reason,
          message_link: messageLink,
          changed_at: new Date().toISOString()
        });

      if (logError) {
        console.error('❌ Error logging score reduction:', logError);
        // Don't fail the request if logging fails
      }

      console.log(`✅ Reduced score ${scoreReduction} from user ${discordId} (${currentScore} -> ${newScore})`);
    } catch (error) {
      console.error('❌ Error reducing score from user:', error);
      throw error;
    }
  }

  /**
   * Get user's total score
   */
  static async getUserTotalScore(discordId: string): Promise<number> {
    try {
      const { data: user, error } = await supabase
        .from('Users')
        .select('score')
        .eq('discord_id::text', discordId)
        .single();

      if (error) {
        console.error('❌ Error getting user total score:', error);
        return 0;
      }

      return user?.score || 0;
    } catch (error) {
      console.error('❌ Error getting user total score:', error);
      return 0;
    }
  }

  /**
   * Create or update user score using Supabase only
   */
  static async createOrUpdateUserScore(userData: CreateUserRequest): Promise<UserResponse> {
    const discordIdStr = ensureDiscordIdString(userData.discord_id);
    
    try {
      // Get or create user
      const user = await this.getOrCreateUser({
        discordId: discordIdStr,
        username: userData.name,
        displayName: userData.name,
        avatarUrl: userData.avatar_url
      });

      // Add score to user
      await this.addScoreToUser(discordIdStr, {
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
    } catch (error) {
      console.error('❌ Failed to create or update user score:', error);
      throw error;
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