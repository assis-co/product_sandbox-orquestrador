import { config } from 'dotenv';
config();

import { readFile, writeFile } from 'fs/promises';
import Papa from 'papaparse';
import { openai } from './openaiClient.js';

export async function generateFollowUpsFromCsv() {
  // 1. Lê o CSV
  const csvContent = await readFile('./chat_analysis_resultados.csv', 'utf8');
  const parsed = Papa.parse(csvContent, {
    header: true,
    skipEmptyLines: true
  });

  const chats = parsed.data;
  const followUps = [];

  for (const chat of chats) {
    if (chat.need_task !== 'true') continue; // Só continua se precisar de tarefa

    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
              {
                role: 'system',
                content: `
                        Você é um especialista em vendas que me dá suporte na condução de negociações
                        Seu objetivo é criar mensagens personalizadas para que eu possa enviá-las aos meus clientes, no WhatsApp.
                        
                        Essa mensagem deve:

                        - Ter estilo compatível com conversas de WhatsApp, (máx. 255 caracteres)  
                        - Ser **coerente com o meu tom de voz identificado na conversa**.
                        - Aplicar técnicas de vendas, considerando:
                            - Resumo da conversa
                            - A pendência na negociação
                            - Quem é responsável por resolver a pendência
                            - O tempo desde a última mensagem enviada pelo cliente. 
                               - Se foi há menos de 3 dias, utilize abordagem soft
                               - Se foi há mais de 3 dias e menos de 7 dias, escale o tom da abordagem (utilize gatilhos emocionais)
                               - Se foi há mais de 7 dias, encerre o atendimento e se coloque à disposição do cliente.

                `.trim()
              },
              {
                role: 'user',
                content: `
                            Baseado nas informações abaixo, escreva uma mensagem para eu enviar ao meu cliente no WhatsApp:
                            
                            - Resumo da conversa até agora: ${chat.summary}
                            - Pendência principal: ${chat.task}
                            - Prazo para a pendência: ${chat.due_date !== '' ? chat.due_date : 'não informado'}
                            - Responsável pela próxima ação: ${chat.owner === 'buyer' ? 'cliente' : 'vendedor'}
                            - Data da última mensagem enviada pelo cliente: ${chat.last_buyer_message_time}
                            - Data da última mensagem enviada por mim: ${chat.last_seller_message_time} 
                            - Quantidade de vezes que o cliente me ignorou: ${chat.total_ignored_fups}
                            Lembrete:
                            - A mensagem deve ser natural e voltada para estimular o próximo passo da conversa.
                            - Apenas escreva a mensagem no formato de WhatsApp, sem explicações ou introduções.
                `.trim()
              }
            ]
          });
          

      const mensagemGerada = response.choices[0].message.content.trim();

      followUps.push({
        chat_id: chat.chat_id,
        mensagem_gerada: mensagemGerada
      });

      console.log(`✔️ Mensagem gerada para chat_id: ${chat.chat_id}`);
    } catch (err) {
      console.error(`❌ Erro ao gerar mensagem para chat_id ${chat.chat_id}:`, err.message);
    }
  }

  // 4. Salvar novo CSV
  if (followUps.length > 0) {
    const csv = Papa.unparse(followUps, {
      columns: ['chat_id', 'mensagem_gerada'],
      header: true
    });

    await writeFile('./chat_followup_mensagens.csv', csv, 'utf8');
    console.log('📁 Arquivo CSV salvo com sucesso: chat_followup_mensagens.csv');
  } else {
    console.log('⚠️ Nenhuma mensagem foi gerada.');
  }
}
