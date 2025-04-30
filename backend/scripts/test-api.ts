import axios from 'axios';
import { config } from 'dotenv';
import { logger } from '../src/utils/logger';

// Load environment variables
config();

// Configuration
const API_URL = process.env.BACKEND_URL || 'http://localhost:3001/api';
const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'https://api.zeplo.com.br';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || '1e55ef7105eb721c2188bd0b8d06edd7';

// HTTP client for API requests
const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Evolution API client
const evolutionApi = axios.create({
  baseURL: EVOLUTION_API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    'apikey': EVOLUTION_API_KEY
  },
});

// Helper function to test API endpoints
async function testEndpoint(name: string, method: string, url: string, data?: any, token?: string) {
  try {
    logger.info(`Testing ${name} endpoint: ${method} ${url}`);
    
    const headers: any = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await api({
      method,
      url,
      data,
      headers
    });
    
    logger.info(`✅ ${name} test passed with status ${response.status}`);
    return response.data;
  } catch (error: any) {
    logger.error(`❌ ${name} test failed:`, error.message);
    if (error.response) {
      logger.error(`Status: ${error.response.status}`);
      logger.error(`Data:`, error.response.data);
    }
    return null;
  }
}

// Run tests
async function runTests() {
  logger.info('🧪 Starting API Tests');
  logger.info(`Backend URL: ${API_URL}`);
  logger.info(`Evolution API URL: ${EVOLUTION_API_URL}`);
  
  // Test authentication
  const userCredentials = {
    email: 'test@example.com',
    password: 'password123'
  };
  
  // Try to register a user
  const registerResponse = await testEndpoint(
    'Register',
    'post',
    '/auth/register',
    {
      name: 'Test User',
      ...userCredentials
    }
  );
  
  // Test login
  const loginResponse = await testEndpoint(
    'Login',
    'post',
    '/auth/login',
    userCredentials
  );
  
  // Get token for authenticated requests
  const token = loginResponse?.token;
  
  if (token) {
    logger.info('Authentication successful, proceeding with authenticated tests');
    
    // Test instance creation
    const createInstanceResponse = await testEndpoint(
      'Create Instance',
      'post',
      '/instances',
      { name: 'test-instance' },
      token
    );
    
    const instanceId = createInstanceResponse?.id;
    
    if (instanceId) {
      // Test get instance status
      await testEndpoint(
        'Get Instance Status',
        'get',
        `/instances/${instanceId}/status`,
        undefined,
        token
      );
      
      // Test connect instance
      await testEndpoint(
        'Connect Instance',
        'post',
        `/instances/${instanceId}/connect`,
        undefined,
        token
      );
    }
    
    // Test flow creation
    const createFlowResponse = await testEndpoint(
      'Create Flow',
      'post',
      '/flows',
      {
        name: 'Test Flow',
        description: 'A test flow',
        trigger_type: 'keyword',
        trigger_value: 'hello'
      },
      token
    );
    
    const flowId = createFlowResponse?.id;
    
    if (flowId) {
      // Test get flow
      await testEndpoint(
        'Get Flow',
        'get',
        `/flows/${flowId}`,
        undefined,
        token
      );
      
      // Test update flow
      await testEndpoint(
        'Update Flow',
        'put',
        `/flows/${flowId}`,
        {
          name: 'Updated Test Flow',
          description: 'An updated test flow'
        },
        token
      );
    }
  }
  
  logger.info('🏁 API Tests Completed');
}

// Start the tests
runTests()
  .then(() => {
    logger.info('Tests execution completed');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('Error during tests:', error);
    process.exit(1);
  }); 