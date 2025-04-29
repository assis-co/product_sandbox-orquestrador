import { config } from 'dotenv';
config();

import { generateFollowUpsFromCsv } from './src/generateFollowUpsFromCsv_current_prompt.js';

await generateFollowUpsFromCsv();
