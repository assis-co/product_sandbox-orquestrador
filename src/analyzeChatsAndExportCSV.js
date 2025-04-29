import { getChatsByCompany } from './getChatsByCompany.js';
import { buildChatsWithMessages } from './buildChatsWithMessages.js';
import { openai } from './openaiClient.js';
import { writeFile } from 'fs/promises';
import Papa from 'papaparse';

export async function analyzeChatsAndExportCSV(companyId) {
  const chats = await getChatsByCompany(companyId);
  const chatsWithConvo = await buildChatsWithMessages(chats);

  const results = [];

  for (const chat of chatsWithConvo) {
    const fullChat = chats.find(c => c.chat_id === chat.chat_id);

    const input = {
      chat_id: chat.chat_id,
      company_id: fullChat.company_id,
      last_message_time: fullChat.last_message_time,
      last_buyer_message_time: fullChat.last_buyer_message_time,
      last_seller_message_time: fullChat.last_seller_message_time,
      total_ignored_fups: fullChat.total_ignored_fups,
      conversation: chat.conversation
    };

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `
                    Você é um assistente que está me ajudando a organizar minha lista de tarefas com base nas minhas conversas com clientes.
                    Seu objetivo é analisar uma conversa no WhatsApp e identificar se há alguma pendência entre mim (eu) e o contato (cliente)
                    Meu objetivo é sempre estar em contato com o meu cliente e fazê-los contratar meus serviços.

                    Instruções:
                    - Leia toda a conversa com atenção
                    - Use os timestamps para entender a ordem das mensagens
                    - Considere os seguintes dados da conversa:
                        - Data da Última mensagem do cliente (cliente): ${input.last_buyer_message_time}
                        - Data da Última mensagem enviada por mim: ${input.last_seller_message_time}
                        - Total de follow-ups ignorados: ${input.total_ignored_fups}
                        - Sempre responda estritamente no formato JSON solicitado, sem comentários adicionais.
            `.trim()
          },
          {
            role: 'user',
            content: `
                        Analise a conversa e retorne um JSON com os seguintes campos:
                        {
                        "chat_id": "${input.chat_id}",
                        "company_id": "${input.company_id}",
                        "last_message_time": "${input.last_message_time}" ou null,
                        "last_buyer_message_time": "${input.last_buyer_message_time}" ou null,
                        "last_seller_message_time": "${input.last_seller_message_time}" ou null,
                        "total_ignored_fups": ${input.total_ignored_fups},
                        "summary": "Resumo das últimas interações (máximo 400 caracteres)",
                        "need_task": true ou false,
                        "task": "Descrição da pendência principal (máximo 400 caracteres)",
                        "due_date": "2025-05-02" ou null,
                        "owner": "buyer ou seller"
                        }
                        
                        ---- 

                        # Conversa para você analisar:
                        ${input.conversation.join('\n')}
                                    `.trim()
          }
        ]
      });

      const raw = response.choices[0].message.content.trim();

        // Extração segura do JSON
        const firstCurly = raw.indexOf('{');
        const lastCurly = raw.lastIndexOf('}');

        let jsonContent = raw;
        if (firstCurly !== -1 && lastCurly !== -1) {
        jsonContent = raw.slice(firstCurly, lastCurly + 1);
        }

        let resultado;
        try {
        resultado = JSON.parse(jsonContent);
        
        // Pós-processamento
        if (typeof resultado.last_buyer_message_time === 'string' && resultado.last_buyer_message_time.toLowerCase() === 'null') {
            resultado.last_buyer_message_time = null;
        }
        if (typeof resultado.last_seller_message_time === 'string' && resultado.last_seller_message_time.toLowerCase() === 'null') {
            resultado.last_seller_message_time = null;
        }
        if (typeof resultado.total_ignored_fups === 'string') {
            resultado.total_ignored_fups = parseInt(resultado.total_ignored_fups) || 0;
        }
        if (typeof resultado.need_task === 'string') {
            resultado.need_task = resultado.need_task.toLowerCase() === 'true';
        }
        if (typeof resultado.owner === 'string') {
            resultado.owner = resultado.owner.toLowerCase();
        }
        
        } catch (err) {
        console.error(`❌ Erro ao fazer parse do JSON para ${input.chat_id}:\n`, raw);
        resultado = {
            chat_id: input.chat_id,
            company_id: input.company_id,
            last_message_time: input.last_message_time,
            last_buyer_message_time: input.last_buyer_message_time,
            last_seller_message_time: input.last_seller_message_time,
            total_ignored_fups: input.total_ignored_fups,
            summary: '',
            need_task: false,
            task: '',
            due_date: null,
            owner: ''
        };
        }

      results.push({
        chat_id: resultado.chat_id,
        company_id: resultado.company_id,
        last_message_time: resultado.last_message_time !== null ? String(resultado.last_message_time) : '',
        last_buyer_message_time: resultado.last_buyer_message_time !== null ? String(resultado.last_buyer_message_time) : '',
        last_seller_message_time: resultado.last_seller_message_time !== null ? String(resultado.last_seller_message_time) : '',
        total_ignored_fups: resultado.total_ignored_fups !== null ? parseInt(resultado.total_ignored_fups) : 0,
        summary: resultado.summary || '',
        need_task: resultado.need_task === true,
        task: resultado.task || '',
        due_date: resultado.due_date || '',
        owner: resultado.owner || ''
      });

      console.log(`✔️ ${input.chat_id} → ${resultado.need_task ? 'com pendência' : 'sem pendência'}`);
    } catch (err) {
      console.error(`❌ Erro ao analisar ${input.chat_id}:`, err.message);
    }
  }

  if (results.length > 0) {
    const csv = Papa.unparse(results, {
      columns: [
        'chat_id',
        'company_id',
        'last_message_time',
        'last_buyer_message_time',
        'last_seller_message_time',
        'total_ignored_fups',
        'summary',
        'need_task',
        'task',
        'due_date',
        'owner'
      ],
      header: true
    });

    await writeFile('./chat_analysis_resultados.csv', csv, 'utf8');
    console.log('📁 Arquivo CSV salvo com sucesso: chat_analysis_resultados.csv');
  } else {
    console.log('⚠️ Nenhum resultado para exportar.');
  }
}
