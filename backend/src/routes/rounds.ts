import { Router } from 'express';
import { supabase } from '../lib/supabase';
import { Round } from '../types';

const router = Router();

// list rounds, newest first
router.get('/', async (_req, res) => {
  const { data, error } = await supabase
    .from('rounds')
    .select('id, round_num, status')
    .order('round_num', { ascending: false });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json(data);
});

// open a new round, closing any active one first
router.post('/', async (_req, res) => {
  try {
    const { error: closeError } = await supabase
      .from('rounds')
      .update({ status: false })
      .eq('status', true);
    if (closeError) throw closeError;

    const { data: latest, error: latestError } = await supabase
      .from('rounds')
      .select('round_num')
      .order('round_num', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestError) throw latestError;

    const nextNum = (latest?.round_num ?? 0) + 1;

    const { data: round, error: insertError } = await supabase
      .from('rounds')
      .insert({ round_num: nextNum, status: true })
      .select('id, round_num, status')
      .single();
    if (insertError) throw insertError;

    res.status(201).json(round as Round);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
