/**
 * Script de diagnóstico para identificar problemas na API
 * 
 * Este script verifica:
 * 1. Se o backend está rodando na porta correta
 * 2. Se os endpoints esperados estão disponíveis
 * 3. Se há problemas com o esquema do banco de dados
 * 4. Sugestões para resolver os problemas encontrados
 */

import axios from 'axios';
import { checkApiHealth, findServer, colors } from './utils';

async function diagnosticTest() {
  console.log('🔍 INICIANDO DIAGNÓSTICO DA API');
  console.log('===================================================');
  
  // 1. Verificar se o backend está rodando
  console.log('\n1️⃣ Verificando se o backend está rodando...');
  
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
  console.log(`   URL da API configurada: ${apiUrl}`);
  
  // Tentar descobrir o servidor se a URL padrão não funcionar
  try {
    const health = await checkApiHealth(apiUrl);
    
    if (health.isOnline) {
      console.log(`${colors.green}✅ Backend está online!${colors.reset}`);
      
      // 2. Verificar endpoints
      console.log('\n2️⃣ Verificando endpoints disponíveis...');
      
      const availableEndpoints = Object.entries(health.endpoints)
        .filter(([_, exists]) => exists)
        .map(([endpoint]) => endpoint);
      
      const missingEndpoints = Object.entries(health.endpoints)
        .filter(([_, exists]) => !exists)
        .map(([endpoint]) => endpoint);
      
      if (availableEndpoints.length > 0) {
        console.log(`${colors.green}✅ Endpoints disponíveis:${colors.reset}`);
        availableEndpoints.forEach(endpoint => console.log(`   - ${endpoint}`));
      }
      
      if (missingEndpoints.length > 0) {
        console.log(`${colors.yellow}⚠️ Endpoints não encontrados:${colors.reset}`);
        missingEndpoints.forEach(endpoint => console.log(`   - ${endpoint}`));
      }
      
      // 3. Verificar problemas específicos
      console.log('\n3️⃣ Analisando problemas específicos...');
      
      // Verificar se conseguimos criar um fluxo
      try {
        const flowResponse = await axios.post(`${apiUrl}/flows`, {
          name: `Teste Diagnóstico ${Date.now()}`,
          is_draft: true
        });
        
        console.log(`${colors.green}✅ Criação de fluxo bem-sucedida!${colors.reset}`);
        console.log(`   ID do fluxo: ${flowResponse.data.id}`);
      } catch (error: any) {
        console.log(`${colors.red}❌ Erro ao criar fluxo:${colors.reset}`);
        
        if (error.response?.status === 500) {
          console.log(`   Erro 500: ${error.response.data?.message || 'Erro interno do servidor'}`);
          console.log('   Verificando logs do servidor para mais detalhes...');
          
          // Verificar erro específico de coluna description
          if (error.response.data?.message?.includes('column "description"') || 
              error.response.data?.message?.includes('description of relation "flows"')) {
            console.log(`${colors.yellow}⚠️ Problema identificado: coluna 'description' não existe na tabela 'flows'${colors.reset}`);
            console.log('   Este problema ocorre quando o esquema do banco de dados está desatualizado.');
          }
        } else {
          console.log(`   ${error.message}`);
        }
      }
      
      // 4. Sugestões
      if (health.suggestions.length > 0) {
        console.log('\n4️⃣ Sugestões para resolver os problemas:');
        health.suggestions.forEach((suggestion, index) => {
          console.log(`   ${index + 1}. ${suggestion}`);
        });
      }
      
      console.log('\n📋 Verificando rotas do frontend...');
      const frontendRoutes = [
        '/dashboard',
        '/dashboard/flows',
        '/dashboard/instances',
        '/dashboard/contacts',
        '/dashboard/settings'
      ];
      
      console.log('   As seguintes rotas devem ser implementadas no frontend:');
      frontendRoutes.forEach(route => {
        console.log(`   - ${route}`);
      });
      
    } else {
      console.log(`${colors.red}❌ Não foi possível conectar ao backend na URL ${apiUrl}${colors.reset}`);
      
      // Tentar descobrir o servidor em outras portas
      console.log('\nTentando descobrir o servidor em outras portas e caminhos...');
      const server = await findServer();
      
      if (server) {
        const discoveredUrl = `http://localhost:${server.port}${server.prefix}`;
        console.log(`${colors.green}✅ Servidor encontrado em: ${discoveredUrl}${colors.reset}`);
        console.log(`   Considere atualizar a variável NEXT_PUBLIC_API_URL para usar esta URL`);
      } else {
        console.log(`${colors.red}❌ Não foi possível encontrar o servidor em nenhuma porta ou caminho comum${colors.reset}`);
        console.log('   Verifique se o servidor backend está rodando');
      }
      
      if (health.suggestions.length > 0) {
        console.log('\n📋 Sugestões:');
        health.suggestions.forEach((suggestion, index) => {
          console.log(`   ${index + 1}. ${suggestion}`);
        });
      }
    }
  } catch (error) {
    console.error('Erro durante o diagnóstico:', error);
  }
  
  console.log('\n===================================================');
  console.log('📊 DIAGNÓSTICO CONCLUÍDO');
  console.log('===================================================');
}

// Executar o diagnóstico quando o script for rodado diretamente
if (require.main === module) {
  diagnosticTest().catch(console.error);
}

export { diagnosticTest }; 