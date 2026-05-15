// =====================================================================
// TrainMS — Supabase configuration
// =====================================================================
// This file initializes the Supabase client used by all pages.
// Load this BEFORE any other TrainMS script in your HTML.
// =====================================================================

const SUPABASE_URL = 'https://cosoqamfxhefbglgojws.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvc29xYW1meGhlZmJnbGdvandzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1NzU2OTIsImV4cCI6MjA5NDE1MTY5Mn0.NpaRv3Wc8ygdIj9GgIf-dtcs1fznw5epIv6TvyFSvcM';

// Global Supabase client — accessible everywhere as `sb`
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Quick connection test — call from browser console: testSupabase()
async function testSupabase() {
  console.log('Testing Supabase connection...');
  const { data, error } = await sb.from('trains').select('id, name').limit(3);
  if (error) {
    console.error('❌ Connection failed:', error.message);
    return false;
  }
  console.log('✅ Connection works! Sample trains:', data);
  return true;
}
