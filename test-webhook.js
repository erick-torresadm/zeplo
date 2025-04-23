/**
 * Script para testar o servidor de webhook
 * Execute com: node test-webhook.js
 */

import axios from 'axios';

// Configurações
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'http://localhost:3001/webhook';
const INSTANCE_NAME = 'teste1'; // Altere para o nome da sua instância
const PHONE_NUMBER = '5511999999999'; // Altere para o número que deseja simular
const KEYWORD = 'chat'; // Palavra-chave de teste

// Função para simular o formato da Evolution API
function createEvolutionApiMessage(instanceName, phoneNumber, messageContent) {
  return {
    instance: {
      instanceName: instanceName
    },
    // Simula o formato da Evolution API v2
    key: {
      remoteJid: `${phoneNumber}@s.whatsapp.net`,
      fromMe: false,
      id: `test-${Date.now()}`
    },
    message: {
      conversation: messageContent
    },
    messageTimestamp: Math.floor(Date.now() / 1000),
    status: 'received',
    type: 'text'
  };
}

// Função para enviar teste para o webhook
async function sendTestMessage() {
  const message = createEvolutionApiMessage(INSTANCE_NAME, PHONE_NUMBER, KEYWORD);
  
  console.log('\n\n============================================');
  console.log('ENVIANDO TESTE PARA O SERVIDOR DE WEBHOOK');
  console.log('============================================');
  console.log(`URL: ${WEBHOOK_URL}`);
  console.log(`Instância: ${INSTANCE_NAME}`);
  console.log(`Número: ${PHONE_NUMBER}`);
  console.log(`Mensagem: "${KEYWORD}"`);
  console.log('============================================\n');
  
  try {
    const response = await axios.post(WEBHOOK_URL, message, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('RESPOSTA DO SERVIDOR:\n');
    console.log(`Status: ${response.status} ${response.statusText}`);
    console.log('Dados:', JSON.stringify(response.data, null, 2));
    console.log('\n============================================');
    
    return response.data;
  } catch (error) {
    console.error('ERRO AO ENVIAR MENSAGEM DE TESTE:');
    
    if (error.response) {
      // O servidor respondeu com um status de erro
      console.error(`Status: ${error.response.status}`);
      console.error('Resposta:', error.response.data);
    } else if (error.request) {
      // A requisição foi feita mas não houve resposta
      console.error('Sem resposta do servidor. Verifique se o servidor está rodando.');
    } else {
      // Erro ao configurar a requisição
      console.error('Erro:', error.message);
    }
    
    console.error('\n============================================');
    return null;
  }
}

// Executa o teste
sendTestMessage()
  .then(result => {
    console.log('\nTeste concluído!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\nErro ao executar teste:', error);
    process.exit(1);
  });