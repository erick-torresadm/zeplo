/**
 * Script para executar todos os testes de integração
 * - Testes do frontend
 * - Testes do backend
 */

import { runTests as runFrontendTests } from './frontend-tests';
import { runTests as runBackendTests } from './backend-tests';

async function runAllTests() {
  console.log('🚀 INICIANDO TODOS OS TESTES DE INTEGRAÇÃO');
  console.log('=====================================================');
  
  let hasErrors = false;
  
  // Executar testes do frontend
  console.log('\n🔍 EXECUTANDO TESTES DO FRONTEND');
  console.log('-----------------------------------------------------');
  try {
    await runFrontendTests();
    console.log('✅ Testes do frontend concluídos');
  } catch (error) {
    console.error('❌ Erro durante os testes do frontend:', error);
    hasErrors = true;
  }
  
  // Executar testes do backend
  console.log('\n🔍 EXECUTANDO TESTES DO BACKEND');
  console.log('-----------------------------------------------------');
  try {
    if (typeof runBackendTests === 'function') {
      await runBackendTests();
      console.log('✅ Testes do backend concluídos');
    } else {
      console.error('❌ Erro: A função runTests não foi encontrada no módulo backend-tests');
      hasErrors = true;
    }
  } catch (error) {
    console.error('❌ Erro durante os testes do backend:', error);
    hasErrors = true;
  }
  
  console.log('\n📋 TODOS OS TESTES FORAM CONCLUÍDOS');
  
  if (hasErrors) {
    console.log('⚠️ Alguns testes falharam. Verifique os logs acima para mais detalhes.');
    process.exit(1);
  } else {
    console.log('✅ Todos os testes foram executados com sucesso!');
    process.exit(0);
  }
}

// Executar quando rodado diretamente
if (require.main === module) {
  runAllTests().catch(error => {
    console.error('❌ Erro fatal durante a execução dos testes:', error);
    process.exit(1);
  });
}

export { runAllTests }; 