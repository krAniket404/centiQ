import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { NativeModules } from 'react-native';

const { SmsModule } = NativeModules;
const STORAGE_KEY = 'supabase_auth_token';

// Custom Storage Adapter using Android SharedPreferences (via SmsModule)
const CustomStorage = {
  async getItem(key: string) {
    return await SmsModule.loadData(key);
  },
  async setItem(key: string, value: string) {
    await SmsModule.saveData(key, value);
  },
  async removeItem(key: string) {
    await SmsModule.saveData(key, ''); // Save empty string to clear it
  },
};

const SUPABASE_URL = 'https://ispxltntzvrjqkhivmyk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzcHhsdG50enZyanFraGl2bXlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ0NTk2NzcsImV4cCI6MjEwMDAzNTY3N30.-5Shjn-dweOSHaDiAljrH87Jh_lnH_UUTlgN1IplpgE';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: CustomStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});