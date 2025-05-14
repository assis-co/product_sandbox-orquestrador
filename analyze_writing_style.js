
import { getChatsByCompany } from './src/getChatsByCompany.js';
import { generateGlobalSellerWritingProfile } from './src/analyzeSellerWritingStyle.js';

const companyId = '58527d67-ea25-4a43-8f77-526c1d6f7240';
const chats = await getChatsByCompany(companyId);

await generateGlobalSellerWritingProfile(chats);
