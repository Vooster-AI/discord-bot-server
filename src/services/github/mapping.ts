import { FileStorage } from './fileStorage.js';

export class MappingManager {
    private storage: FileStorage;

    constructor() {
        this.storage = new FileStorage('github-mappings.json');
    }

    public getIssueNumber(threadId: string): number | undefined {
        return this.storage.getIssueNumber(threadId);
    }

    public setIssueMapping(threadId: string, issueNumber: number): void {
        this.storage.setIssueMapping(threadId, issueNumber);
    }

    public deleteIssueMapping(threadId: string): void {
        this.storage.deleteIssueMapping(threadId);
    }

    public getCommentId(messageId: string): number | undefined {
        return this.storage.getCommentId(messageId);
    }

    public setCommentMapping(messageId: string, commentId: number): void {
        this.storage.setCommentMapping(messageId, commentId);
        console.log(`📝 [GITHUB DEBUG] 댓글 매핑 저장: 메시지 ${messageId} -> 댓글 ${commentId}`);
    }

    public deleteCommentMapping(messageId: string): void {
        this.storage.deleteCommentMapping(messageId);
    }

    public getCommentMappingStats() {
        const stats = this.storage.getStats();
        return {
            total: stats.commentCount,
            entries: this.storage.getCommentMappingEntries()
        };
    }

    public logCommentMappingDebug(messageId: string): void {
        const commentId = this.storage.getCommentId(messageId);
        const stats = this.storage.getStats();
        
        console.log(`🔍 [GITHUB DEBUG] 현재 댓글 매핑 상태:`);
        console.log(`🔍 [GITHUB DEBUG] - 찾는 메시지 ID: ${messageId}`);
        console.log(`🔍 [GITHUB DEBUG] - 매핑된 댓글 ID: ${commentId || 'None'}`);
        console.log(`🔍 [GITHUB DEBUG] - 전체 댓글 매핑 수: ${stats.commentCount}`);
        
        const mappingEntries = this.storage.getCommentMappingEntries();
        mappingEntries.forEach(([msgId, cmtId]) => {
            console.log(`🔍 [GITHUB DEBUG] - 매핑: ${msgId} -> ${cmtId}`);
        });
    }

    public getStats() {
        return this.storage.getStats();
    }

    public forceSave(): void {
        this.storage.forceSave();
    }

    public cleanupOldEntries(daysOld: number = 30): void {
        this.storage.cleanupOldEntries(daysOld);
    }

    public getAllMappings() {
        const stats = this.storage.getStats();
        return {
            issues: this.storage.getIssueMappingEntries(),
            comments: this.storage.getCommentMappingEntries(),
            stats: stats
        };
    }
}