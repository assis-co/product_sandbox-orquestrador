
import { supabase } from './supabaseClient.js';

function formatTimestampToDayHourMinute(rawTimestamp) {
  if (!rawTimestamp) return 'Inválido';

  const date = new Date(rawTimestamp);
  if (isNaN(date.getTime())) return 'Inválido';

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0'); // mês começa em 0
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${day}/${month} ${hours}:${minutes}`;
}

/**
 * Busca mensagens de um chat_id
 * @param {string} chatId
 * @returns {Promise<Array>} Lista de mensagens
 */
async function getMessagesByChatId(chatId) {
  const { data, error } = await supabase
    .from('messages')
    .select('body, timestamp, phone_last_eight_digits')
    .eq('chat_id', chatId)
    .order('timestamp', { ascending: false })
    .limit(150);
  

  if (error) {
    console.error(`Erro ao buscar mensagens do chat_id ${chatId}:`, error);
    throw error;
  }

  return data || [];
}

/**
 * Monta o JSON de chats com mensagens formatadas
 * @param {Array} chats Lista de chats filtrados
 * @returns {Promise<Array>} Lista [{ chat_id, conversation: [...] }]
 */
async function buildChatsWithMessages(chats) {
  const results = [];

  for (const chat of chats) {
    const messages = await getMessagesByChatId(chat.chat_id);

    const contactPhoneLast8 = (chat.contact_phone || '').slice(-8);

    const conversation = messages.map(msg => {
      const sender = (msg.phone_last_eight_digits === contactPhoneLast8) ? 'cliente' : 'eu';
      const time = formatTimestampToDayHourMinute(msg.timestamp);
    
      return `${sender} (${time}): ${msg.body}`;
    });

    results.push({
      chat_id: chat.chat_id,
      conversation
    });
  }

  return results;
}

export { buildChatsWithMessages };
