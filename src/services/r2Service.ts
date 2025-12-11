import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../config/env';

const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${config.r2.accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: config.r2.accessKeyId,
    secretAccessKey: config.r2.secretAccessKey,
  },
});

export const r2Service = {
  async uploadFile(file: Express.Multer.File, customerId: number): Promise<string> {
    const key = `customer-${customerId}/${Date.now()}-${file.originalname}`;

    const command = new PutObjectCommand({
      Bucket: config.r2.bucketName,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    });

    await s3Client.send(command);

    // Return the key/path for storage in database
    return key;
  },

  async getFileUrl(key: string): Promise<string> {
    // If you have a public URL configured, use it
    if (config.r2.publicUrl) {
      return `${config.r2.publicUrl}/${key}`;
    }

    // Otherwise generate a signed URL
    const command = new GetObjectCommand({
      Bucket: config.r2.bucketName,
      Key: key,
    });

    return getSignedUrl(s3Client, command, { expiresIn: 3600 });
  },

  async getFileBuffer(key: string): Promise<Buffer> {
    const command = new GetObjectCommand({
      Bucket: config.r2.bucketName,
      Key: key,
    });

    const response = await s3Client.send(command);
    const chunks: Uint8Array[] = [];

    if (response.Body) {
      for await (const chunk of response.Body as any) {
        chunks.push(chunk);
      }
    }

    return Buffer.concat(chunks);
  },

  async deleteFile(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: config.r2.bucketName,
      Key: key,
    });

    await s3Client.send(command);
  },
};
