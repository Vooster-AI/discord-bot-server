import { startDiscordBot } from './bot/login.js';
import { app } from './api/app.js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 상위 폴더의 .env 파일을 읽도록 설정
dotenv.config({ path: path.join(__dirname, '../.env') });

async function startApplication() {
    try {
        console.log('🚀 애플리케이션 시작 중...');
        
        // Discord 봇과 Express 서버를 동시에 시작
        const [discordClient] = await Promise.all([
            startDiscordBot(),
            startExpressServer()
        ]);
        
        console.log('✅ 모든 서비스가 성공적으로 시작되었습니다.');
        
        // 종료 처리
        process.on('SIGINT', async () => {
            console.log('\n🔄 애플리케이션 종료 중...');
            await discordClient.destroy();
            process.exit(0);
        });
        
    } catch (error) {
        console.error('❌ 애플리케이션 시작 실패:', error);
        process.exit(1);
    }
}

function startExpressServer(): Promise<void> {
    return new Promise((resolve, reject) => {
        const PORT = process.env.PORT || 3000;
        
        const server = app.listen(PORT, () => {
            console.log(`🚀 Express 서버가 포트 ${PORT}에서 실행 중`);
            console.log(`📊 Health check: http://localhost:${PORT}/health`);
            console.log(`📝 API docs: http://localhost:${PORT}/api`);
            resolve();
        });
        
        server.on('error', (error) => {
            console.error('❌ Express 서버 시작 실패:', error);
            reject(error);
        });
    });
}

// 애플리케이션 시작
startApplication();  