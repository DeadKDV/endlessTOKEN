// Облачный сейв. Клиент создаётся лениво, без ключей работает только localStorage.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { GameState } from '../sim/types';

let client: SupabaseClient | null = null;
export function supabase(): SupabaseClient | null {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return (client ??= createClient(url, key));
}

export async function ensureUser() {
  const sb = supabase(); if (!sb) return null;
  const { data } = await sb.auth.getUser();
  if (data.user) return data.user;
  const { data: anon } = await sb.auth.signInAnonymously();
  return anon.user;
}

export async function pushSave(s: GameState) {
  const sb = supabase(); const user = await ensureUser(); if (!sb || !user) return;
  await sb.from('saves').upsert({ user_id: user.id, state: s, saved_at: new Date().toISOString() });
}

export async function pullSave(): Promise<GameState | null> {
  const sb = supabase(); const user = await ensureUser(); if (!sb || !user) return null;
  const { data } = await sb.from('saves').select('state').eq('user_id', user.id).maybeSingle();
  return (data?.state as GameState) ?? null;
}
