import { v4 as uuidv4 } from 'uuid';
import { storage } from "./storage";
import { log } from "./vite";
import { Instance, MessageFlow, InsertMessageHistory } from "@shared/schema";
import { messageQueueManager } from "./message-queue-manager";
import { sendToExternalWebhook } from "./external-webhook-service";
import { flowQueueService } from "./flow-queue-service";
import { triggerFlowWithMessage } from "./flow-message-trigger";

/**
 * Extrai um possível nome de contato da mensagem
 * Função utilitária que tenta encontrar um nome de pessoa em uma mensagem de texto
 */
function extractContactName(phoneNumber: string, messageContent: string): string | undefined {
  // Tentativa 1: Busca padrões comuns como "Olá, sou [Nome]" ou "Meu nome é [Nome]"
  const patterns = [
    /(?:oi|olá|ola),?\s+(?:eu\s+)?(?:sou|me\s+chamo)\s+([A-Za-zÀ-ÖØ-öø-ÿ\s]{2,20})/i,
    /(?:meu|o\s+meu)\s+nome(?:\s+é|\s+e)?\s+([A-Za-zÀ-ÖØ-öø-ÿ\s]{2,20})/i,
    /(?:aqui|aki)\s+(?:é|e)\s+(?:o|a)?\s*([A-Za-zÀ-ÖØ-öø-ÿ\s]{2,20})/i,
    /(?:^|\s)([A-Za-zÀ-ÖØ-öø-ÿ]{2,20})\s+(?:falando|aqui|aki)/i
  ];

  for (const pattern of patterns) {
    const match = messageContent.match(pattern);
    if (match && match[1]) {
      // Limpa o nome encontrado e remove palavras muito curtas
      const nameParts = match[1].trim().split(/\s+/).filter(part => part.length >= 2);
      if (nameParts.length > 0) {
        return nameParts.join(' ');
      }
    }
  }

  // Se não encontrou um nome específico, retorna undefined
  return undefined;
}

/**
 * Processa uma mensagem recebida e verifica se deve disparar algum fluxo
 * Versão simplificada que aceita diretamente o objeto de instância ou o nome da instância
 */
/**
 * Processa uma mensagem recebida, verificando se deve acionar algum fluxo de mensagens
 * Versão aprimorada com suporte a envio para webhook externo
 * @param instanceOrName Objeto da instância ou ID/nome da instância
 * @param fromNumber Número de telefone que enviou a mensagem
 * @param messageContent Conteúdo da mensagem recebida
 * @param messageId ID opcional da mensagem no WhatsApp
 * @param timestamp Timestamp da mensagem em milissegundos
 * @param sendToWebhook Se deve enviar para webhook externo quando encontrar correspondência
 * @returns true se a mensagem foi processada por algum fluxo, false caso contrário
 */
export async function processIncomingMessage(
  instanceOrName: Instance | string, 
  fromNumber: string, 
  messageContent: string,
  messageId?: string,
  timestamp: number = Date.now(),
  sendToWebhook: boolean = true
): Promise<boolean> {
  try {
    // Determina se recebemos um objeto de instância ou apenas o nome
    let instance: Instance | null = null;

    if (typeof instanceOrName === 'string') {
      const instanceName = instanceOrName;
      log(`[MessageProcessor] Processando mensagem recebida para instância ${instanceName}`, 'message-processor');

      // Se é um UUID, busca diretamente pelo ID
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      if (uuidPattern.test(instanceName)) {
        instance = await storage.getInstance(instanceName) || null;
      } else {
        // Busca pelo nome da instância
        const instances = await storage.getInstancesByName(instanceName);
        if (instances && instances.length > 0) {
          // Prioriza instâncias conectadas
          instance = instances.find(i => i.status === 'connected') || instances[0];
        }
      }

      if (!instance) {
        log(`[MessageProcessor] Instância não encontrada: ${instanceName}`, 'message-processor');
        return false;
      }
    } else {
      // Já recebemos o objeto de instância diretamente
      instance = instanceOrName;
    }

    // Log detalhado da mensagem sendo processada
    log(`[MessageProcessor] Processando mensagem:
      - Instância: ${instance.name} (ID: ${instance.id})
      - Remetente: ${fromNumber}
      - Mensagem: "${messageContent}" 
      - ID Mensagem: ${messageId || 'não fornecido'}
      - Timestamp: ${new Date(timestamp).toISOString()}`, 
    'message-processor');
    console.log(instance, fromNumber, messageContent)
    // Processa os fluxos para esta instância
    return await processFlowsForInstance(instance, fromNumber, messageContent, timestamp, messageId, sendToWebhook);

  } catch (error: any) {
    log(`[MessageProcessor] Erro ao processar mensagem: ${error.message || error}`, 'message-processor');
    console.error('[MessageProcessor] Erro detalhado:', error);

    return false;
  }
}

/**
 * Processa os fluxos para uma instância específica
 * Exportado para permitir testes diretos sem verificação de conexão
 * O parâmetro sendToWebhook controla se os dados do fluxo devem ser enviados para o webhook externo
 */
export async function processFlowsForInstance(
  instance: Instance, 
  fromNumber: string, 
  messageContent: string,
  timestamp: number = Date.now(),
  messageId?: string,
  sendToWebhook: boolean = true
): Promise<boolean> {
  try {
    // Usamos a função triggerFlowWithMessage importada no topo do arquivo para evitar dependências circulares

    // Preparamos os dados da mensagem
    const messageData = {
      instanceId: instance.id,
      instanceName: instance.name,
      fromNumber: fromNumber,
      messageContent: messageContent,
      messageId: messageId,
      timestamp: timestamp,
      userId: instance.userId
    };

    // Aciona diretamente o fluxo através do triggerFlowWithMessage
    // Isso garante que as mensagens vão para a fila de fluxos
    const triggerResult = await triggerFlowWithMessage(messageData);

    // Verifica se algum fluxo foi acionado
    if (triggerResult.success && triggerResult.triggered) {
      log(`[MessageProcessor] ✅ Fluxo "${triggerResult.flowName}" acionado com sucesso via triggerFlowWithMessage!`, 'message-processor');

      // Registra atividade
      await storage.createActivity(instance.userId, {
        type: 'message_flow_triggered',
        description: `Fluxo "${triggerResult.flowName}" acionado por ${fromNumber} com a palavra-chave "${triggerResult.keyword || 'N/A'}"`,
        entityType: 'message_flow',
        entityId: triggerResult.flowId
      });

      return true;
    }

    // Tratamento especial para palavra-chave "chat"
    const messageContentLower = messageContent.toLowerCase().trim();
    if (messageContentLower.includes('chat')) {
      log(`[MessageProcessor] 🔔 Palavra-chave prioritária "chat" encontrada! Processando como backup...`, 'message-processor');

      // Busca todos os fluxos de mensagens ativos para esta instância
      const allFlows = await storage.getMessageFlowsByInstanceId(instance.id);
      const activeFlows = allFlows.filter(flow => flow.status === 'active');

      // Busca um fluxo específico para "chat" ou usa o primeiro fluxo ativo disponível
      const chatFlow = activeFlows.find(f => f.keyword.toLowerCase() === 'chat') || activeFlows[0];

      if (chatFlow) {
        log(`[MessageProcessor] Usando fluxo "${chatFlow.name}" para resposta automática à palavra-chave "chat"`, 'message-processor');

        // Preparamos o conteúdo da mensagem para o histórico
        let messageContentToSave = messageContent;
        if (messageId) {
          try {
            const messageData = {
              text: messageContent,
              id: messageId,
              timestamp
            };
            messageContentToSave = JSON.stringify(messageData);
          } catch (e) {
            // Em caso de erro, mantém o conteúdo original
            console.error("Erro ao formatar mensagem para histórico:", e);
          }
        }

        // Dispara o fluxo imediatamente
        await triggerMessageFlow(instance.name, chatFlow, fromNumber, messageContent);

        // Registra atividade
        await storage.createActivity(instance.userId, {
          type: 'message_flow_triggered',
          description: `Resposta automática: Fluxo "${chatFlow.name}" acionado por ${fromNumber} com a palavra-chave "chat"`,
          entityType: 'message_flow',
          entityId: chatFlow.id
        });

        // Registra no histórico de mensagens com status "triggered"
        const historyEntry = await storage.createMessageHistory(instance.userId, {
          instanceId: instance.id,
          instanceName: instance.name,
          sender: fromNumber,
          messageContent: messageContentToSave,
          flowId: chatFlow.id,
          triggeredKeyword: 'chat',
          status: "triggered",
          timestamp: timestamp ? new Date(timestamp) : new Date()
        });

        // Se solicitado, também enviar para webhook externo
        if (sendToWebhook) {
          try {
            await sendToExternalWebhook(
              chatFlow,
              {
                phoneNumber: fromNumber,
                messageContent: messageContent,
                messageId: messageId,
                timestamp: timestamp
              },
              {
                id: instance.id,
                name: instance.name,
                status: instance.status
              }
            );
            log(`[MessageProcessor] Webhook externo notificado para resposta automática à "chat"`, 'message-processor');
          } catch (webhookError) {
            log(`[MessageProcessor] Erro ao notificar webhook para resposta automática: ${webhookError}`, 'message-processor');
          }
        }

        return true;
      }
    }

    // Registra a mensagem recebida no histórico (independentemente de acionar um fluxo)
    // Se tivermos um messageId, armazenamos informações adicionais como JSON
    let messageContentToSave = messageContent;
    if (messageId) {
      try {
        const messageData = {
          text: messageContent,
          id: messageId,
          timestamp
        };
        messageContentToSave = JSON.stringify(messageData);
      } catch (e) {
        // Em caso de erro, mantém o conteúdo original
        console.error("Erro ao formatar mensagem para histórico:", e);
      }
    }

    const messageHistoryData: InsertMessageHistory = {
      instanceId: instance.id,
      instanceName: instance.name,
      sender: fromNumber,
      messageContent: messageContentToSave,
      flowId: null,
      triggeredKeyword: null,
      status: "no_match",
      timestamp: timestamp ? new Date(timestamp) : new Date()
    };

    // Busca todos os fluxos de mensagens ativos para esta instância
    const allFlows = await storage.getMessageFlowsByInstanceId(instance.id);
    const activeFlows = allFlows.filter(flow => flow.status === 'active');

    if (activeFlows.length === 0) {
      // Ainda registramos a mensagem no histórico, mas com status "no_match"
      await storage.createMessageHistory(instance.userId, messageHistoryData);
      return false;
    }

    // Log para diagnóstico do processamento
    log(`[MessageProcessor] Processando mensagem: "${messageContent}" para ${fromNumber}`, 'message-processor');

    // Debug para mostrar todos os fluxos ativos
    activeFlows.forEach(flow => {
      log(`[MessageProcessor] Fluxo ativo: "${flow.name}" (keyword: "${flow.keyword}")`, 'message-processor');
    });

    let bestKeywordMatch: string | null = null;
    let bestMatchType: string = 'nenhuma';
    let bestMatchFlow: MessageFlow | null = null;

    const triggeredFlows = activeFlows.filter(async flow => {
      // Se o fluxo não tiver palavra-chave, pula
      if (!flow.keyword) {
        console.log(`[MessageProcessor] Fluxo "${flow.name}" sem palavra-chave, pulando`);
        return false;
      }

      console.log(`[MessageProcessor] Analisando fluxo: "${flow.name}" - ID: ${flow.id}`);
      console.log(`[MessageProcessor] - Palavra-chave: "${flow.keyword}"`);
      console.log(`[MessageProcessor] - Tipo de gatilho: ${flow.triggerType || "exact_match"} (padrão se não especificado)`);
      console.log(`[MessageProcessor] - Mensagem recebida: "${messageContent}"`);

      // Normaliza o tipo de gatilho para lidar com todas as variações possíveis (hífen ou underscore)
      const normalizedTriggerType = String(flow.triggerType || "exact_match").toLowerCase().trim();

      // Determina o comportamento baseado no tipo normalizado
      const isExactMatch = normalizedTriggerType === "exact_match" || normalizedTriggerType === "exact-match";
      const isContains = normalizedTriggerType === "contains" || normalizedTriggerType === "contains_text" || normalizedTriggerType === "contains-text";
      const isAllMessages = normalizedTriggerType === "all_messages" || normalizedTriggerType === "all-messages";

      console.log(`[MessageProcessor] - Tipo de gatilho normalizado: exact=${isExactMatch}, contains=${isContains}, all=${isAllMessages}`);

      // Simplifica a lógica posterior
      const shouldProcessAllMessages = isAllMessages;

      // Normalização robusta das strings para comparação
      const keyword = flow.keyword.toLowerCase().trim();
      let messageContentLower = messageContent.toLowerCase().trim();

      // Remove acentos para comparação
      const normalizeString = (str: string) => {
        return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      };

      const normalizedKeyword = normalizeString(keyword);
      const normalizedMessage = normalizeString(messageContentLower);

      // Suporte para múltiplas palavras-chave separadas por vírgula
      const keywordVariations = normalizedKeyword.split(',').map(k => k.trim()).filter(Boolean);

      // Indicador de correspondência encontrada
      let hasMatch = shouldProcessAllMessages; // Para all_messages, já inicializa como true
      let keywordMatched = shouldProcessAllMessages ? "(todas as mensagens)" : "";
      let matchType = shouldProcessAllMessages ? 'todas_mensagens' : 'nenhuma';

      // Se não é para processar todas as mensagens, verifica correspondências
      if (!shouldProcessAllMessages) {
        // Split das palavras para análise mais precisa
        const messageWords = normalizedMessage.split(/\s+/);

        // Testa cada variação de palavra-chave (separadas por vírgula)
        for (const currentKeyword of keywordVariations) {
          const keywordWords = currentKeyword.split(/\s+/);

          // Modo 1: Correspondência exata (mais alta prioridade)
          const isExactMatch = normalizedMessage === currentKeyword;

          // Modo 2: Correspondência de início
          let isStartMatch = false;
          if (currentKeyword.includes(" ")) {
            // Múltiplas palavras - verifica se a mensagem começa com a frase
            isStartMatch = normalizedMessage.startsWith(currentKeyword);
          } else {
            // Palavra única - verifica se a primeira palavra é a palavra-chave
            isStartMatch = messageWords[0] === currentKeyword;
          }

          // Modo 3: Correspondência em qualquer lugar (usado apenas para triggerType "contains")
          let isContainedMatch = false;

          // Só fazemos a verificação de contém se o tipo de gatilho normalizado for "contains"
          if (isContains) {
            if (keywordWords.length > 1) {
              // Para frases de múltiplas palavras, verificamos como substring
              isContainedMatch = normalizedMessage.includes(currentKeyword);
            } else {
              // Para palavras únicas, primeiro verificamos como palavra completa (delimitada por espaços ou pontuação)
              try {
                // Testamos se a palavra aparece como unidade separada
                const wordPattern = new RegExp(`(^|[^a-zA-Z0-9])${currentKeyword}([^a-zA-Z0-9]|$)`, 'i');
                isContainedMatch = wordPattern.test(normalizedMessage);

                // Depois verificamos se a palavra está presente como parte significativa de uma palavra maior
                // Isso é útil para casos como "comprar" em "querocomprar" 
                if (!isContainedMatch && currentKeyword.length > 3) {
                  isContainedMatch = messageWords.some(word => {
                    // Aceitamos a palavra-chave se ela for pelo menos 60% do tamanho da palavra em que está contida
                    return word.includes(currentKeyword) && 
                           currentKeyword.length >= word.length * 0.6;
                  });
                }
              } catch (regexError) {
                // Se a expressão regular falhar (por caracteres especiais), voltamos para o método simples
                log(`[MessageProcessor] Erro na regex para "${currentKeyword}": ${regexError}. Usando método alternativo.`, 'message-processor');
                isContainedMatch = normalizedMessage.includes(` ${currentKeyword} `) || 
                                  normalizedMessage.startsWith(`${currentKeyword} `) || 
                                  normalizedMessage.endsWith(` ${currentKeyword}`);
              }
            }

            // 3.2 - Como palavras completas individuais (verifica cada palavra separadamente)
            let isWordMatch = false;
            if (!isContainedMatch && isContains) {
              // Verificação 1: palavras exatas
              // Verifica se qualquer uma das palavras-chave está presente como palavra completa na mensagem
              isWordMatch = keywordWords.some(keywordWord => 
                messageWords.some(messageWord => messageWord === keywordWord)
              );

              // Verificação 2 (avançada): somente para palavras-chave únicas
              // Às vezes, o usuário pode digitar a palavra-chave junto com outra palavra ou pontuação
              // Exemplo: "querocomprar" ou "comprar!" ou "#comprar"
              if (!isWordMatch && keywordWords.length === 1 && currentKeyword.length > 3) {
                // Para palavras-chave longas (mais de 3 caracteres), verificamos se estão contidas em alguma palavra
                isWordMatch = messageWords.some(messageWord => 
                  // Verificamos se a palavra-chave está contida, mas apenas se for parte significativa
                  // Por exemplo, "comprar" em "compraremos" (aceitável) vs "ar" em "comprar" (muito curto)
                  messageWord.includes(currentKeyword) && 
                  currentKeyword.length > messageWord.length / 2
                );
              }

              // Para triggerType "contains", qualquer correspondência de palavra é considerada válida
              isContainedMatch = isContainedMatch || isWordMatch;
            }
          }

          // Lógica ajustada de acordo com o tipo de gatilho
          // - Para exact_match: só aceita correspondência exata ou de início
          // - Para contains: aceita qualquer tipo de correspondência
          // - Para all_messages: já iniciamos com hasMatch = true

          // Determina se houve correspondência baseado no tipo de gatilho
          // Usamos os flags boolean de tipo de gatilho normalizados
          const currentHasMatch = 
            (isExactMatch && (isExactMatch || isStartMatch)) || 
            (isContains && (isExactMatch || isStartMatch || isContainedMatch)) ||
            isAllMessages; // all_messages sempre retorna true

          // Log detalhado da comparação
          console.log(`[MessageProcessor] Verificando correspondência: 
            - Tipo de gatilho: ${normalizedTriggerType}
            - Palavra-chave: "${currentKeyword}" 
            - Mensagem: "${normalizedMessage.substring(0, 30)}${normalizedMessage.length > 30 ? '...' : ''}"
            - Correspondência exata: ${isExactMatch}
            - Correspondência de início: ${isStartMatch}
            - Correspondência contida: ${isContainedMatch}
            - RESULTADO: ${currentHasMatch ? 'CORRESPONDÊNCIA ENCONTRADA' : 'Sem correspondência'}`);

          // Calcula o tipo de correspondência para logging (na ordem: exata > início > contida)
          const currentMatchType = isExactMatch ? 'exata' : 
                              isStartMatch ? 'início' : 
                              isContainedMatch ? 'contida' : 'nenhuma';

          // Logging detalhado do processo de comparação para diagnóstico
          log(`[MessageProcessor] Comparando palavra-chave: "${currentKeyword}" com mensagem: "${messageContentLower.substring(0, 50)}${messageContentLower.length > 50 ? '...' : ''}" (tipo: ${normalizedTriggerType})`, 'message-processor');
          log(`[MessageProcessor] Modos: Exata:${isExactMatch}, Início:${isStartMatch}, Contida:${isContainedMatch}`, 'message-processor');

          // Se esta variação de palavra-chave encontrou correspondência
          if (currentHasMatch) {
            // Atualiza a correspondência para o fluxo atual
            hasMatch = true;
            keywordMatched = currentKeyword;
            matchType = currentMatchType;
            log(`[MessageProcessor] ✓ Correspondência "${matchType}" encontrada para: "${currentKeyword}"`, 'message-processor');
            break; // Encontrou correspondência para uma das variações, sai do loop
          }
        }
      }

      // Se encontrou correspondência ou devemos processar todas as mensagens
      if (hasMatch || shouldProcessAllMessages) {
        log(`[MessageProcessor] 🔔 Fluxo acionado: "${flow.name}" - Palavra-chave: "${keywordMatched}" (Tipo: ${matchType})`, 'message-processor');

        // Atrasa o disparo do fluxo, se configurado (usando a propriedade correta do objeto flow)
        // Verifica se o fluxo tem um atraso de trigger definido
        const triggerDelay = flow.messages?.length > 0 && flow.messages[0].delay ? flow.messages[0].delay : 0;

        if (triggerDelay > 0) {
          log(`[MessageProcessor] Fluxo "${flow.name}" tem atraso configurado de ${triggerDelay}s. Agendando...`, 'message-processor');

          // Atualiza o histórico com o fluxo encontrado
          messageHistoryData.flowId = flow.id;
          messageHistoryData.triggeredKeyword = keywordMatched;
          messageHistoryData.status = "triggered";

          // Registra a mensagem no histórico com o fluxo associado antes de agendar
          const historyEntry = await storage.createMessageHistory(instance.userId, messageHistoryData);

          

          // Registra atividade
          await storage.createActivity(instance.userId, {
            type: 'message_flow_triggered',
            description: `Fluxo "${flow.name}" acionado por ${fromNumber} com a palavra-chave "${keywordMatched}"`,
            entityType: 'message_flow',
            entityId: flow.id
          });

          // Se solicitado, também enviar para webhook externo
          if (sendToWebhook) {
            try {
              await sendToExternalWebhook(
                flow, 
                {
                  phoneNumber: fromNumber,
                  messageContent: messageContent,
                  messageId: messageId,
                  timestamp: timestamp
                },
                {
                  id: instance.id,
                  name: instance.name,
                  status: instance.status
                }
              );
            } catch (webhookError: unknown) {
              log(`[MessageProcessor] Erro ao enviar webhook: ${webhookError}`, 'message-processor');
            }
          }

          // Agendamos o disparo com o atraso configurado (convertendo para ms)
          setTimeout(async () => {
            try {
              log(`[MessageProcessor] Executando fluxo "${flow.name}" após atraso de ${triggerDelay}s`, 'message-processor');
              await triggerMessageFlow(instance.name, flow, fromNumber, messageContent);
            } catch (delayError) {
              log(`[MessageProcessor] Erro ao executar fluxo com atraso: ${delayError}`, 'message-processor');
            }
          }, triggerDelay * 1000);

          return true;
        } else {
          // Sem atraso, dispara imediatamente
          await triggerMessageFlow(instance.name, flow, fromNumber, messageContent);

          // Atualiza o histórico com o fluxo acionado
          messageHistoryData.flowId = flow.id;
          messageHistoryData.triggeredKeyword = keywordMatched;
          messageHistoryData.status = "triggered";

          // Registra a mensagem no histórico com o fluxo associado
          await storage.createMessageHistory(instance.userId, messageHistoryData);

          // Registra atividade
          await storage.createActivity(instance.userId, {
            type: 'message_flow_triggered',
            description: `Fluxo "${flow.name}" acionado por ${fromNumber} com a palavra-chave "${keywordMatched}"`,
            entityType: 'message_flow',
            entityId: flow.id
          });

          // Se solicitado, também enviar para webhook externo
          if (sendToWebhook) {
            try {
              await sendToExternalWebhook(
                flow,
                {
                  phoneNumber: fromNumber,
                  messageContent: messageContent,
                  messageId: messageId,
                  timestamp: timestamp
                },
                {
                  id: instance.id,
                  name: instance.name,
                  status: instance.status
                }
              );

              // Logs de sucesso para o popup
              log(`[MessageProcessor] ✓ Enviado com sucesso para webhook externo! Fluxo: ${flow.name}`, 'message-processor');
              console.log(`[WEBHOOK SUCCESS] Fluxo "${flow.name}" acionado por "${keywordMatched}" de ${fromNumber} enviado com sucesso para webhook externo!`);
            } catch (e) {
              // Registra o erro, mas não interrompe o fluxo
              log(`[MessageProcessor] ❌ Erro ao enviar para webhook externo: ${e}`, 'message-processor');
              console.error(`[WEBHOOK ERROR] Falha ao enviar fluxo "${flow.name}" para webhook externo:`, e);
            }
          }

          return true;
        }
      } else {
        // Rastreamos a melhor correspondência para o histórico, mesmo que não tenha ação
        if (matchType !== 'nenhuma' && (!bestKeywordMatch || 
            (matchType === 'exata' || 
             (matchType === 'início' && bestMatchType !== 'exata')))) {
          bestKeywordMatch = keywordMatched;
          bestMatchType = matchType;
          bestMatchFlow = flow;
        }
      }
      return false; // Important to return false if no flow is triggered.
    })

    // Se chegou até aqui, é porque não encontrou correspondência em nenhum fluxo que tenha um action configurado
    // Mas se encontramos uma palavra-chave que corresponde, vamos incluí-la no registro
    if (bestKeywordMatch) {
      log(`[MessageProcessor] Palavra-chave "${bestKeywordMatch}" encontrada (${bestMatchType}), mas sem fluxo configurado para acionamento ou com status inativo`, 'message-processor');
      messageHistoryData.triggeredKeyword = bestKeywordMatch;
    }

    // Registramos a mensagem no histórico com status "no_match"
    await storage.createMessageHistory(instance.userId, messageHistoryData);
    return false;
  } catch (error: any) {
    log(`[MessageProcessor] \n\n\n\n\n\nErro ao processar fluxos para a mensagem: ${error.message}`, 'message-processor');
    console.error('Erro ao processar fluxos para a mensagem:', error);

    // Mesmo em caso de erro, tentamos registrar a mensagem no histórico
    try {
      // Se tivermos um messageId, armazenamos informações adicionais como JSON no erro também
      let messageContentError = messageContent;
      if (messageId) {
        try {
          const messageData = {
            text: messageContent,
            id: messageId,
            timestamp,
            error: error.message
          };
          messageContentError = JSON.stringify(messageData);
        } catch (e) {
          // Em caso de erro, mantém o conteúdo original
          console.error("Erro ao formatar mensagem de erro para histórico:", e);
        }
      }

      await storage.createMessageHistory(instance.userId, {
        instanceId: instance.id,
        instanceName: instance.name,
        sender: fromNumber,
        messageContent: messageContentError,
        flowId: null,
        triggeredKeyword: null,
        status: "error",
        timestamp: timestamp ? new Date(timestamp) : new Date()
      });
    } catch (historyError) {
      console.error('Erro ao registrar mensagem no histórico:', historyError);
    }

    return false;
  }
}

/**
 * Dispara um fluxo de mensagens enviando as mensagens configuradas
 * Atualizado para usar a API v2 da Evolution API e o sistema de fila
 * para garantir atrasos adequados entre mensagens
 * Exportado para permitir o disparo direto a partir da API
 * Retorna o resultado da API no formato específico solicitado
 */
export async function triggerMessageFlow(
  instanceName: string, 
  flow: MessageFlow, 
  toNumber: string,
  messageContent: string = ""
): Promise<any> {
  // Identificador do fluxo na fila para rastreamento
  let queuedFlowId = "";
  try {
    // Log detalhado para diagnóstico, incluindo informações completas
    console.log(`[DEBUG triggerMessageFlow]
      - Instância: ${instanceName}
      - Fluxo: ${flow.name} (ID: ${flow.id})
      - Palavra-chave: ${flow.keyword || "N/A"}
      - Destinatário: ${toNumber}
      - Conteúdo da mensagem: "${messageContent}"
    `);

    log(`[MessageProcessor] Disparando fluxo: ${flow.name} para ${toNumber}`, 'message-processor');

    // Em caso de erro, garantir que registramos o fluxo como falho
    const cleanupOnError = () => {
      if (queuedFlowId) {
        flowQueueService.updateFlowStatus(queuedFlowId, 'failed');
      }
    };

    // Configura um manipulador global de erros para limpar os recursos
    process.once('uncaughtException', cleanupOnError);

    console.log(`[DEBUG ENVIO] Iniciando envio de fluxo:
      - Nome do fluxo: ${flow.name}
      - ID do fluxo: ${flow.id}
      - Instância: ${instanceName}
      - Número destinatário: ${toNumber}
      - Total de mensagens configuradas: ${Array.isArray(flow.messages) ? flow.messages.length : 'desconhecido'}
    `);

    // Tratamento robusto para diferentes formatos de messages (string, array ou objeto)
    let messagesArray;

    try {
      if (typeof flow.messages === 'string') {
        // Tenta fazer parse da string como JSON
        try {
          messagesArray = JSON.parse(flow.messages);
          log(`[MessageProcessor] Parse JSON de mensagens realizado com sucesso para o fluxo ${flow.name}`, 'message-processor');
        } catch (jsonError: any) {
          // Se falhar no parse, pode ser uma string simples, então criamos um array com uma única mensagem
          log(`[MessageProcessor] Erro no parse JSON: ${jsonError.message}. Tratando como mensagem única.`, 'message-processor');
          messagesArray = [{ text: flow.messages, delay: 0, type: 'text' }];
        }
      } else if (Array.isArray(flow.messages)) {
        // Já é um array, usamos diretamente
        messagesArray = flow.messages;
      } else if (flow.messages && typeof flow.messages === 'object') {
        // É um objeto único, convertemos para array
        messagesArray = [flow.messages];
      } else {
        // Valor inválido
        log(`[MessageProcessor] Formato de mensagens inválido para o fluxo ${flow.name}: ${typeof flow.messages}`, 'message-processor');
        messagesArray = [];
      }

      // Verificação adicional e normalização dos elementos do array
      if (Array.isArray(messagesArray)) {
        // Filtra e normaliza elementos inválidos no array
        messagesArray = messagesArray.filter(msg => {
          // Aceita mensagens que têm texto OU mídia OU são strings
          return msg && (
            msg.text || 
            msg.mediaUrl || 
            typeof msg === 'string' || 
            (msg.type && ['image', 'audio', 'video', 'document'].includes(msg.type))
          );
        })
        .map(msg => {
          // Se o elemento for uma string direta, convertemos para o formato de objeto texto
          if (typeof msg === 'string') {
            return { text: msg, delay: 0, type: 'text' };
          }

          // Determina o tipo de mensagem
          const messageType = msg.type || 'text';

          // Garante que o delay seja um número válido
          const normalizedMsg = { 
            ...msg, 
            type: messageType,
            delay: typeof msg.delay === 'number' && !isNaN(msg.delay) ? msg.delay : 0 
          };

          // Tratamento específico para cada tipo de mensagem
          if (messageType === 'text' && !normalizedMsg.text) {
            // Garante que mensagens de texto tenham um texto
            normalizedMsg.text = '';
          } else if (messageType === 'image' || messageType === 'video') {
            // Garante que mensagens de imagem e vídeo tenham legenda mesmo que vazia
            if (normalizedMsg.caption === undefined) {
              normalizedMsg.caption = '';
            }
          } else if (messageType === 'document' && !normalizedMsg.fileName) {
            // Garante que documentos tenham um nome de arquivo
            normalizedMsg.fileName = `documento_${Date.now()}.pdf`;
          } else if (messageType === 'audio' && normalizedMsg.ptt === undefined) {
            // Define padrão para áudio (não é Push-to-Talk por padrão)
            normalizedMsg.ptt = false;
          }

          return normalizedMsg;
        });
      }
    } catch (error: any) {
      log(`[MessageProcessor] Erro ao processar formato de mensagens: ${error.message}`, 'message-processor');
      console.error(`Erro detalhado ao processar mensagens:`, error);
      messagesArray = [];
    }

    // Verificação final para garantir que temos um array válido
    if (!Array.isArray(messagesArray) || messagesArray.length === 0) {
      log(`[MessageProcessor] Nenhuma mensagem válida encontrada no fluxo ${flow.name} após processamento`, 'message-processor');
      console.error(`Formato final inválido de mensagens para o fluxo ${flow.name}:`, flow.messages);
      return null;
    }

    log(`[MessageProcessor] Formato de mensagens processado com sucesso: ${messagesArray.length} mensagens no fluxo ${flow.name}`, 'message-processor');

    log(`[MessageProcessor] Iniciando envio de ${messagesArray.length} mensagens para ${toNumber} via ${instanceName}`, 'message-processor');

    // Formata o número de telefone adequadamente
    let formattedNumber = toNumber;
    if (!formattedNumber.includes('@')) {
      // Remove qualquer formato especial e garante que é apenas números
      formattedNumber = formattedNumber.replace(/\D/g, '');

      // Certifica-se que números brasileiros têm o código do país
      if (!formattedNumber.startsWith('55') && formattedNumber.length <= 11) {
        formattedNumber = `55${formattedNumber}`;
      }
    }

    // === INÍCIO DA MODIFICAÇÃO: Usar o método enqueueMessageSequence ===

    // Preparar as mensagens no formato necessário para o enqueueMessageSequence
    const textSequence = [];
    const mediaMessages = [];

    // Primeiro, vamos separar as mensagens de texto (que podem ser enviadas em sequência)
    // das mensagens de mídia (que precisam ser enviadas individualmente)
    for (const message of messagesArray) {
      const messageType = message.type || 'text';

      // Se for uma mensagem de texto válida
      if ((messageType === 'text' || messageType === 'button') && message.text) {
        textSequence.push({
          text: message.text.trim(), // Usar o texto exato como digitado
          delayAfterMs: (message.delay || 0) * 1000  // Converter segundos para milissegundos
        });
      }
      // Se for uma mensagem de mídia válida
      else if (['image', 'audio', 'video', 'document'].includes(messageType) && message.mediaUrl) {
        mediaMessages.push({
          type: messageType,
          mediaUrl: message.mediaUrl,
          caption: message.caption || message.text || '',
          fileName: message.fileName,
          delay: (message.delay || 0) * 1000
        });
      }
    }

    // Registrar as mensagens no histórico
    const messageHistoryIds = [];

    // Registra as mensagens de texto no histórico
    for (const textMsg of textSequence) {
      try {
        const messageHistory = await storage.createMessageHistory(flow.userId, {
          instanceId: flow.instanceId,
          instanceName: instanceName,
          sender: formattedNumber,
          messageContent: textMsg.text,
          flowId: flow.id,
          triggeredKeyword: null,
          status: "scheduled",
          timestamp: new Date()
        });

        if (messageHistory) {
          messageHistoryIds.push(messageHistory.id);
        }
      } catch (historyError) {
        log(`[MessageProcessor] Erro ao registrar mensagem de texto no histórico: ${historyError}`, 'message-processor');
      }
    }

    // Registra as mensagens de mídia no histórico
    for (const mediaMsg of mediaMessages) {
      try {
        const messageHistory = await storage.createMessageHistory(flow.userId, {
          instanceId: flow.instanceId,
          instanceName: instanceName,
          sender: formattedNumber,
          messageContent: `[Mídia: ${mediaMsg.type}]`,
          flowId: flow.id,
          triggeredKeyword: null,
          status: "scheduled",
          timestamp: new Date()
        });

        if (messageHistory) {
          messageHistoryIds.push(messageHistory.id);
        }
      } catch (historyError) {
        log(`[MessageProcessor] Erro ao registrar mensagem de mídia no histórico: ${historyError}`, 'message-processor');
      }
    }

    // Primeiro, enfileira todas as mensagens de texto em sequência
    if (textSequence.length > 0) {
      log(`[MessageProcessor] Enfileirando sequência de ${textSequence.length} mensagens de texto`, 'message-processor');

      // Adiciona o fluxo ao serviço de monitoramento de filas
      const contactName = extractContactName(formattedNumber, messageContent);
      const queuedFlow = flowQueueService.addOrUpdateFlow({
        flowId: flow.id,
        flowName: flow.name,
        instanceId: flow.instanceId,
        instanceName: instanceName,
        recipientNumber: formattedNumber,
        recipientName: contactName,
        status: 'pending',
        scheduledTime: Date.now(),
        messageIndex: 0,
        totalMessages: textSequence.length + mediaMessages.length,
        triggerKeyword: flow.keyword,
        triggerMessage: messageContent
      });

      // Armazena o ID do fluxo na fila para rastreamento
      queuedFlowId = queuedFlow.id;

      // Criamos um valor de tempo atual que será compartilhado entre as mensagens
      const now = Date.now();

      // Log para depuração
      log(`[MessageProcessor] ID do fluxo na fila: ${queuedFlowId}`, 'message-processor');

      messageQueueManager.enqueueMessageSequence(
        instanceName,
        formattedNumber,
        textSequence,
        {
          initialDelayMs: 0,
          flowId: flow.id,
          flowName: flow.name,
          triggerKeyword: flow.keyword,
          triggerMessage: messageContent,
          recipientName: contactName,
          queuedFlowId: queuedFlowId
        }
      );
    }

    // Calcula o atraso total das mensagens de texto para começar a enviar mídia depois
    const textSequenceTotalDelay = textSequence.reduce((total, msg) => total + (msg.delayAfterMs || 0), 0);

    // Depois, enfileira mensagens de mídia com os atrasos cumulativos
    if (mediaMessages.length > 0) {
      let cumulativeMediaDelay = textSequenceTotalDelay; // Começa depois que todas as mensagens de texto foram enviadas

      for (const mediaMsg of mediaMessages) {
        log(`[MessageProcessor] Enfileirando mensagem de mídia (${mediaMsg.type}) com atraso de ${cumulativeMediaDelay}ms`, 'message-processor');

        messageQueueManager.enqueueMediaMessage(
          instanceName,
          formattedNumber,
          mediaMsg.type as any,
          mediaMsg.mediaUrl,
          {
            caption: mediaMsg.caption,
            fileName: mediaMsg.fileName,
            delayBeforeSendMs: cumulativeMediaDelay,
            flowId: flow.id,
            queuedFlowId: queuedFlowId
          }
        );

        // Atualiza o atraso cumulativo para a próxima mensagem de mídia
        cumulativeMediaDelay += mediaMsg.delay;
      }
    }

    // === FIM DA MODIFICAÇÃO ===

    log(`[MessageProcessor] Fluxo de mensagens ${flow.name} enfileirado completamente para ${toNumber}`, 'message-processor');

    // Log para o popup visual de sucesso
    console.log(`[ENVIO SUCCESS] ✓ Fluxo "${flow.name}" enviado com sucesso para o número ${toNumber}!`);

    // Retorna informações sobre o status da fila
    const queueStats = messageQueueManager.getQueueStats();

    // Gera um ID único para a mensagem de resposta
    const messageId = uuidv4().replace(/-/g, '').toUpperCase();

    // Timestamp atual em segundos
    const messageTimestamp = Math.floor(Date.now() / 1000);

    // Assume que pelo menos a primeira mensagem foi enviada com sucesso
    // Obtém exatamente o texto inserido pelo usuário para a primeira mensagem de texto
    // Este texto deve ser enviado diretamente no campo "conversation" para o WhatsApp
    let conversationText = "";

    // Prioridade 1: Se houver mensagens, use o texto da primeira mensagem de texto
    if (messagesArray.length > 0) {
      // Pega a primeira mensagem de texto (tipo 'text' ou não especificado)
      const firstMessage = messagesArray.find(msg => 
        (msg.type === 'text' || !msg.type) && msg.text && msg.text.trim().length > 0
      );

      if (firstMessage && firstMessage.text) {
        // Garantimos que o texto está preservado exatamente como foi digitado pelo usuário
        conversationText = firstMessage.text.trim();
        log(`[MessageProcessor] Usando texto exato da primeira mensagem: "${conversationText}"`, 'message-processor');
      }
    }

    // Se não encontrou texto nas mensagens, usa o nome do fluxo
    // (Este caso não deveria ocorrer se o usuário configurou corretamente o fluxo)
    if (!conversationText) {
      conversationText = `Fluxo de mensagens: ${flow.name}`;
      log(`[MessageProcessor] Nenhum texto encontrado nas mensagens, usando nome do fluxo como fallback`, 'message-processor');
    }

    // Cria o campo conversation com todas as mensagens do fluxo
    const conversation = messagesArray.map(msg => {
      if (msg.type === 'text') {
        return {
          type: 'text',
          content: msg.text,
          delay: msg.delay
        };
      } else if (msg.type === 'image') {
        return {
          type: 'image',
          url: msg.mediaUrl,
          caption: msg.caption,
          delay: msg.delay
        };
      } else if (msg.type === 'audio') {
        return {
          type: 'audio',
          url: msg.mediaUrl,
          ptt: msg.ptt,
          delay: msg.delay
        };
      } else if (msg.type === 'video') {
        return {
          type: 'video',
          url: msg.mediaUrl,
          caption: msg.caption,
          delay: msg.delay
        };
      } else if (msg.type === 'document') {
        return {
          type: 'document',
          url: msg.mediaUrl,
          fileName: msg.fileName,
          delay: msg.delay
        };
      }
      return {
        type: 'text',
        content: msg.text || "Mensagem não suportada",
        delay: msg.delay
      };
    });

    // Formato específico de resposta solicitado (conforme solicitado pelo cliente)
    const responseFormat = {
      success: true,
      statusCode: 201,
      data: {
        key: {
          remoteJid: `${formattedNumber}@s.whatsapp.net`,
          fromMe: true,
          id: messageId
        },
        pushName: "",
        status: "PENDING",
        message: {
          conversation: conversationText
        },
        contextInfo: null,
        messageType: "conversation",
        messageTimestamp: messageTimestamp,
        instanceId: messageId,
        source: "unknown"
      },
      instanceName: instanceName,
      phoneNumber: formattedNumber,
      conversation: conversation, // Campo adicional com todas as mensagens do fluxo
      queueInfo: {
        messagesInQueue: queueStats.total,
        scheduled: queueStats.scheduled,
        processing: queueStats.processing,
        flowId: flow.id,
        flowName: flow.name
      }
    };

    log(`[MessageProcessor] Formato de resposta gerado para o fluxo: ${flow.name}`, 'message-processor');
    log(`[MessageProcessor] Mensagens na fila: ${queueStats.total} (Agendadas: ${queueStats.scheduled}, Processando: ${queueStats.processing})`, 'message-processor');

    return responseFormat;
  } catch (error: any) {
    log(`[MessageProcessor] Erro ao disparar fluxo ${flow.name}: ${error.message}`, 'message-processor');
    console.error(`Erro ao disparar fluxo ${flow.name}:`, error);

    // Registra o status do fluxo como falho se tivermos um ID de fluxo
    if (queuedFlowId) {
      flowQueueService.updateFlowStatus(queuedFlowId, 'failed');
    }

    return null;
  } finally {
    // Remove o manipulador de erros global
    process.removeListener('uncaughtException', () => {});
  }
}