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
        
        // Use file storage only - no database migration
        console.log('📁 [STORAGE] Using file-based GitHub mappings storage');
        this.migrated = true;
    }

    public async getIssueNumber(threadId: string): Promise<number | undefined> {
        await this.ensureMigration();
        return this.legacyStorage.getIssueNumber(threadId);
    }

    public async setIssueMapping(threadId: string, issueNumber: number): Promise<void> {
        await this.ensureMigration();
        this.legacyStorage.setIssueMapping(threadId, issueNumber);
    }

    public async deleteIssueMapping(threadId: string): Promise<void> {
        await this.ensureMigration();
        this.legacyStorage.deleteIssueMapping(threadId);
    }

    public async getCommentId(messageId: string): Promise<number | undefined> {
        await this.ensureMigration();
        return this.legacyStorage.getCommentId(messageId);
    }

    public async setCommentMapping(messageId: string, commentId: number): Promise<void> {
        await this.ensureMigration();
        this.legacyStorage.setCommentMapping(messageId, commentId);
        console.log(`📝 [GITHUB DEBUG] 댓글 매핑 저장: 메시지 ${messageId} -> 댓글 ${commentId}`);
    }

    public async deleteCommentMapping(messageId: string): Promise<void> {
        await this.ensureMigration();
        this.legacyStorage.deleteCommentMapping(messageId);
    }

    public async getCommentMappingStats() {
        await this.ensureMigration();
        const stats = this.legacyStorage.getStats();
        return {
            total: stats.commentCount,
            entries: this.legacyStorage.getCommentMappingEntries()
        };
    }

    public async logCommentMappingDebug(messageId: string): Promise<void> {
        await this.ensureMigration();
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

    public async getStats() {
        await this.ensureMigration();
        return this.legacyStorage.getStats();
    }

    public forceSave(): void {
        this.legacyStorage.forceSave();
    }

    public async cleanupOldEntries(daysOld: number = 30): Promise<void> {
        await this.ensureMigration();
        this.legacyStorage.cleanupOldEntries(daysOld);
    }

    public async getAllMappings() {
        await this.ensureMigration();
        const stats = this.legacyStorage.getStats();
        return {
            issues: this.legacyStorage.getIssueMappingEntries(),
            comments: this.legacyStorage.getCommentMappingEntries(),
            stats: stats
        };
    }
}