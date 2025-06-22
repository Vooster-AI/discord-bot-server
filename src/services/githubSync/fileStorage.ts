import * as fs from 'node:fs';
import * as path from 'node:path';

interface StorageData {
    issueMap: Record<string, number>;
    commentMap: Record<string, number>;
    lastUpdated: string;
}

export class FileStorage {
    private filePath: string;
    private data: StorageData;
    private saveTimeout: NodeJS.Timeout | null = null;
    private readonly SAVE_DELAY = 1000;

    constructor(fileName: string = 'github-mappings.json') {
        const dataDir = path.join(process.cwd(), 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        
        this.filePath = path.join(dataDir, fileName);
        this.data = this.loadData();

        // Ensure data is saved on process exit
        process.on('SIGINT', () => this.saveDataSync());
        process.on('SIGTERM', () => this.saveDataSync());
        process.on('exit', () => this.saveDataSync());
    }

    private loadData(): StorageData {
        try {
            if (fs.existsSync(this.filePath)) {
                const fileContent = fs.readFileSync(this.filePath, 'utf-8');
                
                if (!fileContent.trim()) {
                    console.log(`⚠️ [STORAGE] 빈 파일 감지, 새로운 데이터 구조로 초기화: ${this.filePath}`);
                    return this.createDefaultData();
                }

                const parsed = JSON.parse(fileContent);
                
                if (parsed && typeof parsed === 'object' && parsed.issueMap && parsed.commentMap) {
                    console.log(`✅ [STORAGE] 매핑 데이터 로드 완료: ${this.filePath}`);
                    console.log(`📊 [STORAGE] 이슈 매핑: ${Object.keys(parsed.issueMap).length}개, 댓글 매핑: ${Object.keys(parsed.commentMap).length}개`);
                    return parsed;
                } else {
                    console.log(`⚠️ [STORAGE] 잘못된 데이터 구조 감지, 새로운 데이터 구조로 초기화: ${this.filePath}`);
                    return this.createDefaultData();
                }
            }
        } catch (error) {
            console.error(`❌ [STORAGE] 데이터 로드 실패: ${error}`);
            console.log(`🔄 [STORAGE] 새로운 데이터 구조로 초기화: ${this.filePath}`);
            return this.createDefaultData();
        }
        
        console.log(`🆕 [STORAGE] 새로운 저장소 생성: ${this.filePath}`);
        return this.createDefaultData();
    }

    private createDefaultData(): StorageData {
        return {
            issueMap: {},
            commentMap: {},
            lastUpdated: new Date().toISOString()
        };
    }

    private scheduleDataSave(): void {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }
        
        this.saveTimeout = setTimeout(() => {
            this.saveDataSync();
            this.saveTimeout = null;
        }, this.SAVE_DELAY);
    }

    private saveDataSync(): void {
        try {
            this.data.lastUpdated = new Date().toISOString();
            const jsonString = JSON.stringify(this.data, null, 2);
            fs.writeFileSync(this.filePath, jsonString, 'utf-8');
            console.log(`💾 [STORAGE] 데이터 저장 완료: ${this.filePath}`);
        } catch (error) {
            console.error(`❌ [STORAGE] 데이터 저장 실패: ${error}`);
        }
    }

    public getIssueNumber(threadId: string): number | undefined {
        return this.data.issueMap[threadId];
    }

    public setIssueMapping(threadId: string, issueNumber: number): void {
        this.data.issueMap[threadId] = issueNumber;
        this.scheduleDataSave();
        console.log(`📝 [STORAGE] 이슈 매핑 저장: 스레드 ${threadId} -> 이슈 #${issueNumber}`);
    }

    public deleteIssueMapping(threadId: string): void {
        if (this.data.issueMap[threadId]) {
            delete this.data.issueMap[threadId];
            this.scheduleDataSave();
            console.log(`🗑️ [STORAGE] 이슈 매핑 삭제: 스레드 ${threadId}`);
        }
    }

    public getCommentId(messageId: string): number | undefined {
        return this.data.commentMap[messageId];
    }

    public setCommentMapping(messageId: string, commentId: number): void {
        this.data.commentMap[messageId] = commentId;
        this.scheduleDataSave();
        console.log(`📝 [STORAGE] 댓글 매핑 저장: 메시지 ${messageId} -> 댓글 #${commentId}`);
    }

    public deleteCommentMapping(messageId: string): void {
        if (this.data.commentMap[messageId]) {
            delete this.data.commentMap[messageId];
            this.scheduleDataSave();
            console.log(`🗑️ [STORAGE] 댓글 매핑 삭제: 메시지 ${messageId}`);
        }
    }

    public getStats() {
        return {
            issueCount: Object.keys(this.data.issueMap).length,
            commentCount: Object.keys(this.data.commentMap).length,
            lastUpdated: this.data.lastUpdated
        };
    }

    public getIssueMappingEntries(): [string, number][] {
        return Object.entries(this.data.issueMap).slice(0, 10);
    }

    public getCommentMappingEntries(): [string, number][] {
        return Object.entries(this.data.commentMap).slice(0, 5);
    }

    public forceSave(): void {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
            this.saveTimeout = null;
        }
        this.saveDataSync();
    }

    public cleanupOldEntries(daysOld: number = 30): void {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysOld);
        console.log(`🧹 [STORAGE] ${daysOld}일 이상 된 항목 정리 기능 준비됨`);
        // Note: Actual cleanup logic would be implemented based on specific requirements
    }
}