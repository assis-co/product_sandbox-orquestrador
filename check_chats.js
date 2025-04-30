
import { config } from 'dotenv';
config(); // Carrega as variáveis do .env

import { analyzeChatsAndExportCSV } from './src/analyzeChatsAndExportCSV.js';

// Substitua pelo company_id que deseja analisar
const companyId = 'ed1c7037-c8b8-43c8-9446-490621b7b317';

await analyzeChatsAndExportCSV(companyId);
