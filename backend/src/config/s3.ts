import { S3Client } from '@aws-sdk/client-s3';
import { config } from 'dotenv';

// Load environment variables
config();

export const BUCKET_NAME = process.env.MINIO_BUCKET || 'zeplo';

const s3Client = new S3Client({
  endpoint: process.env.MINIO_ENDPOINT,
  region: 'us-east-1', // MinIO requires a region, but it can be any value
  credentials: {
    accessKeyId: process.env.MINIO_ACCESS_KEY || '',
    secretAccessKey: process.env.MINIO_SECRET_KEY || ''
  },
  forcePathStyle: true // Required for MinIO
});

export default s3Client; 