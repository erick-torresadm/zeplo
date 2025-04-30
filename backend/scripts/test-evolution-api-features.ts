import axios, { AxiosInstance } from 'axios';
import { config } from 'dotenv';
import { logger } from '../src/utils/logger.js';
import fs from 'fs';
import path from 'path';

// Carregar variáveis de ambiente
config();

/**
 * Classe para testar e documentar os endpoints funcionais da Evolution API
 */
class EvolutionApiFeatureTester {
  private apiClient: AxiosInstance;
  private apiUrl: string;
  private apiKey: string;
  private testInstance: string = `test-${Date.now()}`;
  private testPhoneNumber: string = '5511999999999'; // Substitua por um número válido para testes
  private apiDocs: { [key: string]: { endpoint: string, method: string, status: string, description: string, payload?: any, response?: any } } = {};

  constructor() {
    this.apiUrl = process.env.EVOLUTION_API_URL || 'https://api.zeplo.com.br';
    this.apiKey = process.env.EVOLUTION_API_KEY || '1e55ef7105eb721c2188bd0b8d06edd7';
    
    this.apiClient = axios.create({
      baseURL: this.apiUrl,
      timeout: 20000,
      headers: {
        'Content-Type': 'application/json',
        'apikey': this.apiKey
      }
    });
  }

  /**
   * Realiza requisições para a API e registra o resultado
   */
  private async apiRequest(method: string, endpoint: string, data?: any, description: string = '') {
    const testName = endpoint.split('/')[1] + (endpoint.split('/')[2] || '');
    
    try {
      logger.info(`Testing API endpoint: ${method} ${endpoint}`);
      const response = await this.apiClient({
        method,
        url: endpoint,
        data
      });
      
      // Registrar endpoint que funcionou
      this.apiDocs[testName] = {
        endpoint,
        method,
        status: 'SUCCESS',
        description: description || `${method} ${endpoint}`,
        payload: data,
        response: response.data
      };
      
      logger.info(`✅ API request succeeded: ${method} ${endpoint}`);
      return response.data;
    } catch (error: any) {
      logger.error(`API request failed: ${method} ${endpoint}`);
      
      // Registrar endpoint que falhou
      this.apiDocs[testName] = {
        endpoint,
        method,
        status: 'FAILED',
        description: description || `${method} ${endpoint}`,
        payload: data
      };
      
      if (error.response) {
        logger.error(`Status: ${error.response.status}`);
        logger.error(`Data:`, error.response.data);
      } else {
        logger.error(`Error:`, error.message);
      }
      throw error;
    }
  }

  /**
   * Gera documentação completa a partir dos testes executados
   */
  private generateApiDocumentation() {
    logger.info('===================================================');
    logger.info('📚 DOCUMENTAÇÃO BÁSICA DA EVOLUTION API');
    logger.info('===================================================');
    
    logger.info('📗 ENDPOINTS FUNCIONAIS:');
    Object.keys(this.apiDocs)
      .filter(key => this.apiDocs[key].status === 'SUCCESS')
      .forEach(key => {
        const endpoint = this.apiDocs[key];
        logger.info(`\n▶️ ${endpoint.method} ${endpoint.endpoint}`);
        logger.info(`  📝 Descrição: ${endpoint.description}`);
        
        if (endpoint.payload) {
          logger.info(`  📦 Payload de exemplo:`);
          logger.info(`    ${JSON.stringify(endpoint.payload, null, 2).replace(/\n/g, '\n    ')}`);
        }
        
        if (endpoint.response) {
          const responseStr = JSON.stringify(endpoint.response);
          if (responseStr.length <= 500) {
            logger.info(`  📬 Resposta de exemplo:`);
            logger.info(`    ${JSON.stringify(endpoint.response, null, 2).replace(/\n/g, '\n    ')}`);
          } else {
            logger.info(`  📬 Resposta muito longa para exibir completa`);
          }
        }
      });
    
    logger.info('\n⚠️ ENDPOINTS QUE NÃO FUNCIONARAM:');
    Object.keys(this.apiDocs)
      .filter(key => this.apiDocs[key].status === 'FAILED')
      .forEach(key => {
        const endpoint = this.apiDocs[key];
        logger.info(`  ❌ ${endpoint.method} ${endpoint.endpoint}`);
      });
    
    logger.info('\n===================================================');
    logger.info('📄 GUIA DE USO RÁPIDO DA EVOLUTION API:');
    logger.info('===================================================');
    logger.info('Para utilizar a Evolution API corretamente, siga este fluxo:');
    logger.info('1. Crie uma instância: POST /instance/create');
    logger.info('   - Parâmetros necessários: instanceName e integration="WHATSAPP-BAILEYS"');
    logger.info('2. Verifique o estado da conexão: GET /instance/connectionState/{instanceName}');
    logger.info('3. Para buscar mensagens: POST /chat/findMessages/{instanceName}');
    logger.info('   - Parâmetros necessários: number (telefone) e count (quantidade de mensagens)');
    logger.info('4. Quando terminar, exclua a instância: DELETE /instance/delete/{instanceName}');
    logger.info('===================================================');
    
    // Salvar a documentação em um arquivo para referência futura
    const docsDir = path.join(process.cwd(), 'docs');
    if (!fs.existsSync(docsDir)) {
      fs.mkdirSync(docsDir, { recursive: true });
    }
    
    const docsPath = path.join(docsDir, 'evolution-api-docs.json');
    fs.writeFileSync(
      docsPath, 
      JSON.stringify({
        baseUrl: this.apiUrl,
        endpoints: this.apiDocs,
        testedAt: new Date().toISOString()
      }, null, 2)
    );
    
    logger.info(`📄 Documentação salva em ${docsPath}`);
  }

  // Métodos de inicialização e limpeza
  
  async createTestInstance() {
    try {
      logger.info(`Criando instância de teste "${this.testInstance}"...`);
      const response = await this.apiRequest(
        'POST', 
        '/instance/create', 
        {
          instanceName: this.testInstance,
          token: "",
          qrcode: true,
          integration: "WHATSAPP-BAILEYS"
        },
        'Criar uma nova instância do WhatsApp'
      );
      
      logger.info('✅ Instância criada com sucesso!');
      logger.info(`Nome da instância: ${response.instance.instanceName}`);
      logger.info(`ID da instância: ${response.instance.instanceId}`);
      logger.info(`Status: ${response.instance.status}`);
      return response;
    } catch (error) {
      logger.error('❌ Falha na criação da instância!');
      return null;
    }
  }

  async deleteTestInstance() {
    try {
      logger.info(`Excluindo instância de teste "${this.testInstance}"...`);
      const response = await this.apiRequest(
        'DELETE', 
        `/instance/delete/${this.testInstance}`,
        undefined,
        'Excluir uma instância do WhatsApp'
      );
      
      logger.info('✅ Instância excluída com sucesso!');
      return true;
    } catch (error) {
      logger.error('❌ Falha na exclusão da instância!');
      return false;
    }
  }

  async testConnectionState() {
    try {
      logger.info('Verificando estado de conexão da instância...');
      const response = await this.apiRequest(
        'GET', 
        `/instance/connectionState/${this.testInstance}`,
        undefined,
        'Verificar o estado atual de conexão da instância'
      );
      
      logger.info(`✅ Estado de conexão: ${response.state || 'Desconhecido'}`);
      return true;
    } catch (error) {
      logger.error('❌ Falha ao verificar estado de conexão!');
      return false;
    }
  }
  
  async testFindMessages() {
    try {
      logger.info(`Buscando mensagens do chat ${this.testPhoneNumber}...`);
      const response = await this.apiRequest(
        'POST', 
        `/chat/findMessages/${this.testInstance}`, 
        {
          number: this.testPhoneNumber,
          count: 5
        },
        'Buscar mensagens de um chat específico'
      );
      
      logger.info('✅ Busca de mensagens concluída com sucesso!');
      logger.info(`Total de mensagens encontradas: ${response.length || 0}`);
      return true;
    } catch (error) {
      logger.error('❌ Falha na busca de mensagens!');
      return false;
    }
  }

  // Testa alguns endpoints adicionais que podem ser úteis
  async testAdditionalEndpoints() {
    // Tenta buscar todos os endpoints conhecidos
    const endpointsToTest = [
      // Endpoints para instâncias
      { method: 'GET', url: `/instance/fetchInstances`, description: 'Listar todas as instâncias' },
      { method: 'GET', url: `/instance/info/${this.testInstance}`, description: 'Verificar informações da instância' },
      
      // Endpoints para grupos
      { method: 'GET', url: `/group/fetchAllGroups/${this.testInstance}?getParticipants=true`, description: 'Listar todos os grupos' },
      
      // Endpoints para contatos
      { method: 'GET', url: `/contact/get/${this.testInstance}`, description: 'Listar todos os contatos' },
    ];

    for (const endpoint of endpointsToTest) {
      try {
        await this.apiRequest(endpoint.method, endpoint.url, undefined, endpoint.description);
      } catch (error) {
        // Erros já são registrados na função apiRequest
      }
    }
  }

  async runTests() {
    logger.info('🧪 Iniciando mapeamento da Evolution API');
    logger.info(`URL da API: ${this.apiUrl}`);
    logger.info(`Instância de teste: ${this.testInstance}`);
    logger.info(`Número de teste: ${this.testPhoneNumber}`);
    logger.info('=====================================================');

    // Criar instância de teste
    const instanceCreated = await this.createTestInstance();
    if (!instanceCreated) {
      logger.error('Falha ao criar instância de teste. Abortando testes.');
      return false;
    }

    // Executar testes conhecidos que funcionam
    const results = {
      connectionState: await this.testConnectionState(),
      findMessages: await this.testFindMessages()
    };

    // Testar outros endpoints possíveis
    await this.testAdditionalEndpoints();

    // Excluir instância de teste
    await this.deleteTestInstance();

    // Contar os sucessos e falhas
    let passedCount = Object.values(results).filter(result => result).length;
    let totalCount = Object.values(results).length;
    
    logger.info('=====================================================');
    logger.info(`📈 Resumo: ${passedCount} de ${totalCount} testes principais passaram`);
    logger.info('=====================================================');
    
    // Gerar documentação a partir dos testes
    this.generateApiDocumentation();
    
    return true;
  }
}

// Executar os testes
const tester = new EvolutionApiFeatureTester();
tester.runTests()
  .then(() => {
    logger.info('🏁 Mapeamento da API finalizado.');
    process.exit(0);  
  })
  .catch((error) => {
    logger.error('Erro inesperado durante os testes:', error);
    process.exit(1);
  }); 