
import 'dotenv/config'; 
import { createClient } from '@supabase/supabase-js';

// Carregue suas credenciais como variáveis de ambiente
const supabaseUrl     = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

// Cria o cliente. Vale para browser ou Node (você já está em Node 20.17.0)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);   // :contentReference[oaicite:0]{index=0}
