/**
 * Endpoint para processamento de mensagens recebidas do servidor de webhook
 * 
 * Este endpoint é chamado pelo servidor de webhook quando uma nova mensagem
 * é recebida da Evolution API e precisa ser processada para disparar fluxos.
 */

import { Request, Response } from 'express';
import { log } from '../vite';
import { storage } from '../storage';
import { processMessageDirectly } from '../direct-webhook-handler';
// Importando diretamente sem usar processMessageForFlows que pode não existir
import { processIncomingMessage } from '../message-processor';

// Chave de API que o webhook server deve enviar
const WEBHOOK_API_KEY = process.env.API_KEY;

/**
 * Handler para processar mensagens vindas do servidor de webhook
 */
export async function processMessageHandler(req: Request, res: Response) {
  try {
    // Verificação de segurança
    const apiKey = req.headers['x-api-key'] as string;
    if (WEBHOOK_API_KEY && apiKey !== WEBHOOK_API_KEY) {
      console.log(`[ProcessMessage] Acesso negado: chave API inválida (${apiKey})`);
      return res.status(403).json({
        success: false,
        message: 'Acesso negado: chave API inválida'
      });
    }
    
    // Extrai os campos necessários
    const { 
      instanceName, 
      fromNumber, 
      messageContent, 
      messageId, 
      timestamp, 
      isGroup = false,
      rawData = {} 
    } = req.body;
    
    // Validação dos campos necessários
    if (!instanceName || !fromNumber || !messageContent) {
      return res.status(400).json({
        success: false,
        message: 'Dados incompletos: instanceName, fromNumber e messageContent são obrigatórios'
      });
    }
    
    // Log detalhado para diagnóstico
    console.log(`[ProcessMessage] Processando mensagem:
      - Instância: ${instanceName}
      - De: ${fromNumber}${isGroup ? ' (grupo)' : ''}
      - Conteúdo: "${messageContent.substring(0, 100)}${messageContent.length > 100 ? '...' : ''}"
      - ID da mensagem: ${messageId || 'N/A'}
      - Timestamp: ${timestamp ? new Date(timestamp * 1000).toISOString() : 'N/A'}
    `);
    
    // Busca a instância pelo nome
    const instances = await storage.getInstancesByName(instanceName);
    const instance = instances.length > 0 ? instances[0] : null;
    
    if (!instance) {
      console.log(`[ProcessMessage] Instância não encontrada: ${instanceName}`);
      return res.status(404).json({
        success: false,
        message: `Instância não encontrada: ${instanceName}`
      });
    }
    
    // Log do status da instância para diagnóstico
    console.log(`[ProcessMessage] Status da instância ${instanceName}: ${instance.status}`);
    
    // Adiciona mais log detalhados para melhor diagnóstico
    log(`[ProcessMessage] 🔎 Verificando se a mensagem deve disparar algum fluxo...`, 'webhook');
    
    // Busca todos os fluxos ativos da instância para diagnóstico
    const activeFlows = await storage.getMessageFlowsByInstanceId(instance.id);
    const activeFlowCount = activeFlows.filter(f => f.status === 'active').length;
    
    log(`[ProcessMessage] 📋 Fluxos ativos encontrados para a instância: ${activeFlowCount}`, 'webhook');
    
    if (activeFlowCount > 0) {
      // Lista os fluxos disponíveis para melhor diagnóstico
      const flowNames = activeFlows
        .filter(f => f.status === 'active')
        .map(f => `"${f.name}" (keyword: "${f.keyword}")`)
        .join(', ');
      
      log(`[ProcessMessage] 📝 Fluxos disponíveis: ${flowNames}`, 'webhook');
    } else {
      log(`[ProcessMessage] ⚠️ ALERTA: Nenhum fluxo ativo encontrado para a instância!`, 'webhook');
    }
    
    // Tenta processar a mensagem de duas formas para garantir redundância
    
    // 1. Método principal: usando o processador direto de webhook
    log(`[ProcessMessage] 🔄 Usando método 1: Processador direto de webhook...`, 'webhook');
    const directResult = await processMessageDirectly({
      instanceId: instance.id,
      instanceName: instanceName,
      fromNumber: fromNumber,
      messageContent: messageContent,
      messageId: messageId,
      timestamp: timestamp ? timestamp * 1000 : Date.now()
    });
    
    log(`[ProcessMessage] 📊 Resultado método 1: ${directResult ? '✅ Fluxo acionado!' : '❌ Nenhum fluxo acionado.'}`, 'webhook');
    
    // 2. Método alternativo: usando o processador clássico de mensagens
    let flowResult = false;
    try {
      log(`[ProcessMessage] 🔄 Usando método 2: Processador clássico de mensagens...`, 'webhook');
      // Usando a função processIncomingMessage disponível
      const result = await processIncomingMessage(
        instance.id,
        fromNumber,
        messageContent,
        messageId,
        timestamp ? timestamp * 1000 : Date.now(), 
        true // enviar para webhook externo
      );
      
      flowResult = result; // Essa função retorna boolean diretamente
      log(`[ProcessMessage] 📊 Resultado método 2: ${flowResult ? '✅ Fluxo acionado!' : '❌ Nenhum fluxo acionado.'}`, 'webhook');
    } catch (flowError: any) {
      console.error('[ProcessMessage] ❌ Erro no processador de mensagens:', flowError);
      log(`[ProcessMessage] ❌ Erro no processador de mensagens: ${flowError.message}`, 'webhook');
    }
    
    // Diagnóstico de falha
    if (!directResult && !flowResult) {
      log(`[ProcessMessage] 🔍 DIAGNÓSTICO DE FALHA: nenhum fluxo acionado para a mensagem:
        - Conteúdo: "${messageContent}"
        - Instância: ${instanceName}
        - Análise de correspondência:
      `, 'webhook');
      
      // Vamos tentar analisar por que os fluxos não foram acionados
      activeFlows.filter(f => f.status === 'active').forEach(flow => {
        const keyword = flow.keyword.toLowerCase();
        const msgContent = messageContent.toLowerCase();
        const triggerType = flow.triggerType || 'exact_match';
        
        const isExactMatch = triggerType === 'exact_match' || triggerType === 'exact-match';
        const isContains = triggerType === 'contains';
        const isAllMessages = triggerType === 'all_messages' || triggerType === 'all-messages';
        
        let shouldMatch = false;
        
        if (isAllMessages) {
          shouldMatch = true;
        } else if (isExactMatch && msgContent === keyword) {
          shouldMatch = true;
        } else if (isContains && msgContent.includes(keyword)) {
          shouldMatch = true;
        }
        
        log(`[ProcessMessage] - Fluxo "${flow.name}": 
          Tipo: ${triggerType}
          Keyword: "${keyword}" 
          Resultado: ${shouldMatch ? '✓ DEVERIA corresponder' : '✗ Sem correspondência'}`, 'webhook');
      });
    }
    
    // Registra a mensagem no histórico, mesmo se não tiver acionado fluxo
    if (!directResult && !flowResult) {
      try {
        // Se ainda não foi salvo no histórico, gravamos como no_match
        await storage.createMessageHistory(instance.userId, {
          instanceId: instance.id,
          instanceName: instanceName,
          sender: fromNumber,
          messageContent: messageContent,
          flowId: null,
          triggeredKeyword: null,
          status: "no_match",
          timestamp: new Date(timestamp ? timestamp * 1000 : Date.now())
        });
      } catch (histError: any) {
        console.error('[ProcessMessage] Erro ao salvar histórico:', histError);
      }
    }
    
    // Responde ao servidor de webhook
    return res.status(200).json({
      success: true,
      message: 'Mensagem processada com sucesso',
      results: {
        directProcessorTriggered: directResult,
        flowProcessorTriggered: flowResult,
        instanceId: instance.id,
        processed: directResult || flowResult
      }
    });
  } catch (error: any) {
    console.error('[ProcessMessage] Erro no processamento:', error);
    log(`[ProcessMessage] Erro no processamento: ${error.message}`, 'webhook');
    
    return res.status(500).json({
      success: false,
      message: `Erro no processamento: ${error.message}`
    });
  }
}