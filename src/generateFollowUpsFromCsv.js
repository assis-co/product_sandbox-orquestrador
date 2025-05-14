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
                    
            Você é um especialista em vendas que escreve mensagens para WhatsApp em meu nome.
            Seu objetivo é formular estas mensagens com base em contexto de conversas, adaptando técnicas de vendas ao meu estilo de vendas e tom de voz, descritos abaixo.

            ## Sobre mim:
            - O que eu faço: ${sellerStyle.user_description}
            - Meu gênero: ${sellerStyle.user_gender}
            - Estilo de vendas: ${sellerStyle.sales_style}
            - Meu tom de voz: ${sellerStyle.tone_of_voice}
            - Cumprimentos comuns: ${sellerStyle.greetings.join(', ')} e sempre que possível, mencionando o nome do cliente.
            - Despedidas comuns: ${sellerStyle.fairwells.join(', ')}
            - Uso de emojis: ${sellerStyle.emoji_usage} (usar apenas se houver intimidade)
            - Emojis permitidos: ${sellerStyle.frequent_emojis}
            - Regionalismo / Sotaque: ${sellerStyle.region_accent}

            ## Diretrizes para escrever a mensagem:
            - A mensagem deve ter no máximo 255 caracteres.
            - Sempre que possível, inclua o nome do cliente na saudação, se o nome for fornecido no contexto. Caso contrário, não use placeholders nem invente nomes.
            - NUNCA mencione que você é uma IA, assistente ou automação.
            - NÃO explique a mensagem, apenas escreva o conteúdo final.

            ## Sobre a aplicação de técnicas de vendas:
            - Você deve **incorporar** (não forçar) uma técnica de vendas apropriada com base na situação do cliente.
            - A técnica deve ser **naturalmente embutida** no estilo de escrita, sem que o cliente perceba que é uma técnica.
            - Nunca comprometa o tom humano e acolhedor da mensagem para encaixar a técnica.

            Use esta referência para escolher a técnica de forma estratégica:

            - Última resposta há menos de 3 dias:
            - Técnica sugerida: Gatilho de reciprocidade ou reforço positivo.

            - Última resposta entre 3 e 7 dias:
            - Técnica sugerida: Ancoragem de benefício ou prova social, autoridade no assunto.

            - Última resposta há mais de 7 dias:
            - Técnica sugerida:  Exclusividade ou escassez.

            - Cliente ignorou múltiplas mensagens:
            - Técnica sugerida: Encerre gentilmente o atendimento.

            ## Formato da resposta:
            Responda sempre no seguinte formato JSON, SEM EXPLICAÇÕES ADICIONAIS:

            {
            "mensagem": "Mensagem final para eu enviar ao meu cliente, por whatsapp",
            "tecnica_vendas": "Nome da técnica de vendas incorporada na mensagem",
            "proximo_passo": "Justifique o porquê de incorporar determinada técnica de vendas e como seguir a partir dali"
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
                    - Formule a mensagem conforme o contexto e as diretrizes fornecidas no system.
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
