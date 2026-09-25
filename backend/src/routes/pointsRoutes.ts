import { Router } from 'express';
import { checkIn, getCheckInStatus } from '../controllers/pointsController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.post('/check-in', authMiddleware, checkIn);
// 成长足迹：签到状态、连续天数、本月次数、积分、名次与积分榜
router.get('/check-in/status', authMiddleware, getCheckInStatus);
router.get('/growth', authMiddleware, getCheckInStatus);

export default router;
