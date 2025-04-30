import { config } from 'dotenv';
import redis, { cacheConfig } from './config/redis';

config();

async function testRedisConnection() {
  try {
    console.log('Testando conexão com o Redis...');
    console.log('\nConfigurações:');
    console.log(`Cache Redis Habilitado: ${cacheConfig.isEnabled}`);
    console.log(`URI: ${process.env.CACHE_REDIS_URI || 'Usando configuração padrão'}`);
    console.log(`Host: ${process.env.REDIS_HOST || 'localhost'}`);
    console.log(`Porta: ${process.env.REDIS_PORT || '6379'}`);
    console.log(`DB: ${process.env.REDIS_DB || '6'}`);
    console.log(`Prefixo: ${cacheConfig.prefix}`);
    console.log(`Salvar Instâncias: ${cacheConfig.saveInstances}`);

    // Testa a conexão com um ping
    const pingResult = await redis.ping();
    console.log('\n✅ Conexão estabelecida com sucesso!');
    console.log('Ping result:', pingResult);

    // Testa operações básicas com o prefixo configurado
    const testKey = `test_key`;
    await redis.set(testKey, 'Hello Redis!');
    const value = await redis.get(testKey);
    console.log('\nTeste de operações:');
    console.log('Valor armazenado:', value);
    console.log('Chave completa:', redis.options.keyPrefix + testKey);

    // Limpa o teste
    await redis.del(testKey);

  } catch (error: any) {
    console.error('\n❌ Erro ao conectar com o Redis:', error.message);
    if (error.code) {
      console.error('Código do erro:', error.code);
    }
  } finally {
    await redis.quit();
  }
}

testRedisConnection(); 