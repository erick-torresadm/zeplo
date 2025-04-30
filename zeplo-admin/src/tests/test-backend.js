#!/usr/bin/env node

const readline = require('readline');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const { 
  formatLog, 
  logResult, 
  generateTestUrls, 
  testEndpoint, 
  detectBackendConfig,
  extractTokenFromResponse
} = require('./utils');

// Criar interface de linha de comando para interação com o usuário
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

/**
 * Testa o backend e corrige problemas encontrados
 */
async function testBackendAndFix() {
  // Gerar URLs de teste
  const testUrls = generateTestUrls();
  
  // Detectar configuração do backend
  console.log(formatLog('Iniciando detecção do backend...', 'title'));
  const backendUrl = await detectBackendConfig(testUrls);
  
  // Logar o resultado
  if (backendUrl) {
    logResult(`Backend detectado em: ${backendUrl}`, true);
    
    // Testar funcionalidades principais
    await testCoreFeatures(backendUrl);
    
    // Atualizar o arquivo .env.local
    await updateEnvFile(backendUrl);
    
    return backendUrl;
  } else {
    logResult('Não foi possível detectar o backend automaticamente', false);
    console.log(formatLog('Possíveis soluções:', 'warning'));
    console.log('1. Verifique se o backend está em execução');
    console.log('2. Verifique se não há firewalls bloqueando a conexão');
    console.log('3. Verifique se o backend está rodando em uma porta diferente das testadas');
    
    // Perguntar ao usuário se deseja tentar uma porta específica
    const customPort = await promptForCustomPort();
    if (customPort) {
      const customUrl = `http://localhost:${customPort}`;
      console.log(formatLog(`Testando porta personalizada: ${customUrl}`, 'info'));
      
      try {
        const result = await testEndpoint(customUrl);
        if (result.success || result.status) {
          logResult(`Backend detectado em porta personalizada: ${customUrl}`, true);
          
          // Testar funcionalidades principais
          await testCoreFeatures(customUrl);
          
          // Atualizar o arquivo .env.local
          await updateEnvFile(customUrl);
          
          return customUrl;
        } else {
          logResult(`Porta personalizada ${customPort} não está respondendo`, false);
        }
      } catch (error) {
        logResult(`Erro ao testar porta personalizada: ${error.message}`, false);
      }
    }
    
    return null;
  }
}

/**
 * Testa as funcionalidades principais do backend
 * @param {string} baseUrl URL base do backend
 */
async function testCoreFeatures(baseUrl) {
  console.log(formatLog('\nTestando funcionalidades principais:', 'title'));
  
  // Testar endpoints de saúde
  await testHealthEndpoints(baseUrl);
  
  // Testar conexão com o banco de dados
  await testDatabaseConnection(baseUrl);
  
  // Testar conexão com Redis
  await testRedisConnection(baseUrl);
  
  // Testar conexão com S3/MinIO
  await testStorageConnection(baseUrl);
  
  // Testar endpoint de instâncias do WhatsApp
  await testWhatsAppInstances(baseUrl);
  
  // Testar endpoints de fluxo de conversa
  await testFlowEndpoints(baseUrl);
  
  // Testar endpoints de contatos
  await testContactEndpoints(baseUrl);
  
  // Testar endpoints de mídia
  await testMediaEndpoints(baseUrl);
}

/**
 * Testa endpoints básicos de saúde
 * @param {string} baseUrl URL base do backend
 */
async function testHealthEndpoints(baseUrl) {
  console.log(formatLog('\nTestando endpoints de saúde:', 'info'));
  
  const endpoints = [
    '/health',
    '/status',
    '/api/health',
    '/api/status',
    '/api/version'
  ];
  
  for (const endpoint of endpoints) {
    const url = `${baseUrl}${endpoint}`;
    try {
      const result = await testEndpoint(url);
      logResult(`Endpoint ${endpoint}: ${result.success ? 'OK' : 'Falhou'}`, result.success);
    } catch (error) {
      logResult(`Erro ao testar endpoint ${endpoint}: ${error.message}`, false);
    }
  }
}

/**
 * Testa a conexão com o banco de dados
 * @param {string} baseUrl URL base do backend
 */
async function testDatabaseConnection(baseUrl) {
  console.log(formatLog('\nTestando conexão com o banco de dados:', 'info'));
  
  const url = `${baseUrl}/api/system/database-status`;
  try {
    const result = await testEndpoint(url);
    if (result.success && result.data && result.data.connected) {
      logResult('Conexão com o banco de dados: OK', true);
      if (result.data.tables) {
        console.log(formatLog(`Tabelas encontradas: ${result.data.tables.length}`, 'info'));
      }
    } else {
      logResult('Conexão com o banco de dados: Falhou', false);
    }
  } catch (error) {
    logResult(`Erro ao testar conexão com o banco de dados: ${error.message}`, false);
    console.log(formatLog('Tentando endpoint alternativo...', 'info'));
    // Tentar endpoint alternativo
    const alternativeUrl = `${baseUrl}/api/system/check-db`;
    try {
      const altResult = await testEndpoint(alternativeUrl);
      logResult('Conexão com o banco de dados (alternativo): ' + 
        (altResult.success ? 'OK' : 'Falhou'), altResult.success);
    } catch (altError) {
      logResult(`Erro ao testar conexão alternativa: ${altError.message}`, false);
    }
  }
}

/**
 * Testa a conexão com Redis
 * @param {string} baseUrl URL base do backend
 */
async function testRedisConnection(baseUrl) {
  console.log(formatLog('\nTestando conexão com Redis:', 'info'));
  
  const url = `${baseUrl}/api/system/redis-status`;
  try {
    const result = await testEndpoint(url);
    logResult('Conexão com Redis: ' + (result.success ? 'OK' : 'Falhou'), result.success);
  } catch (error) {
    logResult(`Erro ao testar conexão com Redis: ${error.message}`, false);
    console.log(formatLog('Tentando endpoint alternativo...', 'info'));
    // Tentar endpoint alternativo
    const alternativeUrl = `${baseUrl}/api/system/check-redis`;
    try {
      const altResult = await testEndpoint(alternativeUrl);
      logResult('Conexão com Redis (alternativo): ' + 
        (altResult.success ? 'OK' : 'Falhou'), altResult.success);
    } catch (altError) {
      logResult(`Erro ao testar conexão alternativa: ${altError.message}`, false);
    }
  }
}

/**
 * Testa a conexão com armazenamento S3/MinIO
 * @param {string} baseUrl URL base do backend
 */
async function testStorageConnection(baseUrl) {
  console.log(formatLog('\nTestando conexão com armazenamento:', 'info'));
  
  const url = `${baseUrl}/api/system/storage-status`;
  try {
    const result = await testEndpoint(url);
    logResult('Conexão com armazenamento: ' + (result.success ? 'OK' : 'Falhou'), result.success);
  } catch (error) {
    logResult(`Erro ao testar conexão com armazenamento: ${error.message}`, false);
    console.log(formatLog('Tentando endpoint alternativo...', 'info'));
    // Tentar endpoint alternativo
    const alternativeUrl = `${baseUrl}/api/system/check-s3`;
    try {
      const altResult = await testEndpoint(alternativeUrl);
      logResult('Conexão com armazenamento (alternativo): ' + 
        (altResult.success ? 'OK' : 'Falhou'), altResult.success);
    } catch (altError) {
      logResult(`Erro ao testar conexão alternativa: ${altError.message}`, false);
    }
  }
}

/**
 * Testa os endpoints de instâncias WhatsApp
 * @param {string} baseUrl URL base do backend
 */
async function testWhatsAppInstances(baseUrl) {
  console.log(formatLog('\nTestando endpoints de instâncias WhatsApp:', 'info'));
  
  // Testar listagem de instâncias
  const listUrl = `${baseUrl}/api/instances`;
  try {
    const result = await testEndpoint(listUrl);
    logResult('Listagem de instâncias: ' + (result.success ? 'OK' : 'Falhou'), result.success);
  } catch (error) {
    logResult(`Erro ao testar listagem de instâncias: ${error.message}`, false);
  }
}

/**
 * Testa os endpoints de fluxos de conversa
 * @param {string} baseUrl URL base do backend
 */
async function testFlowEndpoints(baseUrl) {
  console.log(formatLog('\nTestando endpoints de fluxos de conversa:', 'info'));
  
  // Testar listagem de fluxos
  const listUrl = `${baseUrl}/api/flows`;
  try {
    const result = await testEndpoint(listUrl);
    logResult('Listagem de fluxos: ' + (result.success ? 'OK' : 'Falhou'), result.success);
  } catch (error) {
    logResult(`Erro ao testar listagem de fluxos: ${error.message}`, false);
  }
}

/**
 * Testa os endpoints de contatos
 * @param {string} baseUrl URL base do backend
 */
async function testContactEndpoints(baseUrl) {
  console.log(formatLog('\nTestando endpoints de contatos:', 'info'));
  
  // Testar listagem de contatos
  const listUrl = `${baseUrl}/api/contacts`;
  try {
    const result = await testEndpoint(listUrl);
    logResult('Listagem de contatos: ' + (result.success ? 'OK' : 'Falhou'), result.success);
  } catch (error) {
    logResult(`Erro ao testar listagem de contatos: ${error.message}`, false);
  }
}

/**
 * Testa os endpoints de mídia
 * @param {string} baseUrl URL base do backend
 */
async function testMediaEndpoints(baseUrl) {
  console.log(formatLog('\nTestando endpoints de mídia:', 'info'));
  
  // Testar listagem de mídia
  const listUrl = `${baseUrl}/api/media`;
  try {
    const result = await testEndpoint(listUrl);
    logResult('Listagem de mídia: ' + (result.success ? 'OK' : 'Falhou'), result.success);
  } catch (error) {
    logResult(`Erro ao testar listagem de mídia: ${error.message}`, false);
  }
}

/**
 * Atualiza o arquivo .env.local com a URL do backend detectada
 * @param {string} backendUrl URL base do backend
 */
async function updateEnvFile(backendUrl) {
  console.log(formatLog('\nAtualizando arquivo .env.local:', 'title'));
  
  try {
    // Caminho para o arquivo .env.local (ajustar conforme necessário)
    const envFilePath = path.resolve(process.cwd(), '.env.local');
    
    // Verificar se o arquivo existe
    let fileContent = '';
    try {
      fileContent = await fs.readFile(envFilePath, 'utf8');
    } catch (error) {
      // Arquivo não existe, criar novo
      fileContent = '';
    }
    
    // Verificar se a variável já existe no arquivo
    const regex = /^NEXT_PUBLIC_API_URL=(.*)$/m;
    
    if (regex.test(fileContent)) {
      // Atualizar a variável existente
      fileContent = fileContent.replace(regex, `NEXT_PUBLIC_API_URL=${backendUrl}`);
    } else {
      // Adicionar nova variável
      fileContent += `\nNEXT_PUBLIC_API_URL=${backendUrl}\n`;
    }
    
    // Salvar o arquivo
    await fs.writeFile(envFilePath, fileContent);
    
    logResult(`Arquivo .env.local atualizado com NEXT_PUBLIC_API_URL=${backendUrl}`, true);
  } catch (error) {
    logResult(`Erro ao atualizar arquivo .env.local: ${error.message}`, false);
  }
}

/**
 * Solicita ao usuário uma porta personalizada para testar
 * @returns {Promise<number|null>} Número da porta ou null se cancelado
 */
function promptForCustomPort() {
  return new Promise((resolve) => {
    rl.question('Digite uma porta personalizada para testar (ou deixe em branco para cancelar): ', (answer) => {
      if (answer.trim() === '') {
        resolve(null);
      } else {
        const port = parseInt(answer.trim(), 10);
        if (isNaN(port) || port < 1 || port > 65535) {
          console.log(formatLog('Porta inválida. Deve ser um número entre 1 e 65535.', 'error'));
          resolve(null);
        } else {
          resolve(port);
        }
      }
    });
  });
}

/**
 * Função principal do script
 */
async function main() {
  console.log(formatLog('=== Ferramenta de Teste de Backend ===', 'title'));
  console.log(formatLog('Esta ferramenta testa a conexão com o backend e funcionalidades básicas.', 'info'));
  
  const backendUrl = await testBackendAndFix();
  
  if (backendUrl) {
    console.log('\n' + formatLog('Resumo:', 'title'));
    console.log(formatLog(`Backend detectado em: ${backendUrl}`, 'success'));
    console.log('O arquivo .env.local foi atualizado com a URL do backend.');
    console.log('Seu frontend agora deve conseguir se conectar ao backend corretamente.');
  } else {
    console.log('\n' + formatLog('Resumo:', 'title'));
    console.log(formatLog('Não foi possível detectar o backend automaticamente.', 'error'));
    console.log('Sugestões:');
    console.log('1. Verifique se o backend está em execução');
    console.log('2. Verifique as configurações de rede');
    console.log('3. Tente especificar a URL do backend manualmente no arquivo .env.local:');
    console.log('   NEXT_PUBLIC_API_URL=http://localhost:PORTA');
  }
  
  rl.close();
}

// Executar o script se for chamado diretamente
if (require.main === module) {
  main()
    .catch((error) => {
      console.error(formatLog(`Erro inesperado: ${error.message}`, 'error'));
      process.exit(1);
    })
    .finally(() => {
      rl.close();
    });
}

// Exportar funções para uso em outros módulos
module.exports = {
  testBackendAndFix,
  testCoreFeatures,
  testHealthEndpoints,
  testDatabaseConnection,
  testRedisConnection,
  testStorageConnection,
  testWhatsAppInstances,
  testFlowEndpoints,
  testContactEndpoints,
  testMediaEndpoints,
  updateEnvFile
}; 