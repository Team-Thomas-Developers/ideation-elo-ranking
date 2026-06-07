import { Router } from 'express';
import { supabase } from '../lib/supabase';

const router = Router();

// get /api/ideas — ideas with their current rankings, best rank first
router.get('/', async (_req, res) => {
  const { data, error } = await supabase
    .from('ideas')
    .select('id, title, desc, curr_score, curr_rank')
    .order('curr_rank', { ascending: true });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json(data);
});

export default router;
