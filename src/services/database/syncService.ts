import { supabase } from '../../shared/utils/supabase.js';
import { UserService } from '../../core/services/UserService.js';
import { SyncRequest, SyncPostRequest, SyncMessageRequest } from '../../shared/types/api.js';
import { ensureDiscordIdString } from '../../api/middlewares/validation.js';

export class SyncService {
    private static readonly ALLOWED_TABLES = ['Suggestions', 'Reports', 'Questions', 'Todo'];

    static validateTable(table: string): void {
        if (!this.ALLOWED_TABLES.includes(table)) {
            throw new Error('Invalid table name');
        }
    }

    static processDiscordIds(data: any): any {
        if (!data.details) {
            return data;
        }

        const processedData = { ...data };
        
        // Ensure all Discord IDs in details are strings to preserve precision
        if (data.details.postId) {
            processedData.details.postId = ensureDiscordIdString(data.details.postId);
        }
        if (data.details.messageId) {
            processedData.details.messageId = ensureDiscordIdString(data.details.messageId);
        }
        if (data.details.authorId) {
            processedData.details.authorId = ensureDiscordIdString(data.details.authorId);
        }

        return processedData;
    }

    static async processUserData(data: any): Promise<{ processedData: any; userId?: string }> {
        const processedData = this.processDiscordIds(data);
        
        // Check if data contains Discord user information
        if (data.details && data.details.authorId && data.details.authorName) {
            const discordId = ensureDiscordIdString(data.details.authorId);
            const username = data.details.authorName;
            
            try {
                // Get or create user in Users table
                const user = await UserService.getOrCreateUser({
                    discordId: discordId,
                    username: username,
                    displayName: username
                });
                
                // Add user reference to the data
                processedData.user = user.id;
                console.log(`✅ User processed: ${username} (${discordId}) -> User ID: ${user.id}`);
                
                return { processedData, userId: user.id };
            } catch (userError) {
                console.error('❌ Error processing user:', userError);
                // Continue without user reference if user processing fails
            }
        }

        return { processedData };
    }

    static async syncToSupabase(syncData: SyncRequest): Promise<any> {
        this.validateTable(syncData.table);
        
        const { processedData } = await this.processUserData(syncData.data);

        // Insert data into Supabase
        const { data: result, error } = await supabase
            .from(syncData.table)
            .insert(processedData)
            .select();

        if (error) {
            console.error(`Error inserting into ${syncData.table}:`, error);
            throw new Error(`${error.message}: ${error.details}`);
        }

        console.log(`✅ Successfully inserted into ${syncData.table}:`, result);
        return result;
    }

    static async syncPost(syncData: SyncPostRequest): Promise<any> {
        this.validateTable(syncData.table);
        
        const { processedData } = await this.processUserData(syncData.postData);

        const { data, error } = await supabase
            .from(syncData.table)
            .insert(processedData)
            .select();

        if (error) {
            throw new Error(`Error syncing post to ${syncData.table}: ${error.message}`);
        }

        console.log(`✅ Post synced to ${syncData.table}`);
        return data[0];
    }

    static async syncMessage(syncData: SyncMessageRequest): Promise<any> {
        this.validateTable(syncData.table);
        
        const { processedData } = await this.processUserData(syncData.messageData);

        const { data, error } = await supabase
            .from(syncData.table)
            .insert(processedData)
            .select();

        if (error) {
            throw new Error(`Error syncing message to ${syncData.table}: ${error.message}`);
        }

        console.log(`✅ Message synced to ${syncData.table}`);
        return data[0];
    }
}