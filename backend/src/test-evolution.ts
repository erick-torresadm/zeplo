import { evolutionAPI } from './services/evolution-api.js';
import { config } from 'dotenv';
import { logger } from './utils/logger.js';

config();

async function testEvolutionAPI() {
  try {
    logger.info('🔄 Testing Evolution API connection...');
    logger.info('URL:', process.env.EVOLUTION_API_URL || 'https://api.zeplo.com.br');
    
    // Test 1: Check API status
    logger.info('\n1. Checking API connection status...');
    try {
      const instances = await evolutionAPI.getAllInstances();
      logger.info('Connection successful! Response:', JSON.stringify(instances, null, 2));
    } catch (error: any) {
      logger.error('Failed to connect to Evolution API:', error.message);
      return;
    }
    
    // Test 2: List all instances
    logger.info('\n2. Listing existing instances...');
    const instances = await evolutionAPI.getAllInstances();
    logger.info('Found instances:', JSON.stringify(instances, null, 2));

    // Test 3: Create a new test instance
    const instanceName = `test-${Date.now()}`;
    logger.info(`\n3. Creating new instance "${instanceName}"...`);
    const createResult = await evolutionAPI.createInstance(instanceName);
    logger.info('Create result:', JSON.stringify(createResult, null, 2));

    // Test 4: Get instance information
    logger.info(`\n4. Getting instance info for "${instanceName}"...`);
    const instanceInfo = await evolutionAPI.getInstance(instanceName);
    logger.info('Instance info:', JSON.stringify(instanceInfo, null, 2));

    // Test 5: Connect the instance (get QR Code)
    logger.info(`\n5. Connecting instance "${instanceName}" (generating QR code)...`);
    const connectResult = await evolutionAPI.connectInstance(instanceName);
    logger.info('Connect result:', JSON.stringify(connectResult, null, 2));

    // Test 6: Delete the test instance
    logger.info(`\n6. Deleting test instance "${instanceName}"...`);
    const deleteResult = await evolutionAPI.deleteInstance(instanceName);
    logger.info('Delete result:', JSON.stringify(deleteResult, null, 2));

    logger.info('\n✅ All tests completed successfully!');
  } catch (error: any) {
    logger.error('\n❌ Error testing Evolution API:', error.message);
    if (error.response) {
      logger.error('Error details:', {
        status: error.response.status,
        data: error.response.data
      });
    }
  }
}

testEvolutionAPI(); 