import { Request } from 'express';
import { supabase } from './supabase';

export async function getAuthenticatedUser(req: Request) {
  const authorization = req.header('authorization');
  const token = authorization?.replace(/^Bearer\s+/i, '');

  if (!token) return null;

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) return null;
  return user;
}
