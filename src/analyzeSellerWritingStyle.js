import { supabase } from './supabaseClient.js';
import { openai } from './openaiClient.js';
import { writeFile } from 'fs/promises';

/**
 * Busca todas as mensagens dos chats e filtra apenas as do seller
 */
async function getAllSellerMessages(chatIds) {
  console.log('🔍 Debug: chatIds passed to Supabase query:', chatIds);

  const query = supabase
    .from('messages')
    .select('body, message_from, phone_last_eight_digits, chat_id', { count: 'exact', head: false })
    .in('chat_id', chatIds)
    .order('timestamp', { ascending: true });

  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Query timed out')), 30000) // 30 seconds timeout
  );

  try {
    const { data, error } = await Promise.race([query, timeout]);

    if (error) {
      console.error('❌ Supabase query error:', error);
      throw error;
    }

    console.log('📊 Supabase query result:', data);

    const sellerMessages = data
      .filter(msg => {
        const fromLast8 = msg.message_from?.slice(-8);
        return fromLast8 !== msg.phone_last_eight_digits;
      })
      .map(msg => msg.body)
      .filter(Boolean);

    return sellerMessages;
  } catch (err) {
    console.error('❌ Error in getAllSellerMessages:', err);
    throw err;
  }
}

/**
 * Gera um único perfil de escrita baseado nas mensagens do seller
 */
export async function generateGlobalSellerWritingProfile(chats) {
  const chatIds = chats.map(c => c.chat_id);
  const messages = await getAllSellerMessages(chatIds);

  if (messages.length < 10) {
    console.warn(`⚠️ Poucas mensagens do seller para gerar perfil.`);
    return;
  }

  const prompt = `
    Analise o estilo de escrita de uma pessoa realizando vendas no whatsapp, com base nas mensagens abaixo. 
    Seu objetivo é descrever o estilo de atendimento e escrita.

    Retorne um JSON com os seguintes campos:
    {
      "user_description": "O que essa pessoa faz? Como trabalha? Quem ela atende?",
      "user_gender": "feminino ou masculino",
      "sales_style": "Descrição detalhada do processo de atendimentos bem sucedidos (etapa a etapa)",
      "tone_of_voice": "Descreva o tom de voz da pessoa (ex: leve, acolhedor, informal, engraçado, objetivo...)",
      "greetings": ["lista de cumprimentos que ela costuma usar"] desconsidere nomes próprios e apelidos,
      "fairwells": ["lista de despedidas que ela costuma usar"] desconsidere nomes próprios e apelidos,
      "region_accent": "Se identificar o uso de gírias ou regionalismos, descreva aqui",
      "emoji_usage":  Identifique se a pessoa utiliza emojis em mensagens de saudação ou despedida. True or False,
      "frequent_emojis": Emojis identificados
    }

    Não escreva nada fora do JSON. Analise com base apenas nas mensagens.

---

${messages.join('\n')}
  `.trim();
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: 'Você é um analista que descreve o perfil profissional de uma pessoa vendedora, com base em mensagens enviadas por ela no WhatsApp.'
      },
      {
        role: 'user',
        content: prompt
      }
    ]
  });
  const raw = response.choices[0].message.content.trim();
  const firstCurly = raw.indexOf('{');
  const lastCurly = raw.lastIndexOf('}');
  let parsed = null;

  try {
    const json = raw.slice(firstCurly, lastCurly + 1);
    parsed = JSON.parse(json);
  } catch (err) {
    console.error('❌ Erro ao fazer parse do perfil global:\n', raw);
    return;
  }

  await writeFile('./seller_writing_profile.json', JSON.stringify(parsed, null, 2), 'utf8');
  console.log('📁 Arquivo salvo: seller_writing_profile.json');
}
