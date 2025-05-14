import { supabase } from './supabaseClient.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Resolve __dirname for ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function getChatsByCompany(companyId) {
  // Load and parse the contact_list.csv file
  const csvFilePath = path.resolve(__dirname, '../contact_list.csv');
  const csvData = fs.readFileSync(csvFilePath, 'utf-8');
  const contactList = csvData.split('\n').slice(1).map(line => {
    const [csvCompanyId, lastEightDigits] = line.split(',');
    return { companyId: csvCompanyId, lastEightDigits: lastEightDigits?.trim() };
  });

  // Filter the contact list for the given companyId
  const filteredContacts = contactList.filter(contact => contact.companyId === companyId);
  const lastEightDigitsList = filteredContacts.map(contact => contact.lastEightDigits);

  // Query the database
  const { data, error } = await supabase
    .from('chats')
    .select('id, company_id, chat_id, contact_phone, last_message_time, last_buyer_message_time, last_seller_message_time, created_at, total_ignored_fups')
    .eq('company_id', companyId)
    .order('last_message_time', { ascending: false });

  if (error) {
    console.error('Erro ao buscar chats:', error);
    throw error;
  }

  // Filter chats based on the last eight digits of contact_phone
  const filteredData = data.filter(chat => {
    const contactPhoneLastEight = chat.contact_phone.slice(-8);
    return lastEightDigitsList.includes(contactPhoneLastEight);
  });

  return filteredData;
}
