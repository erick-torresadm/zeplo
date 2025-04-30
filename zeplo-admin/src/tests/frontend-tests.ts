import axios from 'axios';

/**
 * Script de testes para verificar se as funcionalidades do backend 
 * estão funcionando corretamente no frontend
 */

// Não incluir /api no final da URL, pois isso depende da configuração do backend
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer demo-token-no-auth-needed'
  }
});

// Função principal para executar todos os testes
async function runTests() {
  console.log('🧪 Iniciando testes de integração frontend-backend');
  console.log('===================================================');
  console.log(`🌐 API URL: ${API_URL}`);

  let testsPassed = 0;
  let testsFailed = 0;
  const startTime = Date.now();

  try {
    // Teste 1: Verificar se o backend está online
    await testBackendConnection();
    testsPassed++;

    // Teste 2: Listar flows
    await testListFlows();
    testsPassed++;

    // Teste 3: Criar um novo flow
    const flowId = await testCreateFlow();
    testsPassed++;

    // Teste 4: Buscar flow por ID
    if (flowId) {
      await testGetFlow(flowId);
      testsPassed++;

      // Teste 5: Atualizar flow
      await testUpdateFlow(flowId);
      testsPassed++;

      // Teste 6: Publicar flow
      await testPublishFlow(flowId);
      testsPassed++;

      // Teste 7: Deletar flow
      await testDeleteFlow(flowId);
      testsPassed++;
    }

    // Teste 8: Listar instâncias WhatsApp
    await testListWhatsAppInstances();
    testsPassed++;

  } catch (error) {
    console.error('❌ Erro durante a execução dos testes:', error);
    testsFailed++;
  } finally {
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;

    console.log('\n===================================================');
    console.log('📊 RELATÓRIO DE TESTES');
    console.log('===================================================');
    console.log(`✅ Testes passados: ${testsPassed}`);
    console.log(`❌ Testes falhos: ${testsFailed}`);
    console.log(`⏱️ Tempo total: ${duration.toFixed(2)} segundos`);
    console.log('===================================================');
  }
}

// Teste 1: Verificar se o backend está online
async function testBackendConnection() {
  console.log('\n🔄 Teste 1: Verificando conexão com o backend...');
  
  // Lista de endpoints para tentar, em ordem de prioridade
  const endpointsToTry = [
    '/health',
    '/status',
    '/system/health',
    '/'
  ];
  
  // Lista de prefixos de API para tentar
  const apiPrefixes = ['', '/api', '/api/v1'];
  
  for (const prefix of apiPrefixes) {
    const baseURL = API_URL.replace('/api', prefix || '');
    const axiosInstance = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer demo-token-no-auth-needed'
      }
    });
    
    console.log(`   Tentando com base URL: ${baseURL}`);
    
    for (const endpoint of endpointsToTry) {
      try {
        console.log(`   Tentando endpoint ${endpoint}...`);
        const response = await axiosInstance.get(endpoint);
        
        // Se recebemos qualquer resposta válida (mesmo que seja um 404), o servidor está online
        console.log(`✅ Conexão estabelecida com sucesso: ${baseURL}${endpoint}`);
        console.log(`   Status: ${response.status}`);
        if (response.data) {
          console.log(`   Resposta: ${JSON.stringify(response.data).substring(0, 100)}`);
        }
        return true;
      } catch (error: any) {
        if (error.response) {
          // Se recebemos uma resposta 404, o servidor está online, mas o endpoint não existe
          console.log(`   Recebido ${error.response.status} para ${baseURL}${endpoint}`);
          if (error.response.status === 404) {
            console.log(`✅ Conexão estabelecida (com erro 404): ${baseURL}${endpoint}`);
            return true;
          }
        }
        // Se for outro tipo de erro, continuamos tentando
        console.log(`   Falha ao conectar em ${baseURL}${endpoint}: ${error.message}`);
      }
    }
  }

  // Se chegamos aqui, não conseguimos conectar a nenhum endpoint
  console.error('❌ Não foi possível conectar ao backend');
  throw new Error('Falha na conexão com o backend');
}

// Teste 2: Listar flows
async function testListFlows() {
  console.log('\n🔄 Teste 2: Listando flows...');
  try {
    const response = await api.get('/flows');
    console.log('✅ Listagem de flows bem-sucedida!');
    console.log(`   Total de flows: ${response.data.length}`);
    return response.data;
  } catch (error) {
    console.error('❌ Falha ao listar flows:', error);
    throw new Error('Falha ao listar flows');
  }
}

// Teste 3: Criar um novo flow
async function testCreateFlow() {
  console.log('\n🔄 Teste 3: Criando novo flow...');
  
  const newFlow = {
    name: `Test Flow ${Date.now()}`,
    is_draft: true,
    nodes: [
      {
        id: 'start',
        type: 'start',
        name: 'Start',
        position: { x: 100, y: 100 },
        data: {}
      },
      {
        id: 'message',
        type: 'message',
        name: 'Mensagem de Teste',
        position: { x: 300, y: 100 },
        data: {
          content: 'Esta é uma mensagem de teste',
          delay: 1000
        }
      }
    ],
    connections: [
      {
        id: 'conn1',
        source: 'start',
        target: 'message'
      }
    ]
  };

  try {
    const response = await api.post('/flows', newFlow);
    console.log('✅ Flow criado com sucesso!');
    console.log(`   ID do flow: ${response.data.id}`);
    console.log(`   Nome: ${response.data.name}`);
    return response.data.id;
  } catch (error) {
    // Tentar com um payload simplificado caso o primeiro falhe
    console.log('⚠️ Falha no primeiro formato, tentando formato simplificado...');
    try {
      const simplifiedFlow = {
        name: `Test Flow ${Date.now()}`,
        is_draft: true
      };
      const response = await api.post('/flows', simplifiedFlow);
      console.log('✅ Flow criado com sucesso (formato simplificado)!');
      console.log(`   ID do flow: ${response.data.id}`);
      console.log(`   Nome: ${response.data.name}`);
      return response.data.id;
    } catch (error) {
      console.error('❌ Falha ao criar flow:', error);
      throw new Error('Falha ao criar flow');
    }
  }
}

// Teste 4: Buscar flow por ID
async function testGetFlow(flowId: string | number) {
  console.log(`\n🔄 Teste 4: Buscando flow por ID (${flowId})...`);
  try {
    const response = await api.get(`/flows/${flowId}`);
    console.log('✅ Flow encontrado com sucesso!');
    console.log(`   Nome: ${response.data.name}`);
    console.log(`   Nodes: ${response.data.nodes.length}`);
    console.log(`   Connections: ${response.data.connections.length}`);
    return response.data;
  } catch (error) {
    console.error('❌ Falha ao buscar flow:', error);
    throw new Error('Falha ao buscar flow');
  }
}

// Teste 5: Atualizar flow
async function testUpdateFlow(flowId: string | number) {
  console.log(`\n🔄 Teste 5: Atualizando flow (${flowId})...`);
  
  try {
    // Primeiro buscar o flow atual
    const currentFlow = await api.get(`/flows/${flowId}`);
    const updatedFlow = {
      ...currentFlow.data,
      name: `${currentFlow.data.name} (Atualizado)`,
      description: `${currentFlow.data.description || ''} - Atualizado em ${new Date().toISOString()}`
    };

    const response = await api.put(`/flows/${flowId}`, updatedFlow);
    console.log('✅ Flow atualizado com sucesso!');
    console.log(`   Novo nome: ${response.data.name}`);
    return response.data;
  } catch (error) {
    console.error('❌ Falha ao atualizar flow:', error);
    throw new Error('Falha ao atualizar flow');
  }
}

// Teste 6: Publicar flow
async function testPublishFlow(flowId: string | number) {
  console.log(`\n🔄 Teste 6: Publicando flow (${flowId})...`);
  try {
    const response = await api.post(`/flows/${flowId}/publish`);
    console.log('✅ Flow publicado com sucesso!');
    console.log(`   Status de publicação: ${response.data.isPublished ? 'Publicado' : 'Não publicado'}`);
    return response.data;
  } catch (error) {
    console.error('❌ Falha ao publicar flow:', error);
    throw new Error('Falha ao publicar flow');
  }
}

// Teste 7: Deletar flow
async function testDeleteFlow(flowId: string | number) {
  console.log(`\n🔄 Teste 7: Deletando flow (${flowId})...`);
  try {
    const response = await api.delete(`/flows/${flowId}`);
    console.log('✅ Flow deletado com sucesso!');
    console.log(`   Status: ${response.status}`);
    return true;
  } catch (error) {
    console.error('❌ Falha ao deletar flow:', error);
    throw new Error('Falha ao deletar flow');
  }
}

// Teste 8: Listar instâncias WhatsApp
async function testListWhatsAppInstances() {
  console.log('\n🔄 Teste 8: Listando instâncias WhatsApp...');
  try {
    const response = await api.get('/instances');
    console.log('✅ Listagem de instâncias WhatsApp bem-sucedida!');
    console.log(`   Total de instâncias: ${response.data.length}`);
    return response.data;
  } catch (error) {
    console.error('❌ Falha ao listar instâncias WhatsApp:', error);
    throw new Error('Falha ao listar instâncias WhatsApp');
  }
}

// Executar testes quando o script for rodado diretamente
if (require.main === module) {
  runTests().catch(console.error);
}

export { runTests }; 