import { Router } from 'express';
import { supabase } from '../lib/supabase';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Example: fetch all rows from a table
// router.get('/items', async (_req, res) => {
//   const { data, error } = await supabase.from('your_table').select('*');
//   if (error) return res.status(500).json({ error: error.message });
//   res.json(data);
// });

export default router;
