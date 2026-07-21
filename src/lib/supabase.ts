import { createClient } from '@supabase/supabase-js';

// Replace these with your actual Supabase URL and Anon Key
const SUPABASE_URL = 'https://ispxltntzvrjqkhivmyk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzcHhsdG50enZyanFraGl2bXlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ0NTk2NzcsImV4cCI6MjEwMDAzNTY3N30.-5Shjn-dweOSHaDiAljrH87Jh_lnH_UUTlgN1IplpgE';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);