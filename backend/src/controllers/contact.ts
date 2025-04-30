import { databaseService } from '../services/database';
import { logger } from '../utils/logger';

class ContactController {
  async getAllContacts(userId: number | undefined) {
    try {
      if (!userId) throw new Error('User ID is required');
      return await databaseService.getAllContacts(userId);
    } catch (error) {
      logger.error('Error getting all contacts:', error);
      throw error;
    }
  }

  async getContact(contactId: number, userId: number | undefined) {
    try {
      if (!userId) throw new Error('User ID is required');
      return await databaseService.getContact(contactId, userId);
    } catch (error) {
      logger.error('Error getting contact:', error);
      throw error;
    }
  }

  async createContact(contactData: any, userId: number | undefined) {
    try {
      if (!userId) throw new Error('User ID is required');
      return await databaseService.createContact({
        ...contactData,
        userId
      });
    } catch (error) {
      logger.error('Error creating contact:', error);
      throw error;
    }
  }

  async updateContact(contactId: number, contactData: any, userId: number | undefined) {
    try {
      if (!userId) throw new Error('User ID is required');
      return await databaseService.updateContact(contactId, {
        ...contactData,
        userId
      });
    } catch (error) {
      logger.error('Error updating contact:', error);
      throw error;
    }
  }

  async deleteContact(contactId: number, userId: number | undefined) {
    try {
      if (!userId) throw new Error('User ID is required');
      await databaseService.deleteContact(contactId, userId);
    } catch (error) {
      logger.error('Error deleting contact:', error);
      throw error;
    }
  }
}

export const contactController = new ContactController(); 