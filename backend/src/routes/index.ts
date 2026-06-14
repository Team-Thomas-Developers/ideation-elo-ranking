import { Router } from 'express';
import rounds from './rounds';
import matchups from './matchups';
import votes from './votes';
import ideas from './ideas';
import leaderboard from './leaderboard';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

router.use('/rounds', rounds);
router.use('/matchups', matchups);
router.use('/votes', votes);
router.use('/ideas', ideas);
router.use('/leaderboard', leaderboard);

export default router;
