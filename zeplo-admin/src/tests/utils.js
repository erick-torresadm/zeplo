const fetch = require('node-fetch');
const chalk = require('chalk');

/**
 * Formata uma mensagem de log com cores
 * @param {string} message Mensagem a ser formatada
 * @param {string} type Tipo de mensagem (info, success, error, warning, title)
 * @returns {string} Mensagem formatada
 */
function formatLog(message, type = 'info') {
  switch (type) {
    case 'success':
      return chalk.green('✓ ' + message);
    case 'error':
      return chalk.red('✗ ' + message);
    case 'warning':
      return chalk.yellow('⚠ ' + message);
    case 'info':
      return chalk.blue('ℹ ' + message);
    case 'title':
      return chalk.bold.cyan(message);
    default:
      return message;
  }
}

/**
 * Loga o resultado de uma operação com cores
 * @param {string} message Mensagem a ser logada
 * @param {boolean} success Se a operação foi bem sucedida
 */
function logResult(message, success) {
  if (success) {
    console.log(formatLog(message, 'success'));
  } else {
    console.log(formatLog(message, 'error'));
  }
}

/**
 * Gera URLs de teste para tentar encontrar o backend
 * @returns {Array<string>} Lista de URLs para teste
 */
function generateTestUrls() {
  // Portas comuns para teste
  const ports = [3000, 4000, 5000, 8000, 8080, 8888, 9000];
  
  let urls = [];
  
  // Gerar URLs para cada porta
  for (const port of ports) {
    urls.push(`http://localhost:${port}`);
    urls.push(`http://localhost:${port}/api`);
  }
  
  // Adicionar URLs específicos que podem ser usados pelo backend
  urls.push('http://localhost:3333');
  urls.push('http://localhost:3333/api');
  urls.push('http://127.0.0.1:3000');
  urls.push('http://api.local');
  
  return urls;
}

/**
 * Testa se um endpoint está respondendo
 * @param {string} url URL a ser testada
 * @param {string} method Método HTTP (GET, POST, etc.)
 * @param {Object} data Dados para enviar (apenas para POST, PUT, etc.)
 * @param {number} timeout Tempo limite em ms (default: 3000)
 * @returns {Promise<Object>} Resultado do teste
 */
async function testEndpoint(url, method = 'GET', data = null, timeout = 3000) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const options = {
      method,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    };
    
    if (data && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
      options.body = JSON.stringify(data);
    }
    
    const response = await fetch(url, options);
    clearTimeout(timeoutId);
    
    let responseData;
    try {
      responseData = await response.json();
    } catch (e) {
      responseData = null;
    }
    
    return {
      success: response.ok,
      status: response.status,
      data: responseData,
      url
    };
  } catch (error) {
    return {
      success: false,
      error: error.name === 'AbortError' ? 'Timeout' : error.message,
      url
    };
  }
}

/**
 * Detecta a configuração do backend testando múltiplas URLs
 * @param {Array<string>} urls Lista de URLs para testar
 * @returns {Promise<string|null>} URL base do backend ou null se não encontrado
 */
async function detectBackendConfig(urls) {
  console.log(formatLog('Testando conexão com URLs possíveis...', 'info'));
  
  for (const url of urls) {
    process.stdout.write(`Testando ${url}... `);
    
    try {
      const result = await testEndpoint(url);
      
      if (result.success) {
        console.log(chalk.green('OK'));
        return url;
      } else if (result.status) {
        // Resposta com código de erro, mas pelo menos o servidor está respondendo
        console.log(chalk.yellow(`Resposta ${result.status}`));
        return url;
      } else {
        console.log(chalk.red('Falhou'));
      }
    } catch (error) {
      console.log(chalk.red('Erro'));
    }
  }
  
  return null;
}

/**
 * Extrai um token de autenticação da resposta
 * @param {Object} responseData Dados da resposta
 * @returns {string|null} Token extraído ou null
 */
function extractTokenFromResponse(responseData) {
  if (!responseData) return null;
  
  // Tentar extrair o token de diferentes formatos comuns
  if (responseData.token) return responseData.token;
  if (responseData.access_token) return responseData.access_token;
  if (responseData.data?.token) return responseData.data.token;
  if (responseData.data?.access_token) return responseData.data.access_token;
  if (responseData.auth?.token) return responseData.auth.token;
  
  return null;
}

module.exports = {
  formatLog,
  logResult,
  generateTestUrls,
  testEndpoint,
  detectBackendConfig,
  extractTokenFromResponse
}; 