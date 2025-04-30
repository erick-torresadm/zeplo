import { spawn } from 'child_process';
import { config } from 'dotenv';
import { logger } from '../src/utils/logger';

// Carregar variáveis de ambiente
config();

const testScripts = [
  { name: 'Database Connection', command: 'test:db' },
  { name: 'Redis Connection', command: 'test:redis' },
  { name: 'MinIO S3 Storage', command: 'test:minio' },
  { name: 'Evolution API', command: 'test:evolution' },
  { name: 'Evolution API Features', command: 'test:evolution:features' },
  { name: 'Webhook Server', command: 'test:webhook' },
  { name: 'API Endpoints', command: 'test:api' }
];

interface TestResult {
  name: string;
  success: boolean;
  output: string;
  error: string;
  exitCode: number;
  startTime?: number;
  endTime?: number;
  logs?: string;
}

async function runTest(testName: string, command: string): Promise<TestResult> {
  return new Promise((resolve) => {
    logger.info(`🔄 Executando teste: ${testName}`);
    
    const testProcess = spawn('npm', ['run', command], {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true
    });
    
    let output = '';
    let error = '';
    
    testProcess.stdout.on('data', (data) => {
      const dataStr = data.toString();
      output += dataStr;
      process.stdout.write(dataStr);
    });
    
    testProcess.stderr.on('data', (data) => {
      const dataStr = data.toString();
      error += dataStr;
      process.stderr.write(dataStr);
    });
    
    testProcess.on('close', (code) => {
      const success = code === 0;
      logger.info(`${success ? '✅' : '❌'} Teste ${testName} ${success ? 'passou' : 'falhou'} com código de saída ${code}`);
      
      const endTime = Date.now();
      
      resolve({
        name: testName,
        success,
        output,
        error,
        exitCode: code || 0,
        startTime: endTime,
        endTime
      });
    });
  });
}

async function runAllTests() {
  logger.info('🚀 Iniciando testes de integração');
  logger.info('================================================');
  
  const startTime = Date.now();
  const results: TestResult[] = [];
  
  for (const test of testScripts) {
    const result = await runTest(test.name, test.command);
    results.push(result);
    logger.info('------------------------------------------------');
  }
  
  const endTime = Date.now();
  const totalTime = (endTime - startTime) / 1000;
  
  // Gerar relatório
  logger.info('');
  logger.info('📊 RELATÓRIO DE TESTES');
  logger.info('================================================');
  
  let passedCount = 0;
  let failedCount = 0;
  let warnings = 0;
  
  results.forEach((result) => {
    if (result.success) {
      passedCount++;
      logger.info(`✅ ${result.name}: PASSOU`);
    } else {
      failedCount++;
      logger.info(`❌ ${result.name}: FALHOU (código de saída: ${result.exitCode})`);
    }
    
    // Identify warnings from the logs
    if (result.output && result.output.includes('⚠️')) {
      warnings++;
    }
  });
  
  logger.info('------------------------------------------------');
  logger.info(`📈 Resumo: ${passedCount} passaram, ${failedCount} falharam`);
  if (warnings > 0) {
    logger.info(`⚠️ Testes com avisos: ${warnings}`);
  }
  logger.info(`⏱️ Tempo total: ${totalTime.toFixed(2)} segundos`);
  logger.info('================================================');
  
  // Retornar código de saída diferente de zero se algum teste falhar
  if (failedCount > 0) {
    process.exit(1);
  }
}

// Executar todos os testes
runAllTests().catch((error) => {
  logger.error('Erro ao executar testes:', error);
  process.exit(1);
}); 