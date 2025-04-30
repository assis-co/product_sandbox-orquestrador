
import { getChatsByCompany } from './src/getChatsByCompany.js';
import { generateGlobalSellerWritingProfile } from './src/analyzeSellerWritingStyle.js';

const companyId = 'ed1c7037-c8b8-43c8-9446-490621b7b317';
const chats = await getChatsByCompany(companyId);

await generateGlobalSellerWritingProfile(chats);
