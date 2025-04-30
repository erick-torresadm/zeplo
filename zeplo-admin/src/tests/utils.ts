import axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios';

export interface ApiResponse {
  success: boolean;
  message?: string;
  data?: any;
  error?: any;
}

export async function testEndpoint(url: string, method: 'GET' | 'POST' = 'GET', body?: any): Promise<ApiResponse> {
  try {
    const response = method === 'GET' 
      ? await axios.get(url, { timeout: 5000 })
      : await axios.post(url, body, { timeout: 5000 });
    
    return {
      success: true,
      data: response.data,
      message: `Sucesso ao acessar ${url}`
    };
  } catch (error: any) {
    return {
      success: false,
      error,
      message: `Erro ao acessar ${url}: ${error.message}`
    };
  }
}

// Cores para logs formatados
export const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  magenta: '\x1b[35m',
  reset: '\x1b[0m'
};

/**
 * Gera um log formatado com cores e emojis
 */
export function formatLog(message: string, type: 'success' | 'error' | 'info' | 'warning' | 'title' = 'info'): string {
  const colorMap = {
    success: colors.green,
    error: colors.red,
    warning: colors.yellow,
    info: colors.blue,
    title: colors.magenta
  };
  
  const prefixMap = {
    success: '✅ ',
    error: '❌ ',
    warning: '⚠️ ',
    info: '🔄 ',
    title: '📋 '
  };
  
  return `${colorMap[type]}${prefixMap[type]}${message}${colors.reset}`;
}

export function logResult(message: string, success: boolean): void {
  console.log(formatLog(message, success ? 'success' : 'error'));
}

export async function detectBackendConfig(baseUrls: string[]): Promise<string | null> {
  console.log(formatLog('Detectando configuração do backend...', 'info'));
  
  for (const baseUrl of baseUrls) {
    try {
      // Teste de conexão básica
      const healthResponse = await testEndpoint(`${baseUrl}/health`);
      if (healthResponse.success) {
        console.log(formatLog(`Conexão com ${baseUrl} estabelecida via /health`, 'success'));
        return baseUrl;
      }
      
      // Tente a raiz
      const rootResponse = await testEndpoint(baseUrl);
      if (rootResponse.success) {
        console.log(formatLog(`Conexão com ${baseUrl} estabelecida via raiz`, 'success'));
        return baseUrl;
      }
      
      // Tente outros endpoints comuns
      for (const endpoint of ['/status', '/api/health', '/api/status']) {
        const response = await testEndpoint(`${baseUrl}${endpoint}`);
        if (response.success) {
          console.log(formatLog(`Conexão com ${baseUrl} estabelecida via ${endpoint}`, 'success'));
          return baseUrl;
        }
      }
    } catch (error) {
      console.log(formatLog(`Falha ao testar ${baseUrl}`, 'error'));
    }
  }
  
  console.log(formatLog('Não foi possível detectar automaticamente a configuração do backend', 'warning'));
  return null;
}

export function extractTokenFromResponse(response: any): string | null {
  // Tenta encontrar o token em diferentes formatos de resposta comum
  if (!response) return null;
  
  if (typeof response === 'string') {
    try {
      response = JSON.parse(response);
    } catch (e) {
      return null;
    }
  }
  
  // Formato: { token: "..." }
  if (response.token) return response.token;
  
  // Formato: { accessToken: "..." }
  if (response.accessToken) return response.accessToken;
  
  // Formato: { data: { token: "..." } }
  if (response.data && response.data.token) return response.data.token;
  
  // Formato: { data: { accessToken: "..." } }
  if (response.data && response.data.accessToken) return response.data.accessToken;
  
  // Formato: { user: { token: "..." } }
  if (response.user && response.user.token) return response.user.token;
  
  return null;
}

export function simulateToken(): string {
  return `simulated_${Math.random().toString(36).substring(2, 15)}`;
}

export function getPorts(): number[] {
  return [8080, 3001, 3000, 4000, 5000, 8000];
}

export function getCommonApiPrefixes(): string[] {
  return ['', '/api', '/api/v1', '/v1'];
}

export function generateTestUrls(): string[] {
  const ports = getPorts();
  const prefixes = getCommonApiPrefixes();
  const urls: string[] = [];
  
  for (const port of ports) {
    for (const prefix of prefixes) {
      urls.push(`http://localhost:${port}${prefix}`);
    }
  }
  
  return urls;
}

/**
 * Encontra o servidor mais provável dentre as opções
 * @returns Um objeto com a porta e prefixo API encontrados, ou null se nada for encontrado
 */
export async function findServer(ports: number[] = [8080, 3001, 3000, 4000, 5000, 8000], 
                                 prefixes: string[] = ['', '/api', '/api/v1'],
                                 endpoints: string[] = ['/health', '/status', '/system/health', '/']) {
  for (const port of ports) {
    for (const prefix of prefixes) {
      for (const endpoint of endpoints) {
        const url = `http://localhost:${port}${prefix}${endpoint}`;
        try {
          await axios.get(url, { timeout: 3000 });
          // Se não lançou exceção, encontramos um endpoint válido
          return { port, prefix };
        } catch (error) {
          const axiosError = error as AxiosError;
          // Um erro 404 também indica que o servidor está rodando
          if (axiosError.response && axiosError.response.status === 404) {
            return { port, prefix };
          }
        }
      }
    }
  }
  
  return null;
}

/**
 * Cria um cliente API com a URL base configurada
 */
export function createApiClient(baseURL: string = 'http://localhost:8080'): AxiosInstance {
  return axios.create({
    baseURL,
    timeout: 5000,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer demo-token-no-auth-needed'
    }
  });
}

/**
 * Imprime um relatório de testes
 */
export function printTestSummary(startTime: number, passed: number, failed: number): void {
  const endTime = Date.now();
  const duration = (endTime - startTime) / 1000;
  
  console.log('\n===================================================');
  console.log('📊 RELATÓRIO DE TESTES');
  console.log('===================================================');
  console.log(`✅ Testes passados: ${passed}`);
  console.log(`❌ Testes falhos: ${failed}`);
  console.log(`⏱️ Tempo total: ${duration.toFixed(2)} segundos`);
  console.log('===================================================');
}

/**
 * Executa um teste individual com tratamento de erros
 */
export async function runSingleTest<T>(
  testName: string, 
  testFn: () => Promise<T>
): Promise<T | null> {
  console.log(`\n🔄 Teste: ${testName}...`);
  
  try {
    const result = await testFn();
    console.log(`${colors.green}✅ PASSOU: ${testName}${colors.reset}`);
    return result;
  } catch (error) {
    const axiosError = error as AxiosError;
    
    console.log(`${colors.red}❌ FALHOU: ${testName}${colors.reset}`);
    
    if (axiosError.response) {
      console.log(`   Erro: ${axiosError.response.status} - ${axiosError.response.statusText}`);
      if (axiosError.response.data) {
        const dataStr = typeof axiosError.response.data === 'string'
          ? axiosError.response.data
          : JSON.stringify(axiosError.response.data);
        console.log(`   Detalhes: ${dataStr.substring(0, 150)}...`);
      }
    } else if (axiosError.request) {
      console.log(`   Erro: Sem resposta do servidor`);
    } else {
      console.log(`   Erro: ${(error as Error).message}`);
    }
    
    return null;
  }
}

/**
 * Ajuda a diagnosticar problemas com a API
 */
export async function checkApiHealth(apiUrl: string = 'http://localhost:8080'): Promise<{
  isOnline: boolean;
  endpoints: Record<string, boolean>;
  suggestions: string[];
}> {
  const client = createApiClient(apiUrl);
  const result = {
    isOnline: false,
    endpoints: {} as Record<string, boolean>,
    suggestions: [] as string[]
  };
  
  // Testar conexão básica
  try {
    try {
      // Tente o endpoint raiz primeiro
      await axios.get(apiUrl, { timeout: 3000 });
      result.isOnline = true;
    } catch (rootError) {
      // Se falhar, tente o endpoint /health
      await axios.get(`${apiUrl}/health`, { timeout: 3000 });
      result.isOnline = true;
    }
  } catch (error) {
    const axiosError = error as AxiosError;
    // Um erro 404 também indica que o servidor está rodando
    if (axiosError.response) {
      result.isOnline = true;
    } else {
      result.isOnline = false;
      result.suggestions.push('Verifique se o servidor backend está rodando na porta correta');
      result.suggestions.push('Verifique se o caminho da API está configurado corretamente');
      return result;
    }
  }
  
  // Testar endpoints principais
  const endpoints = [
    '/flows',
    '/instances',
    '/contacts',
    '/system/database-status',
    '/system/redis-status'
  ];
  
  for (const endpoint of endpoints) {
    try {
      await client.get(endpoint);
      result.endpoints[endpoint] = true;
    } catch (error) {
      const axiosError = error as AxiosError;
      result.endpoints[endpoint] = axiosError.response?.status !== 404;
      
      // Verificar se o erro é conhecido
      if (axiosError.response?.status === 500) {
        if (endpoint === '/flows') {
          result.suggestions.push('Verifique a estrutura da tabela "flows" no banco de dados');
          result.suggestions.push('Execute as migrações pendentes com "npm run migrate:latest" no backend');
        }
      }
    }
  }
  
  // Se os endpoints principais estão faltando, adicione sugestões
  const missingEndpoints = Object.entries(result.endpoints)
    .filter(([_, exists]) => !exists)
    .map(([endpoint]) => endpoint);
  
  if (missingEndpoints.length > 0) {
    result.suggestions.push(`Endpoints faltando: ${missingEndpoints.join(', ')}`);
    result.suggestions.push('Verifique se todas as rotas necessárias estão implementadas no backend');
  }
  
  return result;
} 