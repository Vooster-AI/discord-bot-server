import * as fs from 'node:fs';
import * as path from 'node:path';
import type { WebhookMappingData, MappingStats } from './types.js';

class WebhookFileStorage {
    private readonly filePath: string;
    private data: WebhookMappingData;
    private saveTimeout: NodeJS.Timeout | null = null;
    private readonly SAVE_DELAY = 1000;

    constructor(fileName: string = 'webhook-mappings.json') {
        const dataDir = path.join(process.cwd(), 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        
        this.filePath = path.join(dataDir, fileName);
        this.data = this.loadData();
        
        // Graceful shutdown handlers
        process.on('SIGINT', () => this.saveDataSync());
        process.on('SIGTERM', () => this.saveDataSync());
        process.on('exit', () => this.saveDataSync());
    }

    private loadData(): WebhookMappingData {
        try {
            if (fs.existsSync(this.filePath)) {
                const fileContent = fs.readFileSync(this.filePath, 'utf-8');
                
                if (!fileContent.trim()) {
                    console.log(`⚠️ [WEBHOOK STORAGE] 빈 파일 감지, 새로운 데이터 구조로 초기화: ${this.filePath}`);
                    return this.createDefaultData();
                }
                
                const parsed = JSON.parse(fileContent) as unknown;
                
                if (this.isValidMappingData(parsed)) {
                    console.log(`✅ [WEBHOOK STORAGE] 매핑 데이터 로드 완료: ${this.filePath}`);
                    console.log(`📊 [WEBHOOK STORAGE] 이슈-스레드 매핑: ${Object.keys(parsed.issueToThreadMap).length}개`);
                    return parsed;
                } else {
                    console.log(`⚠️ [WEBHOOK STORAGE] 잘못된 데이터 구조 감지, 새로운 데이터 구조로 초기화: ${this.filePath}`);
                    return this.createDefaultData();
                }
            }
        } catch (error) {
            console.error(`❌ [WEBHOOK STORAGE] 데이터 로드 실패: ${error}`);
            console.log(`🔄 [WEBHOOK STORAGE] 새로운 데이터 구조로 초기화: ${this.filePath}`);
            return this.createDefaultData();
        }
        
        console.log(`🆕 [WEBHOOK STORAGE] 새로운 저장소 생성: ${this.filePath}`);
        return this.createDefaultData();
    }

    private isValidMappingData(data: unknown): data is WebhookMappingData {
        return (
            data !== null &&
            typeof data === 'object' &&
            'issueToThreadMap' in data &&
            'lastUpdated' in data &&
            typeof (data as any).issueToThreadMap === 'object' &&
            typeof (data as any).lastUpdated === 'string'
        );
    }

    private createDefaultData(): WebhookMappingData {
        return {
            issueToThreadMap: {},
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
            this.data = {
                ...this.data,
                lastUpdated: new Date().toISOString()
            };
            
            const jsonString = JSON.stringify(this.data, null, 2);
            fs.writeFileSync(this.filePath, jsonString, 'utf-8');
            console.log(`💾 [WEBHOOK STORAGE] 데이터 저장 완료: ${this.filePath}`);
        } catch (error) {
            console.error(`❌ [WEBHOOK STORAGE] 데이터 저장 실패: ${error}`);
        }
    }

    setIssueThreadMapping(issueNumber: number, threadId: string): void {
        this.data = {
            ...this.data,
            issueToThreadMap: {
                ...this.data.issueToThreadMap,
                [issueNumber.toString()]: threadId
            }
        };
        this.scheduleDataSave();
    }

    getThreadId(issueNumber: number): string | undefined {
        return this.data.issueToThreadMap[issueNumber.toString()];
    }

    deleteMapping(issueNumber: number): void {
        if (this.data.issueToThreadMap[issueNumber.toString()]) {
            const newMap = { ...this.data.issueToThreadMap };
            delete newMap[issueNumber.toString()];
            
            this.data = {
                ...this.data,
                issueToThreadMap: newMap
            };
            this.scheduleDataSave();
        }
    }

    getStats(): { total: number; lastUpdated: string } {
        return {
            total: Object.keys(this.data.issueToThreadMap).length,
            lastUpdated: this.data.lastUpdated
        };
    }

    getEntries(): [number, string][] {
        return Object.entries(this.data.issueToThreadMap)
            .map(([key, value]) => [parseInt(key, 10), value] as [number, string])
            .slice(0, 10);
    }

    forceSave(): void {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
            this.saveTimeout = null;
        }
        this.saveDataSync();
    }
}

export class WebhookMappingManager {
    private readonly storage: WebhookFileStorage;

    constructor() {
        this.storage = new WebhookFileStorage('webhook-mappings.json');
    }

    setIssueThreadMapping(issueNumber: number, threadId: string): void {
        this.storage.setIssueThreadMapping(issueNumber, threadId);
        console.log(`📝 [WEBHOOK] 이슈-스레드 매핑 저장: 이슈 #${issueNumber} -> 스레드 ${threadId}`);
    }

    getThreadId(issueNumber: number): string | undefined {
        return this.storage.getThreadId(issueNumber);
    }

    deleteMapping(issueNumber: number): void {
        this.storage.deleteMapping(issueNumber);
    }

    getMappingStats(): MappingStats {
        const stats = this.storage.getStats();
        return {
            total: stats.total,
            entries: this.storage.getEntries()
        };
    }

    logMappingDebug(issueNumber: number): void {
        const threadId = this.storage.getThreadId(issueNumber);
        const stats = this.storage.getStats();
        
        console.log(`🔍 [WEBHOOK DEBUG] 매핑 상태:`);
        console.log(`🔍 [WEBHOOK DEBUG] - 찾는 이슈 번호: #${issueNumber}`);
        console.log(`🔍 [WEBHOOK DEBUG] - 매핑된 스레드 ID: ${threadId || 'None'}`);
        console.log(`🔍 [WEBHOOK DEBUG] - 전체 매핑 수: ${stats.total}`);
    }

    forceSave(): void {
        this.storage.forceSave();
    }
}