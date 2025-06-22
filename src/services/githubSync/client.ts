import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

export class GitHubClient {
    private baseUrl = 'https://api.github.com';
    private token: string;
    private repository: string;
    private currentUser: string | null = null;

    constructor() {
        this.token = process.env.GITHUB_TOKEN || '';
        this.repository = process.env.GITHUB_REPOSITORY || '';
    }

    validateCredentials(): boolean {
        return !!(this.token && this.repository);
    }

    getHeaders() {
        return {
            'Authorization': `token ${this.token}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'Discord-Forum-Bot'
        };
    }

    getReactionHeaders() {
        return {
            ...this.getHeaders(),
            'Accept': 'application/vnd.github.squirrel-girl-preview+json'
        };
    }

    async getCurrentUser(): Promise<string> {
        if (!this.currentUser) {
            try {
                const response = await axios.get(`${this.baseUrl}/user`, {
                    headers: this.getHeaders()
                });
                this.currentUser = response.data.login;
            } catch (error) {
                console.error('❌ GitHub 사용자 정보 조회 실패:', error);
                return '';
            }
        }
        return this.currentUser || '';
    }

    async testConnection(): Promise<boolean> {
        try {
            const response = await axios.get(
                `${this.baseUrl}/repos/${this.repository}`,
                { headers: this.getHeaders() }
            );

            console.log(`✅ GitHub 저장소 연결 성공: ${response.data.full_name}`);
            return true;

        } catch (error: any) {
            console.error('❌ GitHub 연결 실패:', error.response?.data || error.message);
            return false;
        }
    }

    getRepository(): string {
        return this.repository;
    }

    getBaseUrl(): string {
        return this.baseUrl;
    }
}