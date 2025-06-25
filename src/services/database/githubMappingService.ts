import { supabase } from '../../shared/utils/supabase.js';

interface GitHubMapping {
  id?: string;
  discord_thread_id?: string;
  discord_message_id?: string;
  github_issue_number?: number;
  github_comment_id?: number;
  mapping_type: 'issue' | 'comment';
  created_at?: string;
  updated_at?: string;
}

/**
 * Service for managing GitHub-Discord mappings in Supabase
 * Replaces the file-based storage system
 */
export class GitHubMappingService {
  
  /**
   * Get GitHub issue number for a Discord thread
   */
  static async getIssueNumber(threadId: string): Promise<number | undefined> {
    try {
      const { data, error } = await supabase
        .from('GitHubMappings')
        .select('github_issue_number')
        .eq('discord_thread_id', threadId)
        .eq('mapping_type', 'issue')
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return undefined; // No mapping found
        }
        throw error;
      }

      return data?.github_issue_number;
    } catch (error) {
      console.error(`❌ Error getting issue number for thread ${threadId}:`, error);
      return undefined;
    }
  }

  /**
   * Set Discord thread to GitHub issue mapping
   */
  static async setIssueMapping(threadId: string, issueNumber: number): Promise<void> {
    try {
      const { error } = await supabase
        .from('GitHubMappings')
        .upsert({
          discord_thread_id: threadId,
          github_issue_number: issueNumber,
          mapping_type: 'issue'
        });

      if (error) {
        throw error;
      }

      console.log(`📝 [DB] 이슈 매핑 저장: 스레드 ${threadId} -> 이슈 #${issueNumber}`);
    } catch (error) {
      console.error(`❌ Error setting issue mapping:`, error);
      throw error;
    }
  }

  /**
   * Delete Discord thread to GitHub issue mapping
   */
  static async deleteIssueMapping(threadId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('GitHubMappings')
        .delete()
        .eq('discord_thread_id', threadId)
        .eq('mapping_type', 'issue');

      if (error) {
        throw error;
      }

      console.log(`🗑️ [DB] 이슈 매핑 삭제: 스레드 ${threadId}`);
    } catch (error) {
      console.error(`❌ Error deleting issue mapping:`, error);
      throw error;
    }
  }

  /**
   * Get GitHub comment ID for a Discord message
   */
  static async getCommentId(messageId: string): Promise<number | undefined> {
    try {
      const { data, error } = await supabase
        .from('GitHubMappings')
        .select('github_comment_id')
        .eq('discord_message_id', messageId)
        .eq('mapping_type', 'comment')
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return undefined; // No mapping found
        }
        throw error;
      }

      return data?.github_comment_id;
    } catch (error) {
      console.error(`❌ Error getting comment ID for message ${messageId}:`, error);
      return undefined;
    }
  }

  /**
   * Set Discord message to GitHub comment mapping
   */
  static async setCommentMapping(messageId: string, commentId: number): Promise<void> {
    try {
      const { error } = await supabase
        .from('GitHubMappings')
        .upsert({
          discord_message_id: messageId,
          github_comment_id: commentId,
          mapping_type: 'comment'
        });

      if (error) {
        throw error;
      }

      console.log(`📝 [DB] 댓글 매핑 저장: 메시지 ${messageId} -> 댓글 #${commentId}`);
    } catch (error) {
      console.error(`❌ Error setting comment mapping:`, error);
      throw error;
    }
  }

  /**
   * Delete Discord message to GitHub comment mapping
   */
  static async deleteCommentMapping(messageId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('GitHubMappings')
        .delete()
        .eq('discord_message_id', messageId)
        .eq('mapping_type', 'comment');

      if (error) {
        throw error;
      }

      console.log(`🗑️ [DB] 댓글 매핑 삭제: 메시지 ${messageId}`);
    } catch (error) {
      console.error(`❌ Error deleting comment mapping:`, error);
      throw error;
    }
  }

  /**
   * Get statistics about mappings
   */
  static async getStats(): Promise<{
    issueCount: number;
    commentCount: number;
  }> {
    try {
      const [issueResult, commentResult] = await Promise.all([
        supabase
          .from('GitHubMappings')
          .select('id', { count: 'exact' })
          .eq('mapping_type', 'issue'),
        supabase
          .from('GitHubMappings')
          .select('id', { count: 'exact' })
          .eq('mapping_type', 'comment')
      ]);

      return {
        issueCount: issueResult.count || 0,
        commentCount: commentResult.count || 0
      };
    } catch (error) {
      console.error(`❌ Error getting mapping stats:`, error);
      return { issueCount: 0, commentCount: 0 };
    }
  }

  /**
   * Migrate data from file storage to database
   */
  static async migrateFromFileStorage(fileStorage: any): Promise<void> {
    try {
      console.log('🔄 [MIGRATION] GitHub 매핑 데이터를 파일에서 데이터베이스로 마이그레이션 시작...');

      // Get existing mappings from file storage
      const stats = fileStorage.getStats();
      console.log(`📊 [MIGRATION] 마이그레이션할 데이터: 이슈 ${stats.issueCount}개, 댓글 ${stats.commentCount}개`);

      // Migrate issue mappings
      const issueMappings = fileStorage.getIssueMappingEntries();
      for (const [threadId, issueNumber] of issueMappings) {
        await this.setIssueMapping(threadId, issueNumber);
      }

      // Migrate comment mappings  
      const commentMappings = fileStorage.getCommentMappingEntries();
      for (const [messageId, commentId] of commentMappings) {
        await this.setCommentMapping(messageId, commentId);
      }

      console.log('✅ [MIGRATION] GitHub 매핑 데이터 마이그레이션 완료');
    } catch (error) {
      console.error('❌ [MIGRATION] GitHub 매핑 데이터 마이그레이션 실패:', error);
      throw error;
    }
  }

  /**
   * Clean up old mappings (older than specified days)
   */
  static async cleanupOldEntries(daysOld: number = 30): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const { error } = await supabase
        .from('GitHubMappings')
        .delete()
        .lt('created_at', cutoffDate.toISOString());

      if (error) {
        throw error;
      }

      console.log(`🧹 [DB] ${daysOld}일 이상 된 GitHub 매핑 정리 완료`);
    } catch (error) {
      console.error(`❌ Error cleaning up old mappings:`, error);
      throw error;
    }
  }
}