import { db } from './connection';
import { logger } from '../utils/logger';
import bcrypt from 'bcryptjs';

async function seedDatabase() {
  try {
    logger.info('Starting database seed...');

    // Check if users table already has data
    const existingUsers = await db('users').count('id as count').first();
    
    if (Number(existingUsers?.count) > 0) {
      logger.info('Database already has users, skipping seed');
      process.exit(0);
    }

    // Create a demo user
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('demo123', salt);

    // Set trial end date (3 days from now)
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 3);

    // Insert demo user
    const [userId] = await db('users').insert({
      name: 'Demo User',
      email: 'demo@example.com',
      password: hashedPassword,
      plan: 'free',
      trial_end_date: trialEndDate.toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).returning('id');

    logger.info(`Created demo user with ID: ${userId}`);

    // Create a demo WhatsApp instance
    const [instanceId] = await db('whatsapp_instances').insert({
      name: 'Demo Instance',
      user_id: userId,
      status: 'disconnected',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).returning('id');

    logger.info(`Created demo WhatsApp instance with ID: ${instanceId}`);

    // Create a sample flow
    const flowId = await db('flows').insert({
      name: 'Welcome Flow',
      description: 'A sample welcome message flow',
      user_id: userId,
      nodes: JSON.stringify([
        {
          id: 'start-node',
          type: 'start',
          position: { x: 100, y: 100 },
          data: { content: 'Start' }
        },
        {
          id: 'welcome-node',
          type: 'text',
          position: { x: 100, y: 250 },
          data: { 
            content: 'Welcome to our service! Thank you for reaching out to us.',
            delay: 1000
          }
        }
      ]),
      connections: JSON.stringify([
        {
          id: 'conn-1',
          source: 'start-node',
          target: 'welcome-node'
        }
      ]),
      is_published: true,
      trigger_keyword: 'hi',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).returning('id');

    logger.info(`Created sample flow with ID: ${flowId}`);
    logger.info('Database seed completed successfully');
    
    process.exit(0);
  } catch (error) {
    logger.error('Database seed failed:', error);
    process.exit(1);
  }
}

seedDatabase(); 