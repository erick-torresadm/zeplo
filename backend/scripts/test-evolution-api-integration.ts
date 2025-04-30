/**
 * Evolution API Integration Test Script
 * 
 * This script tests the integration with Evolution API for WhatsApp functionality.
 * It covers basic connection, instance management, and message sending features.
 */

import { config } from 'dotenv';
import { evolutionAPI } from '../src/services/evolution-api';
import { logger } from '../src/utils/logger';

// Load environment variables
config();

// Test configuration
const TEST_PHONE_NUMBER = process.env.TEST_PHONE_NUMBER || '5511999999999';
const DELETE_TEST_INSTANCE = process.env.DELETE_TEST_INSTANCE !== 'false';

class EvolutionApiTester {
  private testInstance: string;
  private testResults: {
    name: string;
    success: boolean;
    message: string;
  }[] = [];

  constructor() {
    this.testInstance = `test-${Date.now()}`;
  }

  async runTests() {
    logger.info('=== EVOLUTION API INTEGRATION TEST ===');
    logger.info(`Test instance name: ${this.testInstance}`);
    logger.info(`API URL: ${process.env.EVOLUTION_API_URL}`);
    logger.info('======================================\n');

    try {
      // Basic connectivity tests
      await this.testApiConnection();
      await this.testListInstances();
      await this.testCreateInstance();
      await this.testGetInstanceInfo();
      await this.testConnectInstance();
      
      // Message and feature tests (if instance is connected)
      // These tests are commented out as they require a connected instance
      // Uncomment once you have a connected instance
      // await this.testVerifyNumber();
      // await this.testSendTextMessage();
      // await this.testFindChats();
      // await this.testSendLocationMessage();
      // await this.testSendPollMessage();
      
      // Cleanup
      if (DELETE_TEST_INSTANCE) {
        await this.testDeleteInstance();
      }
    } catch (error: any) {
      logger.error('Test execution failed:', error);
    } finally {
      // Print test summary
      this.printTestSummary();
    }
  }

  private async testApiConnection() {
    try {
      logger.info('1. Testing API connection...');
      const response = await evolutionAPI.getAllInstances();
      this.recordTestResult('API Connection', response.status, response.message);
    } catch (error: any) {
      this.recordTestResult('API Connection', false, error.message);
      throw new Error('Could not connect to Evolution API. Check configuration and try again.');
    }
  }

  private async testListInstances() {
    try {
      logger.info('2. Listing all instances...');
      const response = await evolutionAPI.getAllInstances();
      if (response.data) {
        const instances = Array.isArray(response.data) ? response.data : [response.data];
        logger.info(`Found ${instances.length} instances`);
      }
      this.recordTestResult('List Instances', response.status, response.message);
    } catch (error: any) {
      this.recordTestResult('List Instances', false, error.message);
    }
  }

  private async testCreateInstance() {
    try {
      logger.info(`3. Creating test instance "${this.testInstance}"...`);
      const response = await evolutionAPI.createInstance(this.testInstance);
      this.recordTestResult('Create Instance', response.status, response.message);
    } catch (error: any) {
      this.recordTestResult('Create Instance', false, error.message);
    }
  }

  private async testGetInstanceInfo() {
    try {
      logger.info(`4. Getting instance info for "${this.testInstance}"...`);
      const response = await evolutionAPI.getInstance(this.testInstance);
      this.recordTestResult('Get Instance Info', response.status, response.message);
    } catch (error: any) {
      this.recordTestResult('Get Instance Info', false, error.message);
    }
  }

  private async testConnectInstance() {
    try {
      logger.info(`5. Connecting instance "${this.testInstance}" (generating QR code)...`);
      const response = await evolutionAPI.connectInstance(this.testInstance);
      
      if (response.status && response.data) {
        if (response.data.pairingCode) {
          logger.info(`Pairing code: ${response.data.pairingCode}`);
        }
        
        // If there's a QR code in the response, display instructions
        if (response.data.qrcode) {
          logger.info('QR Code generated. Scan with WhatsApp to connect.');
          // In a real environment, you might want to display or save the QR code
        }
      }
      
      this.recordTestResult('Connect Instance', response.status, response.message);
    } catch (error: any) {
      this.recordTestResult('Connect Instance', false, error.message);
    }
  }

  private async testVerifyNumber() {
    try {
      logger.info(`6. Verifying number ${TEST_PHONE_NUMBER}...`);
      const response = await evolutionAPI.verifyNumber(this.testInstance, TEST_PHONE_NUMBER);
      this.recordTestResult('Verify Number', response.status, response.message);
    } catch (error: any) {
      this.recordTestResult('Verify Number', false, error.message);
    }
  }

  private async testSendTextMessage() {
    try {
      logger.info(`7. Sending text message to ${TEST_PHONE_NUMBER}...`);
      const response = await evolutionAPI.sendMessage(
        this.testInstance,
        TEST_PHONE_NUMBER,
        "This is a test message from Zeplo API. Please ignore."
      );
      this.recordTestResult('Send Text Message', response.status, response.message);
    } catch (error: any) {
      this.recordTestResult('Send Text Message', false, error.message);
    }
  }

  private async testFindChats() {
    try {
      logger.info('8. Finding all chats...');
      const response = await evolutionAPI.findChats(this.testInstance);
      this.recordTestResult('Find Chats', response.status, response.message);
    } catch (error: any) {
      this.recordTestResult('Find Chats', false, error.message);
    }
  }

  private async testSendLocationMessage() {
    try {
      logger.info(`9. Sending location message to ${TEST_PHONE_NUMBER}...`);
      const response = await evolutionAPI.sendLocation(
        this.testInstance,
        TEST_PHONE_NUMBER,
        {
          lat: -23.5505,
          lng: -46.6333,
          title: "São Paulo",
          address: "São Paulo, Brazil"
        }
      );
      this.recordTestResult('Send Location Message', response.status, response.message);
    } catch (error: any) {
      this.recordTestResult('Send Location Message', false, error.message);
    }
  }

  private async testSendPollMessage() {
    try {
      logger.info(`10. Sending poll message to ${TEST_PHONE_NUMBER}...`);
      const response = await evolutionAPI.sendPoll(
        this.testInstance,
        TEST_PHONE_NUMBER,
        {
          name: "What's your favorite feature of Zeplo?",
          options: ["Automation", "Media management", "Flow creation", "Message sending"],
          selectableCount: 1
        }
      );
      this.recordTestResult('Send Poll Message', response.status, response.message);
    } catch (error: any) {
      this.recordTestResult('Send Poll Message', false, error.message);
    }
  }

  private async testDeleteInstance() {
    try {
      logger.info(`11. Deleting test instance "${this.testInstance}"...`);
      const response = await evolutionAPI.deleteInstance(this.testInstance);
      this.recordTestResult('Delete Instance', response.status, response.message);
    } catch (error: any) {
      this.recordTestResult('Delete Instance', false, error.message);
    }
  }

  private recordTestResult(name: string, success: boolean, message: string) {
    this.testResults.push({
      name,
      success,
      message
    });
    
    if (success) {
      logger.info(`✅ ${name}: Success`);
    } else {
      logger.error(`❌ ${name}: Failed - ${message}`);
    }
  }

  private printTestSummary() {
    const total = this.testResults.length;
    const successful = this.testResults.filter(r => r.success).length;
    const failed = total - successful;
    
    logger.info('\n=== TEST SUMMARY ===');
    logger.info(`Total tests: ${total}`);
    logger.info(`Successful: ${successful}`);
    logger.info(`Failed: ${failed}`);
    
    if (failed > 0) {
      logger.info('\nFailed tests:');
      this.testResults
        .filter(r => !r.success)
        .forEach(r => {
          logger.info(`- ${r.name}: ${r.message}`);
        });
    }
    
    logger.info('===================\n');
  }
}

// Run the tests
const tester = new EvolutionApiTester();
tester.runTests().catch(error => {
  logger.error('Test execution failed:', error);
  process.exit(1);
}); 