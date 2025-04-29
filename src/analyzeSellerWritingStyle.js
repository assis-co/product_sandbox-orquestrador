import { supabase } from './supabaseClient.js';
import { openai } from './openaiClient.js';
import { writeFile } from 'fs/promises';

/**
 * Busca todas as mensagens dos chats e filtra apenas as do seller
 */
async function getAllSellerMessages(chatIds) {
  const { data, error } = await supabase
    .from('messages')
    .select('body, message_from, phone_last_eight_digits, chat_id')
    .in('chat_id', chatIds)
    .order('timestamp', { ascending: true });

  if (error) throw error;

  const sellerMessages = data
    .filter(msg => {
      const fromLast8 = msg.message_from?.slice(-8);
      return fromLast8 !== msg.phone_last_eight_digits;
    })
    .map(msg => msg.body)
    .filter(Boolean);

  return sellerMessages;
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
Analise o estilo de escrita da pessoa com base nas mensagens abaixo. Seu objetivo é descrever o estilo de escrita.

Retorne um JSON com os seguintes campos:
{
  "user_description": "O que essa pessoa faz? Como trabalha? Quem ela atende?",
  "user_gender": "feminino ou masculino",
  "tone_of_voice": "Descreva o tom de voz da pessoa (ex: leve, acolhedor, informal, engraçado, objetivo...)",
  "greetings": ["lista de cumprimentos que ela costuma usar"],
  "fairwells": ["lista de despedidas que ela costuma usar"],
  "region_accent": "Se identificar o uso de gírias ou regionalismos, descreva aqui"
  "emoji_usage":  Identifique se a pessoa utiliza emojis em mensagens de saudação ou despedida. True or False
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
        content: 'Você é um analista que extrai estilo de escrita humana com base em mensagens.'
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
