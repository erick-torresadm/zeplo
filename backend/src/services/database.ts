import { Knex } from 'knex';
import { logError } from '../utils/logger';
import { Instance } from '../types/instance';
import db from '../config/database';

export interface User {
  id: number;
  email: string;
  name: string;
  password: string;
  plan: string;
  is_active: boolean;
  trial_ends_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface Flow {
  id: number;
  user_id: number;
  name: string;
  trigger_type: string;
  trigger_value?: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface FlowStep {
  id: number;
  flow_id: number;
  order: number;
  type: string;
  content?: string;
  media_url?: string;
  delay: number;
  settings: any;
  created_at: Date;
  updated_at: Date;
}

export interface Media {
  id: number;
  user_id: number;
  name: string;
  type: string;
  url: string;
  mime_type?: string;
  size?: number;
  created_at: Date;
  updated_at: Date;
}

interface Message {
  id: number;
  instance_id: number;
  message_id: string;
  from: string;
  to: string;
  content: string;
  type: string;
  timestamp: Date;
  created_at: Date;
  updated_at: Date;
}

export class DatabaseService {
  private db: Knex;

  constructor() {
    this.db = db;
  }

  // User methods
  async createUser(userData: Partial<User>): Promise<User> {
    try {
      const [user] = await this.db('users')
        .insert({
          ...userData,
          created_at: new Date(),
          updated_at: new Date()
        })
        .returning('*');
      return user;
    } catch (error) {
      logError('Error creating user', error);
      throw error;
    }
  }

  async getUserById(id: number): Promise<User | null> {
    try {
      const user = await this.db('users')
        .where({ id })
        .first();
      return user || null;
    } catch (error) {
      logError('Error getting user by ID', error);
      throw error;
    }
  }

  async getUserByEmail(email: string): Promise<User | null> {
    try {
      const user = await this.db('users')
        .where({ email })
        .first();
      return user || null;
    } catch (error) {
      logError('Error getting user by email', error);
      throw error;
    }
  }

  async updateUser(id: number, userData: Partial<User>): Promise<User> {
    try {
      const [user] = await this.db('users')
        .where({ id })
        .update({
          ...userData,
          updated_at: new Date()
        })
        .returning('*');
      return user;
    } catch (error) {
      logError('Error updating user', error);
      throw error;
    }
  }

  // Instance methods
  async createInstance(data: Partial<Instance>): Promise<Instance> {
    try {
      const [instance] = await this.db('instances')
        .insert({
          ...data,
          status: data.status || 'disconnected'
        })
        .returning('*');
      return instance;
    } catch (error) {
      throw new Error('Erro ao criar instância');
    }
  }

  async getInstanceById(id: number): Promise<Instance | null> {
    try {
      const instance = await this.db('instances')
        .where({ id })
        .first();
      return instance || null;
    } catch (error) {
      logError('Error getting instance by ID', error);
      throw error;
    }
  }

  async getInstanceByApiKey(apiKey: string): Promise<Instance | null> {
    try {
      const instance = await this.db('instances')
        .where({ api_key: apiKey, is_active: true })
        .first();
      return instance || null;
    } catch (error) {
      logError('Error getting instance by API key', error);
      throw error;
    }
  }

  async getUserInstances(userId: number): Promise<Instance[]> {
    try {
      const instances = await this.db('instances')
        .where({ user_id: userId })
        .orderBy('created_at', 'desc');
      return instances;
    } catch (error) {
      logError('Error getting user instances', error);
      throw error;
    }
  }

  async updateInstance(id: number, instanceData: Partial<Instance>): Promise<Instance> {
    try {
      const [instance] = await this.db('instances')
        .where({ id })
        .update({
          ...instanceData,
          updated_at: new Date()
        })
        .returning('*');
      return instance;
    } catch (error) {
      logError('Error updating instance', error);
      throw error;
    }
  }

  async deleteInstance(id: number): Promise<void> {
    try {
      await this.db('instances')
        .where({ id })
        .delete();
    } catch (error) {
      logError('Error deleting instance', error);
      throw error;
    }
  }

  async getInstanceByName(name: string): Promise<Instance | null> {
    try {
      const instance = await this.db('instances')
        .where({ name })
        .first();
      return instance || null;
    } catch (error) {
      throw new Error('Erro ao buscar instância por nome');
    }
  }

  // Flow Operations
  async createFlow(data: Partial<Flow>): Promise<Flow> {
    try {
      const [flow] = await this.db('flows').insert(data).returning('*');
      return flow;
    } catch (error) {
      logError('Error creating flow', error);
      throw error;
    }
  }

  async getFlowById(id: number): Promise<Flow | null> {
    try {
      const flow = await this.db('flows').where({ id }).first();
      return flow || null;
    } catch (error) {
      logError('Error getting flow by ID', error);
      throw error;
    }
  }

  async getFlowsByUserId(userId: number): Promise<Flow[]> {
    try {
      return await this.db('flows').where({ user_id: userId });
    } catch (error) {
      logError('Error getting flows by user ID', error);
      throw error;
    }
  }

  async getFlowSteps(flowId: number): Promise<FlowStep[]> {
    try {
      return await this.db('flow_steps')
        .where({ flow_id: flowId })
        .orderBy('order', 'asc');
    } catch (error) {
      logError('Error getting flow steps', error);
      throw error;
    }
  }

  async createFlowStep(data: Partial<FlowStep>): Promise<FlowStep> {
    try {
      const [step] = await this.db('flow_steps').insert(data).returning('*');
      return step;
    } catch (error) {
      logError('Error creating flow step', error);
      throw error;
    }
  }

  async updateFlowStep(id: number, data: Partial<FlowStep>): Promise<void> {
    try {
      await this.db('flow_steps')
        .where({ id })
        .update({
          ...data,
          updated_at: new Date()
        });
    } catch (error) {
      logError('Error updating flow step', error);
      throw error;
    }
  }

  async deleteFlow(id: number): Promise<void> {
    try {
      await this.db.transaction(async (trx: Knex.Transaction) => {
        await trx('flow_steps').where({ flow_id: id }).delete();
        await trx('flows').where({ id }).delete();
      });
    } catch (error) {
      logError('Error deleting flow', error);
      throw error;
    }
  }

  // Media Operations
  async createMedia(data: Partial<Media>): Promise<Media> {
    try {
      const [media] = await this.db('media').insert(data).returning('*');
      return media;
    } catch (error) {
      logError('Error creating media', error);
      throw error;
    }
  }

  async getMediaByUserId(userId: number): Promise<Media | null> {
    try {
      const media = await this.db('media').where({ user_id: userId }).first();
      return media || null;
    } catch (error) {
      logError('Error getting media by user ID', error);
      throw error;
    }
  }

  async updateMedia(id: number, data: Partial<Media>): Promise<Media> {
    try {
      const [media] = await this.db('media')
        .where({ id })
        .update({
          ...data,
          updated_at: new Date()
        })
        .returning('*');
      return media;
    } catch (error) {
      logError('Error updating media', error);
      throw error;
    }
  }

  async deleteMedia(id: number): Promise<void> {
    try {
      await this.db('media').where({ id }).delete();
    } catch (error) {
      logError('Error deleting media', error);
      throw error;
    }
  }

  // Contact Operations
  async createContact(data: any): Promise<any> {
    try {
      const [contact] = await this.db('contacts').insert(data).returning('*');
      return contact;
    } catch (error) {
      logError('Error creating contact', error);
      throw error;
    }
  }

  async getContactsByUserId(userId: number): Promise<any[]> {
    try {
      return await this.db('contacts').where({ user_id: userId });
    } catch (error) {
      logError('Error getting contacts by user ID', error);
      throw error;
    }
  }

  // Message History Operations
  async createMessageHistory(data: any): Promise<any> {
    try {
      const [message] = await this.db('message_history').insert(data).returning('*');
      return message;
    } catch (error) {
      logError('Error creating message history', error);
      throw error;
    }
  }

  async getMessageHistoryByUserId(userId: number, limit: number = 100): Promise<any[]> {
    try {
      return await this.db('message_history')
        .where({ user_id: userId })
        .orderBy('created_at', 'desc')
        .limit(limit);
    } catch (error) {
      logError('Error getting message history by user ID', error);
      throw error;
    }
  }

  // Contact Management
  async getAllContacts(userId: number) {
    try {
      return await this.db('contacts')
        .where({ user_id: userId })
        .orderBy('name');
    } catch (error) {
      logError('Error getting all contacts', error);
      throw error;
    }
  }

  async getContact(contactId: number, userId: number) {
    try {
      return await this.db('contacts')
        .where({ id: contactId, user_id: userId })
        .first();
    } catch (error) {
      logError('Error getting contact', error);
      throw error;
    }
  }

  async updateContact(contactId: number, contactData: any) {
    try {
      const [contact] = await this.db('contacts')
        .where({ id: contactId, user_id: contactData.userId })
        .update(contactData)
        .returning('*');
      return contact;
    } catch (error) {
      logError('Error updating contact', error);
      throw error;
    }
  }

  async deleteContact(contactId: number, userId: number) {
    try {
      await this.db('contacts')
        .where({ id: contactId, user_id: userId })
        .delete();
    } catch (error) {
      logError('Error deleting contact', error);
      throw error;
    }
  }
}

// Create and export a singleton instance
export const databaseService = new DatabaseService();
export default databaseService; 