import { createClient } from '@supabase/supabase-js';

// Public Supabase settings, shared with the POS. The publishable key is safe to ship to
// browsers; access is enforced by row-level security in the database.
const url = import.meta.env.VITE_SUPABASE_URL || 'https://ghqqkiukhydjlynidwjw.supabase.co';
const key = import.meta.env.VITE_SUPABASE_KEY || 'sb_publishable_hjOP0xNYVXmYDUFSNpo5dQ_2oIKeKko';

export const db = createClient(url, key);
