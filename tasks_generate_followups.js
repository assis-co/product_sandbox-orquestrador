import { config } from 'dotenv';
config();

import { generateFollowUpsFromCsv } from './src/generateFollowUpsFromCsv.js';

await generateFollowUpsFromCsv();
