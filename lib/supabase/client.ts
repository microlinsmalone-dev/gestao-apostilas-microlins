// ==============================================================================
// GESTÃO DE APOSTILAS - MICROLINS POTIRENDABA
// Supabase: lib/supabase/client.ts
// Cliente de navegador seguro para Supabase com tipos estritos
// ==============================================================================

import { createClient } from '@supabase/supabase-js';
import { Database } from '../../types/database';

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://apfcbkucxjcleqxarlmv.supabase.co';
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_DZAXwbvMzgz31wR-pmbNkg_aNg3ofG0';

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
