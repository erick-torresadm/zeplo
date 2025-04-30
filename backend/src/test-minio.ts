import { PutObjectCommand, ListBucketsCommand } from '@aws-sdk/client-s3';
import s3Client, { BUCKET_NAME } from './config/s3';
import fs from 'fs';

async function testMinioConnection() {
  try {
    console.log('Testing MinIO connection...');
    console.log('Bucket name:', BUCKET_NAME);
    
    // Primeiro, vamos listar os buckets disponíveis
    console.log('Listing available buckets...');
    const { Buckets } = await s3Client.send(new ListBucketsCommand({}));
    console.log('Available buckets:', Buckets?.map(b => b.Name));

    console.log('Attempting to upload file...');
    const fileContent = fs.readFileSync('test.txt');
    
    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: 'test.txt',
      Body: fileContent,
      ContentType: 'text/plain'
    }));

    console.log('✅ Upload successful! MinIO connection is working.');
  } catch (error: any) {
    console.error('❌ Error testing MinIO connection:', error);
    if (error.$metadata) {
      console.log('Error metadata:', {
        httpStatusCode: error.$metadata.httpStatusCode,
        requestId: error.$metadata.requestId
      });
    }
  }
}

testMinioConnection(); 