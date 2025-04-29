import { config } from 'dotenv';
config(); // ← Carrega as variáveis de ambiente imediatamente!

import OpenAI from 'openai';

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});
