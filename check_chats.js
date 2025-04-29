
import { config } from 'dotenv';
config(); // Carrega as variáveis do .env

import { analyzeChatsAndExportCSV } from './src/analyzeChatsAndExportCSV.js';

// Substitua pelo company_id que deseja analisar
const companyId = '0871fe3a-0897-489c-8897-a2f8d3fbaa21';

await analyzeChatsAndExportCSV(companyId);
