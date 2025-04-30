import { mediaService } from '../services/media';
import { logger } from '../utils/logger';

class MediaController {
  async uploadMedia(file: Express.Multer.File, userId: number | undefined) {
    try {
      if (!userId) throw new Error('User ID is required');
      if (!file) throw new Error('File is required');

      const result = await mediaService.uploadMedia({
        userId,
        file,
        type: file.mimetype.startsWith('image/') ? 'image' : 
              file.mimetype.startsWith('video/') ? 'video' : 
              file.mimetype.startsWith('audio/') ? 'audio' : 'document'
      });

      return result;
    } catch (error) {
      logger.error('Error uploading media:', error);
      throw error;
    }
  }

  async getMedia(mediaId: number, userId: number | undefined) {
    try {
      if (!userId) throw new Error('User ID is required');
      return await mediaService.getMedia(mediaId, userId);
    } catch (error) {
      logger.error('Error getting media:', error);
      throw error;
    }
  }

  async deleteMedia(mediaId: string, userId: number | undefined) {
    try {
      if (!userId) throw new Error('User ID is required');
      await mediaService.deleteMedia(parseInt(mediaId), userId);
    } catch (error) {
      logger.error('Error deleting media:', error);
      throw error;
    }
  }
}

export const mediaController = new MediaController(); 