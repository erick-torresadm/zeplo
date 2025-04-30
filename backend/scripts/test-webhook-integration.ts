/**
 * Evolution API Webhook Integration Test Script
 * 
 * This script tests the integration with Evolution API webhooks.
 * It starts a webhook server and tests webhook events from Evolution API.
 */

import { config } from 'dotenv';
import { evolutionAPI } from '../src/services/evolution-api';
import { webhookHandler } from '../src/services/webhook-handler';
import { logger } from '../src/utils/logger';
import axios from 'axios';

// Load environment variables
config();

// Test configuration
const TEST_INSTANCE = `webhook-test-${Date.now()}`;
const TEST_PHONE_NUMBER = process.env.TEST_PHONE_NUMBER || '5511999999999';
const WEBHOOK_PORT = process.env.WEBHOOK_PORT || 3001;

class WebhookTester {
  private webhookServer: any;
  private webhookEvents: any[] = [];
  private testInstance: string;

  constructor() {
    this.testInstance = TEST_INSTANCE;
  }

  async runTests() {
    logger.info('=== EVOLUTION API WEBHOOK TEST ===');
    logger.info(`Test instance name: ${this.testInstance}`);
    logger.info(`API URL: ${process.env.EVOLUTION_API_URL}`);
    logger.info(`Webhook Port: ${WEBHOOK_PORT}`);
    logger.info('===================================\n');

    try {
      // Start webhook server
      await this.startWebhookServer();

      // Create and setup instance
      await this.createAndConnectInstance();

      // Wait for some events or simulate them
      await this.simulateWebhookEvents();

      // Verify webhook events
      await this.verifyWebhookEvents();

      // Cleanup
      await this.cleanup();
      
      logger.info('\n✅ Webhook tests completed.');
    } catch (error: any) {
      logger.error('Webhook test failed:', error.message);
    }
  }

  private async startWebhookServer() {
    logger.info('1. Starting webhook server...');
    
    try {
      // Setup event listener to capture webhook events
      webhookHandler.on('webhook-event', (event: any) => {
        logger.info(`Received webhook event: ${event.event || 'unknown'}`);
        this.webhookEvents.push(event);
      });
      
      // Start the webhook server
      this.webhookServer = webhookHandler.setupWebhookServer();
      
      // Wait to ensure server is up
      await new Promise(resolve => setTimeout(resolve, 1000));
      logger.info('Webhook server started successfully');
    } catch (error: any) {
      logger.error('Failed to start webhook server:', error.message);
      throw error;
    }
  }

  private async createAndConnectInstance() {
    logger.info(`2. Creating and connecting test instance "${this.testInstance}"...`);
    
    try {
      // Create instance
      const createResult = await evolutionAPI.createInstance(this.testInstance);
      if (!createResult.status) {
        throw new Error(`Failed to create instance: ${createResult.message}`);
      }
      
      // Set webhook URL for this instance
      const webhookUrl = `http://localhost:${WEBHOOK_PORT}/webhook/${this.testInstance}`;
      const webhookResult = await evolutionAPI.setWebhook(this.testInstance, webhookUrl);
      
      if (!webhookResult.status) {
        throw new Error(`Failed to set webhook: ${webhookResult.message}`);
      }
      
      // Connect the instance (generate QR code)
      const connectResult = await evolutionAPI.connectInstance(this.testInstance);
      
      if (!connectResult.status) {
        throw new Error(`Failed to connect instance: ${connectResult.message}`);
      }
      
      logger.info('Instance created and webhook set successfully');
      
      if (connectResult.data?.pairingCode) {
        logger.info(`Pairing code: ${connectResult.data.pairingCode}`);
        logger.info('To complete the test, pair your WhatsApp using the pairing code above');
      }
      
      // Wait for QR code or pairing code event
      await new Promise(resolve => setTimeout(resolve, 3000));
    } catch (error: any) {
      logger.error('Failed to create and connect instance:', error.message);
      throw error;
    }
  }

  private async simulateWebhookEvents() {
    logger.info('3. Simulating webhook events...');
    
    try {
      // This will simulate a webhook event by directly calling the webhook endpoint
      const webhookUrl = `http://localhost:${WEBHOOK_PORT}/webhook/${this.testInstance}`;
      
      // Simulate a connection update event
      const connectionEvent = {
        event: 'connection.update',
        data: {
          instance: {
            id: this.testInstance
          },
          status: 'connecting'
        }
      };
      
      await axios.post(webhookUrl, connectionEvent);
      logger.info('Simulated connection update event');
      
      // Simulate a QR code update event
      const qrCodeEvent = {
        event: 'qrcode.updated',
        data: {
          instance: {
            id: this.testInstance
          },
          qrcode: 'simulated-qr-code-data'
        }
      };
      
      await axios.post(webhookUrl, qrCodeEvent);
      logger.info('Simulated QR code update event');
      
      // Wait for events to be processed
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error: any) {
      logger.error('Failed to simulate webhook events:', error.message);
    }
  }

  private async verifyWebhookEvents() {
    logger.info('4. Verifying webhook events...');
    
    // Check if we received any events
    if (this.webhookEvents.length === 0) {
      logger.warn('No webhook events received. Webhook may not be working correctly.');
    } else {
      logger.info(`Received ${this.webhookEvents.length} webhook events:`);
      
      this.webhookEvents.forEach((event, index) => {
        logger.info(`Event ${index + 1}: ${event.event || 'unknown'}`);
      });
    }
  }

  private async cleanup() {
    logger.info('5. Cleaning up...');
    
    try {
      // Delete the test instance
      const deleteResult = await evolutionAPI.deleteInstance(this.testInstance);
      
      if (!deleteResult.status) {
        logger.warn(`Failed to delete instance: ${deleteResult.message}`);
      } else {
        logger.info('Test instance deleted successfully');
      }
      
      // Stop the webhook server
      if (this.webhookServer) {
        webhookHandler.stopWebhookServer();
        logger.info('Webhook server stopped');
      }
    } catch (error: any) {
      logger.error('Cleanup failed:', error.message);
    }
  }
}

// Run the tests
const tester = new WebhookTester();
tester.runTests().catch(error => {
  logger.error('Test execution failed:', error);
  process.exit(1);
}); 