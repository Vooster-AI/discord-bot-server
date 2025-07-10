import { Router } from 'express';
import { BackfillService } from '../../services/backfill/index.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';
import { getDiscordClient } from '../app.js';

const router = Router();

/**
 * 모든 채널 백필 실행
 * POST /api/backfill/all
 */
router.post('/all', asyncHandler(async (req, res) => {
    const client = getDiscordClient();
    if (!client) {
        return res.status(503).json({ error: 'Discord 클라이언트가 연결되지 않았습니다.' });
    }

    const backfillService = new BackfillService(client);
    const options = {
        batchSize: req.body.batchSize || 20,
        delay: req.body.delay || 500,
        syncToGitHub: req.body.syncToGitHub !== false,
        syncToSupabase: req.body.syncToSupabase !== false,
        updateScores: req.body.updateScores !== false,
        startDate: req.body.startDate ? new Date(req.body.startDate) : undefined,
        endDate: req.body.endDate ? new Date(req.body.endDate) : undefined
    };

    try {
        const results = await backfillService.backfillAllChannels(options);
        res.json({
            success: true,
            message: '모든 채널 백필이 완료되었습니다.',
            results: results.map(result => ({
                jobId: result.jobId,
                success: result.success,
                totalProcessed: result.totalProcessed,
                errorCount: result.errors.length,
                duration: result.duration
            }))
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : '백필 중 오류가 발생했습니다.'
        });
    }
}));

/**
 * 특정 채널 백필 실행
 * POST /api/backfill/channel/:channelId
 */
router.post('/channel/:channelId', asyncHandler(async (req, res) => {
    const client = getDiscordClient();
    if (!client) {
        return res.status(503).json({ error: 'Discord 클라이언트가 연결되지 않았습니다.' });
    }

    const { channelId } = req.params;
    const backfillService = new BackfillService(client);
    
    const options = {
        batchSize: req.body.batchSize || 20,
        delay: req.body.delay || 500,
        syncToGitHub: req.body.syncToGitHub !== false,
        syncToSupabase: req.body.syncToSupabase !== false,
        updateScores: req.body.updateScores !== false,
        startDate: req.body.startDate ? new Date(req.body.startDate) : undefined,
        endDate: req.body.endDate ? new Date(req.body.endDate) : undefined
    };

    try {
        const result = await backfillService.backfillChannel(channelId, options);
        res.json({
            success: result.success,
            message: result.success ? '채널 백필이 완료되었습니다.' : '채널 백필 중 오류가 발생했습니다.',
            result: {
                jobId: result.jobId,
                success: result.success,
                totalProcessed: result.totalProcessed,
                errorCount: result.errors.length,
                duration: result.duration,
                errors: result.errors
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : '백필 중 오류가 발생했습니다.'
        });
    }
}));

/**
 * 백필 진행 상황 조회
 * GET /api/backfill/progress/:jobId
 */
router.get('/progress/:jobId', asyncHandler(async (req, res) => {
    const client = getDiscordClient();
    if (!client) {
        return res.status(503).json({ error: 'Discord 클라이언트가 연결되지 않았습니다.' });
    }

    const { jobId } = req.params;
    const backfillService = new BackfillService(client);
    
    const progress = backfillService.getBackfillProgress(jobId);
    
    if (!progress) {
        return res.status(404).json({ error: '백필 작업을 찾을 수 없습니다.' });
    }

    res.json({
        success: true,
        progress: {
            jobId: progress.jobId,
            status: progress.status,
            channelId: progress.channelId,
            channelName: progress.channelName,
            processed: progress.processed,
            total: progress.total,
            percentage: progress.total > 0 ? Math.round((progress.processed / progress.total) * 100) : 0,
            errorCount: progress.errors.length,
            startTime: progress.startTime,
            endTime: progress.endTime,
            duration: progress.endTime ? 
                progress.endTime.getTime() - progress.startTime.getTime() : 
                Date.now() - progress.startTime.getTime()
        }
    });
}));

/**
 * 모든 활성 백필 작업 조회
 * GET /api/backfill/jobs
 */
router.get('/jobs', asyncHandler(async (req, res) => {
    const client = getDiscordClient();
    if (!client) {
        return res.status(503).json({ error: 'Discord 클라이언트가 연결되지 않았습니다.' });
    }

    const backfillService = new BackfillService(client);
    const jobs = backfillService.getAllActiveJobs();
    
    res.json({
        success: true,
        jobs: jobs.map(job => ({
            jobId: job.jobId,
            status: job.status,
            channelId: job.channelId,
            channelName: job.channelName,
            processed: job.processed,
            total: job.total,
            percentage: job.total > 0 ? Math.round((job.processed / job.total) * 100) : 0,
            errorCount: job.errors.length,
            startTime: job.startTime,
            endTime: job.endTime
        }))
    });
}));

/**
 * 백필 작업 취소
 * DELETE /api/backfill/jobs/:jobId
 */
router.delete('/jobs/:jobId', asyncHandler(async (req, res) => {
    const client = getDiscordClient();
    if (!client) {
        return res.status(503).json({ error: 'Discord 클라이언트가 연결되지 않았습니다.' });
    }

    const { jobId } = req.params;
    const backfillService = new BackfillService(client);
    
    const cancelled = backfillService.cancelBackfill(jobId);
    
    if (cancelled) {
        res.json({
            success: true,
            message: '백필 작업이 취소되었습니다.'
        });
    } else {
        res.status(404).json({
            success: false,
            error: '취소할 수 있는 백필 작업을 찾을 수 없습니다.'
        });
    }
}));

export { router as backfillRouter };