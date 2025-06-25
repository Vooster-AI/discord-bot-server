import { GitHubMappingService } from '../database/githubMappingService.js';
import { FileStorage } from './fileStorage.js';

export class MappingManager {
    private legacyStorage: FileStorage;
    private migrated: boolean = false;

    constructor() {
        this.legacyStorage = new FileStorage('github-mappings.json');
        this.ensureMigration();
    }

    private async ensureMigration(): Promise<void> {
        if (this.migrated) return;
        
        try {
            // Check if we have data in legacy storage that needs migration
            const stats = this.legacyStorage.getStats();
            if (stats.issueCount > 0 || stats.commentCount > 0) {
                console.log('🔄 [MIGRATION] Legacy GitHub mappings detected, migrating to database...');
                await GitHubMappingService.migrateFromFileStorage(this.legacyStorage);
            }
            this.migrated = true;
        } catch (error) {
            console.error('❌ [MIGRATION] Failed to migrate GitHub mappings:', error);
            // Continue with legacy storage as fallback
        }
    }

    public async getIssueNumber(threadId: string): Promise<number | undefined> {
        try {
            await this.ensureMigration();
            return await GitHubMappingService.getIssueNumber(threadId);
        } catch (error) {
            console.error('❌ Error getting issue number from database, falling back to file storage:', error);
            return this.legacyStorage.getIssueNumber(threadId);
        }
    }

    public async setIssueMapping(threadId: string, issueNumber: number): Promise<void> {
        try {
            await this.ensureMigration();
            await GitHubMappingService.setIssueMapping(threadId, issueNumber);
        } catch (error) {
            console.error('❌ Error setting issue mapping in database, falling back to file storage:', error);
            this.legacyStorage.setIssueMapping(threadId, issueNumber);
        }
    }

    public async deleteIssueMapping(threadId: string): Promise<void> {
        try {
            await this.ensureMigration();
            await GitHubMappingService.deleteIssueMapping(threadId);
        } catch (error) {
            console.error('❌ Error deleting issue mapping from database, falling back to file storage:', error);
            this.legacyStorage.deleteIssueMapping(threadId);
        }
    }

    public async getCommentId(messageId: string): Promise<number | undefined> {
        try {
            await this.ensureMigration();
            return await GitHubMappingService.getCommentId(messageId);
        } catch (error) {
            console.error('❌ Error getting comment ID from database, falling back to file storage:', error);
            return this.legacyStorage.getCommentId(messageId);
        }
    }

    public async setCommentMapping(messageId: string, commentId: number): Promise<void> {
        try {
            await this.ensureMigration();
            await GitHubMappingService.setCommentMapping(messageId, commentId);
            console.log(`📝 [GITHUB DEBUG] 댓글 매핑 저장: 메시지 ${messageId} -> 댓글 ${commentId}`);
        } catch (error) {
            console.error('❌ Error setting comment mapping in database, falling back to file storage:', error);
            this.legacyStorage.setCommentMapping(messageId, commentId);
            console.log(`📝 [GITHUB DEBUG] 댓글 매핑 저장: 메시지 ${messageId} -> 댓글 ${commentId}`);
        }
    }

    public async deleteCommentMapping(messageId: string): Promise<void> {
        try {
            await this.ensureMigration();
            await GitHubMappingService.deleteCommentMapping(messageId);
        } catch (error) {
            console.error('❌ Error deleting comment mapping from database, falling back to file storage:', error);
            this.legacyStorage.deleteCommentMapping(messageId);
        }
    }

    public async getCommentMappingStats() {
        try {
            await this.ensureMigration();
            const stats = await GitHubMappingService.getStats();
            return {
                total: stats.commentCount,
                entries: [] // Could implement getEntries in GitHubMappingService if needed
            };
        } catch (error) {
            console.error('❌ Error getting comment mapping stats from database, falling back to file storage:', error);
            const stats = this.legacyStorage.getStats();
            return {
                total: stats.commentCount,
                entries: this.legacyStorage.getCommentMappingEntries()
            };
        }
    }

    public async logCommentMappingDebug(messageId: string): Promise<void> {
        try {
            await this.ensureMigration();
            const commentId = await GitHubMappingService.getCommentId(messageId);
            const stats = await GitHubMappingService.getStats();
            
            console.log(`🔍 [GITHUB DEBUG] 현재 댓글 매핑 상태 (데이터베이스):`);
            console.log(`🔍 [GITHUB DEBUG] - 찾는 메시지 ID: ${messageId}`);
            console.log(`🔍 [GITHUB DEBUG] - 매핑된 댓글 ID: ${commentId || 'None'}`);
            console.log(`🔍 [GITHUB DEBUG] - 전체 댓글 매핑 수: ${stats.commentCount}`);
        } catch (error) {
            console.error('❌ Error getting debug info from database, falling back to file storage:', error);
            const commentId = this.legacyStorage.getCommentId(messageId);
            const stats = this.legacyStorage.getStats();
            
            console.log(`🔍 [GITHUB DEBUG] 현재 댓글 매핑 상태 (파일):`);
            console.log(`🔍 [GITHUB DEBUG] - 찾는 메시지 ID: ${messageId}`);
            console.log(`🔍 [GITHUB DEBUG] - 매핑된 댓글 ID: ${commentId || 'None'}`);
            console.log(`🔍 [GITHUB DEBUG] - 전체 댓글 매핑 수: ${stats.commentCount}`);
            
            const mappingEntries = this.legacyStorage.getCommentMappingEntries();
            mappingEntries.forEach(([msgId, cmtId]) => {
                console.log(`🔍 [GITHUB DEBUG] - 매핑: ${msgId} -> ${cmtId}`);
            });
        }
    }

    public async getStats() {
        try {
            await this.ensureMigration();
            return await GitHubMappingService.getStats();
        } catch (error) {
            console.error('❌ Error getting stats from database, falling back to file storage:', error);
            return this.legacyStorage.getStats();
        }
    }

    public forceSave(): void {
        // Database operations are immediately persisted, but keep for compatibility
        this.legacyStorage.forceSave();
    }

    public async cleanupOldEntries(daysOld: number = 30): Promise<void> {
        try {
            await this.ensureMigration();
            await GitHubMappingService.cleanupOldEntries(daysOld);
        } catch (error) {
            console.error('❌ Error cleaning up entries in database, falling back to file storage:', error);
            this.legacyStorage.cleanupOldEntries(daysOld);
        }
    }

    public async getAllMappings() {
        try {
            await this.ensureMigration();
            const stats = await GitHubMappingService.getStats();
            return {
                issues: [], // Could implement getEntries in GitHubMappingService if needed
                comments: [], // Could implement getEntries in GitHubMappingService if needed
                stats: stats
            };
        } catch (error) {
            console.error('❌ Error getting all mappings from database, falling back to file storage:', error);
            const stats = this.legacyStorage.getStats();
            return {
                issues: this.legacyStorage.getIssueMappingEntries(),
                comments: this.legacyStorage.getCommentMappingEntries(),
                stats: stats
            };
        }
    }
}