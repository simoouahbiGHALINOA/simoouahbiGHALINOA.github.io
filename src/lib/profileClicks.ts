import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null;

export function isProfileClickTrackingConfigured() {
  return supabase !== null;
}

async function callCounter(functionName: string): Promise<number> {
  if (!supabase) {
    throw new Error('Supabase profile-click tracking is not configured.');
  }

  const { data, error } = await supabase.rpc(functionName);
  if (error) throw error;
  if (typeof data !== 'number' || !Number.isSafeInteger(data) || data < 0) {
    throw new Error(`Supabase returned an invalid value from ${functionName}.`);
  }

  return data;
}

export function getProfileClickCount() {
  return callCounter('get_github_profile_click_count');
}

export function recordProfileClick() {
  return callCounter('record_github_profile_click');
}
