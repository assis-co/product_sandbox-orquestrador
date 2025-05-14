
import { config } from 'dotenv';
config(); // Carrega as variáveis do .env

import { analyzeChatsAndExportCSV } from './src/analyzeChatsAndExportCSV.js';

// Substitua pelo company_id que deseja analisar
const companyId = '58527d67-ea25-4a43-8f77-526c1d6f7240';

await analyzeChatsAndExportCSV(companyId);
