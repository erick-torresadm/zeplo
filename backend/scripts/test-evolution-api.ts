/**
 * Evolution API Integration Test Script
 * 
 * This script tests the integration with Evolution API for WhatsApp functionality.
 */

import { config } from 'dotenv';
import { evolutionAPI } from '../src/services/evolution-api.js';
import { logger } from '../src/utils/logger.js';

// Load environment variables
config();

class EvolutionApiTester {
  private apiUrl;
  private apiKey;
  private testInstance = `test-${Date.now()}`;

  constructor() {
    this.apiUrl = process.env.EVOLUTION_API_URL;
    this.apiKey = process.env.EVOLUTION_API_KEY;
  }

  async testConnection() {
    try {
      logger.info('🔄 Testing Evolution API connection...');
      logger.info(`URL: ${this.apiUrl || 'https://api.zeplo.com.br'}`);
      logger.info(`API Key: ${this.apiKey ? '****' + this.apiKey.slice(-4) : 'Not configured'}`);
      
      const response = await evolutionAPI.getAllInstances();
      
      if (response.status) {
        logger.info('✅ Successfully connected to Evolution API');
        logger.info(`Status: ${response.status}`);
        logger.info(`Message: ${response.message}`);
        return true;
      } else {
        logger.error('❌ Failed to connect to Evolution API');
        logger.error(`Error: ${response.message}`);
        return false;
      }
    } catch (error) {
      logger.error('❌ Connection test error:', error);
      return false;
    }
  }

  async testFetchInstances() {
    try {
      logger.info('\n🔄 Testing fetch instances...');
      
      const response = await evolutionAPI.getAllInstances();
      
      if (response.status && response.data) {
        const instances = Array.isArray(response.data) ? response.data : [response.data];
        
        logger.info('✅ Successfully fetched instances');
        logger.info(`Found ${instances.length} instances`);
        
        // Display some info about each instance
        instances.forEach((instance, index) => {
          logger.info(`\nInstance ${index + 1}:`);
          logger.info(`Name: ${instance.instanceName}`);
          logger.info(`Status: ${instance.status}`);
          logger.info(`Owner: ${instance.owner || 'Unknown'}`);
        });
        
        return true;
      } else {
        logger.error('❌ Failed to fetch instances');
        logger.error(`Error: ${response.message}`);
        return false;
      }
    } catch (error) {
      logger.error('❌ Fetch instances test error:', error);
      return false;
    }
  }

  async testCreateInstance() {
    try {
      logger.info(`\n🔄 Testing create instance "${this.testInstance}"...`);
      
      const response = await evolutionAPI.createInstance(this.testInstance);
      
      if (response.status) {
        logger.info('✅ Successfully created instance');
        logger.info(`Instance name: ${this.testInstance}`);
        logger.info(`Response: ${JSON.stringify(response.data, null, 2)}`);
        return true;
      } else {
        logger.error('❌ Failed to create instance');
        logger.error(`Error: ${response.message}`);
        return false;
      }
    } catch (error) {
      logger.error('❌ Create instance test error:', error);
      return false;
    }
  }

  async testQRCode() {
    try {
      logger.info(`\n🔄 Testing fetch QR code for "${this.testInstance}"...`);
      
      const response = await evolutionAPI.connectInstance(this.testInstance);
      
      if (response.status) {
        logger.info('✅ Successfully generated QR code');
        
        // Show pairing code if available
        if (response.data?.pairingCode) {
          logger.info(`Pairing code: ${response.data.pairingCode}`);
          logger.info('Use this code to pair your WhatsApp');
        }
        
        // Show if QR code data exists
        if (response.data?.qrcode) {
          logger.info('QR code data is available');
        }
        
        return true;
      } else {
        logger.error('❌ Failed to generate QR code');
        logger.error(`Error: ${response.message}`);
        return false;
      }
    } catch (error) {
      logger.error('❌ QR code test error:', error);
      return false;
    }
  }

  async testDeleteInstance() {
    try {
      logger.info(`\n🔄 Testing delete instance "${this.testInstance}"...`);
      
      const response = await evolutionAPI.deleteInstance(this.testInstance);
      
      if (response.status) {
        logger.info('✅ Successfully deleted instance');
        logger.info(`Instance name: ${this.testInstance}`);
        return true;
      } else {
        logger.error('❌ Failed to delete instance');
        logger.error(`Error: ${response.message}`);
        return false;
      }
    } catch (error) {
      logger.error('❌ Delete instance test error:', error);
      return false;
    }
  }

  async runTests() {
    logger.info('===== EVOLUTION API INTEGRATION TESTS =====');
    
    const results = {
      connection: false,
      fetchInstances: false,
      createInstance: false,
      qrCode: false,
      deleteInstance: false
    };
    
    try {
      // Test connection first
      results.connection = await this.testConnection();
      
      if (!results.connection) {
        logger.error('❌ Connection test failed. Skipping other tests.');
        return;
      }
      
      // Test fetch instances
      results.fetchInstances = await this.testFetchInstances();
      
      // Test create instance
      results.createInstance = await this.testCreateInstance();
      
      if (results.createInstance) {
        // Test QR code generation
        results.qrCode = await this.testQRCode();
        
        // Test delete instance
        results.deleteInstance = await this.testDeleteInstance();
      }
      
      // Summary
      logger.info('\n===== TEST SUMMARY =====');
      logger.info(`Connection: ${results.connection ? '✅ Pass' : '❌ Fail'}`);
      logger.info(`Fetch Instances: ${results.fetchInstances ? '✅ Pass' : '❌ Fail'}`);
      logger.info(`Create Instance: ${results.createInstance ? '✅ Pass' : '❌ Fail'}`);
      logger.info(`QR Code: ${results.qrCode ? '✅ Pass' : '❌ Fail'}`);
      logger.info(`Delete Instance: ${results.deleteInstance ? '✅ Pass' : '❌ Fail'}`);
      
      const testsPassed = Object.values(results).filter(Boolean).length;
      const totalTests = Object.values(results).length;
      
      logger.info(`\nOverall Result: ${testsPassed}/${totalTests} tests passed`);
      
    } catch (error) {
      logger.error('❌ Test execution error:', error);
    }
  }
}

// Run the tests
const tester = new EvolutionApiTester();
tester.runTests(); 