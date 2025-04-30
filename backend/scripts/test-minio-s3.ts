import { S3Client, PutObjectCommand, GetObjectCommand, ListBucketsCommand, ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from 'dotenv';
import { logger } from '../src/utils/logger';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';

// Load environment variables
config();

class MinioTester {
  private s3Client: S3Client;
  private bucketName: string;
  private testFileName: string = `test-file-${Date.now()}.txt`;
  private testFileContent: string = 'This is a test file for MinIO storage testing.';

  constructor() {
    const endpoint = process.env.MINIO_ENDPOINT || 'https://minios3.zeplo.com.br';
    const accessKey = process.env.MINIO_ACCESS_KEY || '';
    const secretKey = process.env.MINIO_SECRET_KEY || '';
    this.bucketName = process.env.MINIO_BUCKET || 'zeplo';

    // Create S3 client
    this.s3Client = new S3Client({
      endpoint,
      region: 'us-east-1', // MinIO requires a region, but it can be any value
      credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secretKey
      },
      forcePathStyle: true // Required for MinIO
    });
  }

  async testConnection() {
    try {
      logger.info('Testing connection to MinIO S3...');
      const { Buckets } = await this.s3Client.send(new ListBucketsCommand({}));
      
      logger.info('✅ Connection successful!');
      logger.info(`Available buckets: ${Buckets?.map(b => b.Name).join(', ')}`);
      
      // Verify if our target bucket exists
      const bucketExists = Buckets?.some(bucket => bucket.Name === this.bucketName);
      if (!bucketExists) {
        logger.warn(`⚠️ Target bucket "${this.bucketName}" was not found!`);
      } else {
        logger.info(`Target bucket "${this.bucketName}" exists.`);
      }
      
      return true;
    } catch (error: any) {
      logger.error('❌ Connection failed!', error.message);
      return false;
    }
  }

  async testUpload() {
    try {
      logger.info(`Uploading test file "${this.testFileName}" to bucket "${this.bucketName}"...`);
      
      await this.s3Client.send(new PutObjectCommand({
        Bucket: this.bucketName,
        Key: this.testFileName,
        Body: this.testFileContent,
        ContentType: 'text/plain'
      }));
      
      logger.info('✅ Upload successful!');
      return true;
    } catch (error: any) {
      logger.error('❌ Upload failed!', error.message);
      return false;
    }
  }

  async testListObjects() {
    try {
      logger.info(`Listing objects in bucket "${this.bucketName}"...`);
      
      const { Contents } = await this.s3Client.send(new ListObjectsV2Command({
        Bucket: this.bucketName,
        MaxKeys: 10
      }));
      
      logger.info('✅ List objects successful!');
      
      if (Contents && Contents.length > 0) {
        logger.info(`Found ${Contents.length} objects:`);
        Contents.forEach((object, index) => {
          logger.info(`${index + 1}. ${object.Key} (${object.Size} bytes)`);
        });
      } else {
        logger.info('No objects found in bucket.');
      }
      
      return true;
    } catch (error: any) {
      logger.error('❌ List objects failed!', error.message);
      return false;
    }
  }

  async testDownload() {
    try {
      logger.info(`Downloading test file "${this.testFileName}"...`);
      
      const response = await this.s3Client.send(new GetObjectCommand({
        Bucket: this.bucketName,
        Key: this.testFileName
      }));
      
      // Convert the response Body stream to string
      const chunks: any[] = [];
      const stream = response.Body as Readable;
      
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      
      const fileContent = Buffer.concat(chunks).toString('utf-8');
      
      logger.info('✅ Download successful!');
      logger.info(`File content: "${fileContent}"`);
      
      // Verify content matches
      if (fileContent === this.testFileContent) {
        logger.info('File content verification successful!');
      } else {
        logger.warn('⚠️ File content does not match the original!');
      }
      
      return true;
    } catch (error: any) {
      logger.error('❌ Download failed!', error.message);
      return false;
    }
  }

  async testPresignedUrl() {
    try {
      logger.info(`Generating presigned URL for "${this.testFileName}"...`);
      
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: this.testFileName
      });
      
      const presignedUrl = await getSignedUrl(this.s3Client, command, { expiresIn: 3600 });
      
      logger.info('✅ Presigned URL generation successful!');
      logger.info(`URL: ${presignedUrl}`);
      logger.info('This URL will expire in 1 hour.');
      
      return true;
    } catch (error: any) {
      logger.error('❌ Presigned URL generation failed!', error.message);
      return false;
    }
  }

  async testDelete() {
    try {
      logger.info(`Deleting test file "${this.testFileName}"...`);
      
      await this.s3Client.send(new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: this.testFileName
      }));
      
      logger.info('✅ Delete successful!');
      return true;
    } catch (error: any) {
      logger.error('❌ Delete failed!', error.message);
      return false;
    }
  }

  async runTests() {
    logger.info('🔄 Starting MinIO S3 Tests');
    logger.info(`MinIO Endpoint: ${process.env.MINIO_ENDPOINT}`);
    logger.info(`Bucket: ${this.bucketName}`);
    
    // Test 1: Connection
    const connectionTest = await this.testConnection();
    if (!connectionTest) {
      logger.error('Connection test failed. Aborting further tests.');
      return false;
    }
    
    // Test 2: Upload
    const uploadTest = await this.testUpload();
    if (!uploadTest) {
      logger.error('Upload test failed. Aborting further tests.');
      return false;
    }
    
    // Test 3: List Objects
    await this.testListObjects();
    
    // Test 4: Download
    await this.testDownload();
    
    // Test 5: Presigned URL
    await this.testPresignedUrl();
    
    // Test 6: Delete
    await this.testDelete();
    
    logger.info('🏁 MinIO S3 Tests Completed');
    return true;
  }
}

// Run the tests
const tester = new MinioTester();
tester.runTests()
  .then((success) => {
    if (success) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  })
  .catch((error) => {
    logger.error('Unexpected error during tests:', error);
    process.exit(1);
  }); 