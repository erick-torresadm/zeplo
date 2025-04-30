import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { databaseService } from './database';
import s3Client, { BUCKET_NAME } from '../config/s3';
import { logger } from '../utils/logger';

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

interface UploadMediaParams {
  userId: number;
  file: Express.Multer.File;
  type: 'image' | 'video' | 'audio' | 'document';
}

class MediaService {
  private s3Client: S3Client;
  private bucketName: string;

  constructor() {
    this.s3Client = s3Client;
    this.bucketName = BUCKET_NAME;
  }

  async uploadMedia({ userId, file, type }: UploadMediaParams) {
    try {
      const key = `${userId}/${Date.now()}-${file.originalname}`;

      // Upload to MinIO
      await this.s3Client.send(new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype
      }));

      // Get signed URL
      const url = await this.getSignedUrl(key);

      // Save to database
      const media = await databaseService.createMedia({
        user_id: userId,
        type,
        key,
        url,
        name: file.originalname,
        mime_type: file.mimetype,
        size: file.size
      });

      return media;
    } catch (error) {
      logger.error('Error uploading media:', error);
      throw error;
    }
  }

  async getSignedUrl(key: string) {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key
      });
      return await getSignedUrl(this.s3Client, command, { expiresIn: 3600 });
    } catch (error) {
      logger.error('Error getting signed URL:', error);
      throw error;
    }
  }

  async getMedia(mediaId: number, userId: number) {
    try {
      const media = await databaseService.getMediaByUserId(mediaId, userId);
      if (!media) {
        throw new Error('Media not found');
      }

      // Regenerate the signed URL to ensure it's fresh
      if (media.key) {
        media.url = await this.getSignedUrl(media.key);
      }

      return media;
    } catch (error) {
      logger.error('Error getting media:', error);
      throw error;
    }
  }

  async deleteMedia(mediaId: number, userId: number) {
    try {
      const media = await databaseService.getMediaByUserId(mediaId, userId);
      if (!media) {
        throw new Error('Media not found');
      }

      // Delete from MinIO
      await this.s3Client.send(new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: media.key
      }));

      // Delete from database
      await databaseService.deleteMedia(mediaId);
    } catch (error) {
      logger.error('Error deleting media:', error);
      throw error;
    }
  }

  async refreshMediaUrl(mediaId: number, userId: number): Promise<Media> {
    try {
      const media = await databaseService.getMediaByUserId(userId) as Media;
      if (!media) {
        throw new Error('Media not found');
      }

      // Extract key from URL
      const url = new URL(media.url);
      const key = url.pathname.slice(1);

      // Generate new signed URL
      const newSignedUrl = await this.getSignedUrl(key);

      // Update media record
      const updatedMedia = await databaseService.updateMedia(mediaId, { url: newSignedUrl });

      return updatedMedia;
    } catch (error) {
      logger.error('Error refreshing media URL:', error);
      throw error;
    }
  }
}

export const mediaService = new MediaService();
export default mediaService; 