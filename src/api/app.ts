import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { Client } from 'discord.js';

// Import route modules
import usersRouter from './routes/users.js';
import todosRouter from './routes/todos.js';
import forumsRouter from './routes/forums.js';
import syncRouter from './routes/sync.js';
import githubRouter from './routes/github.js';
import apiRouter from './routes/api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 상위 폴더의 .env 파일을 읽도록 설정
dotenv.config({ path: path.join(__dirname, '../../.env') });

const app = express();

// Discord client storage
let discordClient: Client | null = null;

// Export function to get Discord client
export function getDiscordClient(): Client | null {
    return discordClient;
}

// Export function to set Discord client
export async function setDiscordClient(client: Client): Promise<void> {
    discordClient = client;
    console.log('Discord client set in Express app');
}

// Middleware
app.use(helmet({
    contentSecurityPolicy: false // API 서버이므로 CSP 비활성화
}));
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true
}));
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (_, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Mount routers
app.use('/api/users', usersRouter);
app.use('/api/todo', todosRouter);
app.use('/api/forums', forumsRouter);
app.use('/api/sync', syncRouter);
app.use('/api/github', githubRouter);
app.use('/api', apiRouter);

// Legacy endpoint redirects for backward compatibility
app.get('/api/supabase/forums', (req, res) => res.redirect('/api/forums/supabase'));
app.post('/api/supabase/forums', (req, res) => res.redirect(307, '/api/forums/supabase'));
app.patch('/api/supabase/forums/:id', (req, res) => res.redirect(307, `/api/forums/supabase/${req.params.id}`));
app.delete('/api/supabase/forums/:id', (req, res) => res.redirect(307, `/api/forums/supabase/${req.params.id}`));

// Error handling middleware
app.use((err: Error, req: Request, res: Response) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not found',
        path: req.path,
        method: req.method
    });
});

export { app };
