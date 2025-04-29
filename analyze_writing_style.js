
import { getChatsByCompany } from './src/getChatsByCompany.js';
import { generateGlobalSellerWritingProfile } from './src/analyzeSellerWritingStyle.js';

const companyId = '0871fe3a-0897-489c-8897-a2f8d3fbaa21';
const chats = await getChatsByCompany(companyId);

await generateGlobalSellerWritingProfile(chats);
