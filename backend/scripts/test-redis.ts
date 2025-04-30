import { config } from 'dotenv';
import Redis from 'ioredis';
import { logger } from '../src/utils/logger';

// Load environment variables
config();

class RedisTester {
  private redis: Redis;
  private testPrefix: string = 'test';
  private testKey: string = `${this.testPrefix}:key:${Date.now()}`;
  private testHashKey: string = `${this.testPrefix}:hash:${Date.now()}`;
  private testListKey: string = `${this.testPrefix}:list:${Date.now()}`;

  constructor() {
    // Configure Redis connection
    const redisConfig = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '6'),
      keyPrefix: process.env.CACHE_REDIS_PREFIX_KEY ? `${process.env.CACHE_REDIS_PREFIX_KEY}:` : '',
      maxRetriesPerRequest: null,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      }
    };

    // Use Redis URI if provided
    const redisUri = process.env.CACHE_REDIS_URI;
    this.redis = redisUri ? new Redis(redisUri) : new Redis(redisConfig);
  }

  async testConnection() {
    try {
      logger.info('Testing connection to Redis...');
      const pong = await this.redis.ping();
      logger.info(`✅ Connection successful! Response: ${pong}`);
      return true;
    } catch (error: any) {
      logger.error('❌ Connection failed!', error.message);
      return false;
    }
  }

  async testBasicOperations() {
    try {
      logger.info('Testing basic Redis operations...');
      
      // Test SET and GET
      logger.info(`Setting key "${this.testKey}" with value "test-value"...`);
      await this.redis.set(this.testKey, 'test-value');
      
      const value = await this.redis.get(this.testKey);
      logger.info(`✅ SET/GET successful! Value: ${value}`);
      
      // Test EXPIRE and TTL
      await this.redis.expire(this.testKey, 60);
      const ttl = await this.redis.ttl(this.testKey);
      logger.info(`✅ EXPIRE/TTL successful! TTL: ${ttl} seconds`);
      
      return true;
    } catch (error: any) {
      logger.error('❌ Basic operations failed!', error.message);
      return false;
    }
  }

  async testHashOperations() {
    try {
      logger.info('Testing Redis hash operations...');
      
      // Test HSET and HGET
      await this.redis.hset(this.testHashKey, 'field1', 'value1');
      await this.redis.hset(this.testHashKey, 'field2', 'value2');
      
      const field1Value = await this.redis.hget(this.testHashKey, 'field1');
      const field2Value = await this.redis.hget(this.testHashKey, 'field2');
      
      logger.info(`✅ HSET/HGET successful!`);
      logger.info(`field1: ${field1Value}, field2: ${field2Value}`);
      
      // Test HGETALL
      const allFields = await this.redis.hgetall(this.testHashKey);
      logger.info(`✅ HGETALL successful!`);
      logger.info(`All fields:`, allFields);
      
      return true;
    } catch (error: any) {
      logger.error('❌ Hash operations failed!', error.message);
      return false;
    }
  }

  async testListOperations() {
    try {
      logger.info('Testing Redis list operations...');
      
      // Test LPUSH and RPUSH
      await this.redis.lpush(this.testListKey, 'item1');
      await this.redis.rpush(this.testListKey, 'item2');
      await this.redis.rpush(this.testListKey, 'item3');
      
      // Test LRANGE
      const items = await this.redis.lrange(this.testListKey, 0, -1);
      logger.info(`✅ List operations successful!`);
      logger.info(`List items: ${items.join(', ')}`);
      
      return true;
    } catch (error: any) {
      logger.error('❌ List operations failed!', error.message);
      return false;
    }
  }

  async cleanupTestKeys() {
    try {
      logger.info('Cleaning up test keys...');
      
      // Delete all test keys
      const keys = await this.redis.keys(`${this.testPrefix}:*`);
      if (keys.length > 0) {
        await this.redis.del(...keys);
        logger.info(`✅ Deleted ${keys.length} test keys`);
      } else {
        logger.info('No test keys to delete');
      }
      
      return true;
    } catch (error: any) {
      logger.error('❌ Cleanup failed!', error.message);
      return false;
    }
  }

  async disconnect() {
    try {
      logger.info('Disconnecting from Redis...');
      await this.redis.quit();
      logger.info('✅ Disconnected successfully');
      return true;
    } catch (error: any) {
      logger.error('❌ Error disconnecting from Redis', error.message);
      return false;
    }
  }

  async runTests() {
    logger.info('🔄 Starting Redis Tests');
    logger.info('Configuration:');
    logger.info(`Host: ${process.env.REDIS_HOST || 'localhost'}`);
    logger.info(`Port: ${process.env.REDIS_PORT || '6379'}`);
    logger.info(`DB: ${process.env.REDIS_DB || '6'}`);
    logger.info(`URI: ${process.env.CACHE_REDIS_URI || 'Not specified, using configuration'}`);
    logger.info(`Key Prefix: ${process.env.CACHE_REDIS_PREFIX_KEY || 'None'}`);
    
    try {
      // Test 1: Connection
      const connectionTest = await this.testConnection();
      if (!connectionTest) {
        logger.error('Connection test failed. Aborting further tests.');
        return false;
      }
      
      // Test 2: Basic operations
      const basicOpsTest = await this.testBasicOperations();
      if (!basicOpsTest) {
        logger.error('Basic operations test failed. Aborting further tests.');
        return false;
      }
      
      // Test 3: Hash operations
      await this.testHashOperations();
      
      // Test 4: List operations
      await this.testListOperations();
      
      // Clean up
      await this.cleanupTestKeys();
      
      logger.info('🏁 Redis Tests Completed Successfully');
      return true;
    } finally {
      // Always disconnect
      await this.disconnect();
    }
  }
}

// Run the tests
const tester = new RedisTester();
tester.runTests()
  .then((success) => {
    if (success) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  })
  .catch((error) => {
    logger.error('Unexpected error during tests:', error);
    process.exit(1);
  }); 