import { config } from 'dotenv';
config();

import { readFile, writeFile } from 'fs/promises';
import Papa from 'papaparse';
import { openai } from './openaiClient.js';

export async function generateFollowUpsFromCsv() {
  const sellerStyleRaw = await readFile('./seller_writing_profile.json', 'utf8');
  const sellerStyle = JSON.parse(sellerStyleRaw);

  const csvContent = await readFile('./chat_analysis_resultados.csv', 'utf8');
  const parsed = Papa.parse(csvContent, {
    header: true,
    skipEmptyLines: true
  });

  const chats = parsed.data;
  const followUps = [];

  for (const chat of chats) {
    if (chat.need_task !== 'true') continue;

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `
        Você é um assistente de vendas especializado em WhatsApp. Com base em uma conversa entre "Eu (vendedor)" e um cliente, sua tarefa é gerar uma mensagem de **follow-up personalizada**.

        Essa mensagem deve:

        - Ter estilo compatível com conversas de WhatsApp, (máx. 200 caracteres)  
        - Ser **coerente com o tom de voz do vendedor identificado na conversa**.
        - Ter 0-1 emoji total, apenas se "Eu (vendedor)" utilizar.
        - Ser adaptada ao **estágio atual da negociação** (início, dúvida, abandono, etc).
        - Referenciar de forma sutil **um dos serviços disponíveis**, se pertinente.
        - Aplicar  **pelo menos uma técnica de vendas**

        # Instruções passo a passo

        1. Leia e compreenda a conversa entre o vendedor e o cliente.
        2. Identifique:
          - O **tom de voz de "Eu (vendedor)"**.
          - O **estágio da negociação** com base nas mensagens.
        3. Gere uma mensagem de follow-up:
          - Natural, de fácil leitura e compatível com o estilo de WhatsApp.
          - Inclua uma sugestão de próximo passo apenas se fizer sentido no contexto.
          - Escolha **no máximo. 1** gatilho mental (Curiosidade, Valor, ProvaSocial, Urgência, Reciprocidade, Autoridade) — apenas se fizer sentido  
          
        # Formato da resposta
        A resposta deve conter **exclusivamente um JSON válido** com os seguintes campos:
        {
        "mensagem": "Mensagem final para eu enviar ao meu cliente, por whatsapp",
        "tecnica_vendas": "Nome da técnica de vendas aplicada na mensagem",
        "proximo_passo": "Sugestão concreta para ação seguinte que eu deva fazer"
        }
        `.trim()
          },
          {
            role: 'user',
            content: `
                    Baseado nas informações abaixo, preencha o JSON solicitado:

                    - Resumo da conversa até agora: ${chat.summary}
                    - Pendência principal: ${chat.task}
                    - Prazo para a pendência: ${chat.due_date !== '' ? chat.due_date : 'não informado'}
                    - Responsável pela próxima ação: ${chat.owner === 'buyer' ? 'cliente' : 'vendedor'}
                    - Data da última mensagem enviada pelo cliente: ${chat.last_buyer_message_time}
                    - Data da última mensagem enviada por mim: ${chat.last_seller_message_time}
                    - Quantidade de vezes que o cliente me ignorou: ${chat.total_ignored_fups}

                    Lembrete:
                    - Escolha a técnica de vendas conforme o contexto e as diretrizes fornecidas no system.
                    - Responda APENAS no formato JSON exigido, sem comentários.

            `.trim()
          }
        ]
      });

      const raw = response.choices[0].message.content.trim();

      // Extrair JSON de forma segura
      const firstCurly = raw.indexOf('{');
      const lastCurly = raw.lastIndexOf('}');
      let parsedResult;

      try {
        const jsonString = raw.slice(firstCurly, lastCurly + 1);
        parsedResult = JSON.parse(jsonString);
      } catch (error) {
        console.error(`❌ Erro ao fazer parse do JSON para chat_id ${chat.chat_id}:\n`, raw);
        continue;
      }

      followUps.push({
        chat_id: chat.chat_id,
        mensagem_gerada: parsedResult.mensagem || '',
        tecnica_vendas: parsedResult.tecnica_vendas || '',
        proximo_passo: parsedResult.proximo_passo || ''
      });

      console.log(`✔️ Mensagem gerada para chat_id: ${chat.chat_id}`);
    } catch (err) {
      console.error(`❌ Erro ao gerar mensagem para chat_id ${chat.chat_id}:`, err.message);
    }
  }

  if (followUps.length > 0) {
    const csv = Papa.unparse(followUps, {
      columns: ['chat_id', 'mensagem_gerada', 'tecnica_vendas', 'proximo_passo'],
      header: true
    });

    await writeFile('./chat_followup_mensagens.csv', csv, 'utf8');
    console.log('📁 Arquivo CSV salvo com sucesso: chat_followup_mensagens.csv');
  } else {
    console.log('⚠️ Nenhuma mensagem foi gerada.');
  }
}
