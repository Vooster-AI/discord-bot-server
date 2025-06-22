import axios from 'axios';
import type { SyncResponse, StatsResponse } from './types.js';

export class SupabaseClient {
    constructor(private readonly baseUrl: string = 'http://localhost:3000') {}

    async syncData(table: string, data: unknown): Promise<SyncResponse> {
        try {
            const response = await axios.post(`${this.baseUrl}/api/sync/supabase`, {
                table,
                data
            });
            
            return response.data as SyncResponse;
        } catch (error) {
            console.error('❌ Supabase 동기화 API 호출 중 오류:', (error as any).response?.data || (error as Error).message);
            
            return {
                success: false,
                error: (error as any).response?.data?.error || (error as Error).message
            };
        }
    }

    async getStats(): Promise<StatsResponse | null> {
        try {
            const response = await axios.get(`${this.baseUrl}/api/stats`);
            return response.data as StatsResponse;
        } catch (error) {
            console.error('❌ 통계 조회 중 오류:', error);
            return null;
        }
    }

    async healthCheck(): Promise<boolean> {
        try {
            const response = await axios.get(`${this.baseUrl}/health`);
            return response.status === 200;
        } catch (error) {
            console.error('❌ 서버 상태 확인 실패:', error);
            return false;
        }
    }

    async testConnection(): Promise<void> {
        console.log('🔍 Supabase 연결 테스트 중...');
        
        const isHealthy = await this.healthCheck();
        if (isHealthy) {
            console.log('✅ API 서버 연결 성공');
        } else {
            console.log('❌ API 서버 연결 실패');
        }
    }
}