import { MappingManager } from './mapping.js';
import { Client, ThreadChannel } from 'discord.js';

interface IssueSearchProvider {
    findExistingIssue(threadId: string, threadTitle: string): Promise<number | null>;
}

export class IssueResolver {
    private mappingManager: MappingManager;
    private discordClient?: Client;
    private issueSearchProvider?: IssueSearchProvider;

    constructor(
        mappingManager: MappingManager,
        discordClient?: Client,
        issueSearchProvider?: IssueSearchProvider
    ) {
        this.mappingManager = mappingManager;
        this.discordClient = discordClient;
        this.issueSearchProvider = issueSearchProvider;
    }

    public async resolveIssueNumber(threadId: string): Promise<number | undefined> {
        // First try to get from memory/storage
        let issueNumber = this.mappingManager.getIssueNumber(threadId);
        if (issueNumber) {
            return issueNumber;
        }

        console.log(`⚠️  스레드 ${threadId}에 해당하는 GitHub 이슈를 메모리에서 찾을 수 없습니다. GitHub에서 검색 중...`);

        if (!this.discordClient) {
            console.log(`❌ Discord 클라이언트가 설정되지 않았습니다.`);
            return undefined;
        }

        if (!this.issueSearchProvider) {
            console.log(`❌ GitHub 이슈 검색 제공자가 설정되지 않았습니다.`);
            return undefined;
        }

        try {
            const thread = await this.discordClient.channels.fetch(threadId);
            if (!thread) {
                console.log(`❌ Discord 스레드 ${threadId}를 찾을 수 없습니다.`);
                return undefined;
            }

            const foundIssueNumber = await this.issueSearchProvider.findExistingIssue(threadId, (thread as ThreadChannel).name || 'Untitled Thread');
            if (!foundIssueNumber) {
                console.log(`❌ 스레드 ${threadId}에 해당하는 GitHub 이슈를 찾을 수 없습니다.`);
                return undefined;
            }

            this.mappingManager.setIssueMapping(threadId, foundIssueNumber);
            console.log(`✅ GitHub 이슈 #${foundIssueNumber}를 찾았습니다.`);
            return foundIssueNumber;

        } catch (error) {
            console.error(`❌ 이슈 번호 해결 중 오류:`, error);
            return undefined;
        }
    }

    public async resolveIssueNumberWithName(threadId: string, threadName: string): Promise<number | undefined> {
        // First try to get from memory/storage
        let issueNumber = this.mappingManager.getIssueNumber(threadId);
        if (issueNumber) {
            return issueNumber;
        }

        console.log(`🔍 [GITHUB DEBUG] 메모리에 이슈 없음. GitHub에서 검색 시도: "${threadName}"`);

        if (!this.issueSearchProvider) {
            console.log(`❌ GitHub 이슈 검색 제공자가 설정되지 않았습니다.`);
            return undefined;
        }

        try {
            const foundIssueNumber = await this.issueSearchProvider.findExistingIssue(threadId, threadName);
            if (!foundIssueNumber) {
                console.log(`❌ [GITHUB DEBUG] GitHub에서 이슈를 찾을 수 없음: "${threadName}"`);
                return undefined;
            }

            this.mappingManager.setIssueMapping(threadId, foundIssueNumber);
            console.log(`✅ [GITHUB DEBUG] GitHub에서 이슈 찾음: #${foundIssueNumber}`);
            return foundIssueNumber;

        } catch (error) {
            console.error(`❌ 이슈 번호 해결 중 오류:`, error);
            return undefined;
        }
    }
}