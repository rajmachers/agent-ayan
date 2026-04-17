/**
 * Storage service supporting both MinIO and AWS S3
 */

import { Client as MinioClient } from 'minio';
import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import { logger } from '../utils/logger';
import { config } from '../config';

export interface StorageFile {
  key: string;
  size?: number;
  lastModified?: Date;
  etag?: string;
}

export interface UploadOptions {
  contentType?: string;
  metadata?: Record<string, string>;
}

export class StorageService {
  private minioClient?: MinioClient;
  private s3Client?: S3Client;
  private isInitialized = false;

  async initialize(): Promise<void> {
    try {
      if (config.storageType === 'minio') {
        this.minioClient = new MinioClient({
          endPoint: config.minioEndpoint.split(':')[0],
          port: parseInt(config.minioEndpoint.split(':')[1] || '9000'),
          useSSL: config.minioUseSsl,
          accessKey: config.minioAccessKey,
          secretKey: config.minioSecretKey,
        });

        // Ensure bucket exists
        const bucketExists = await this.minioClient.bucketExists(config.minioBucket);
        if (!bucketExists) {
          await this.minioClient.makeBucket(config.minioBucket);
          logger.info(`Created MinIO bucket: ${config.minioBucket}`);
        }
      } else if (config.storageType === 's3') {
        this.s3Client = new S3Client({
          region: config.awsRegion,
          credentials: {
            accessKeyId: config.awsAccessKeyId!,
            secretAccessKey: config.awsSecretAccessKey!,
          },
        });
      } else {
        throw new Error(`Unsupported storage type: ${config.storageType}`);
      }

      this.isInitialized = true;
      logger.info(`Storage service initialized with ${config.storageType}`);
    } catch (error) {
      logger.error('Failed to initialize storage service:', error);
      throw error;
    }
  }

  async uploadFile(
    key: string,
    data: Buffer | Readable | string,
    options: UploadOptions = {}
  ): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Storage service not initialized');
    }

    try {
      if (config.storageType === 'minio' && this.minioClient) {
        await this.minioClient.putObject(
          config.minioBucket,
          key,
          data,
          undefined,
          {
            'Content-Type': options.contentType || 'application/octet-stream',
            ...options.metadata
          }
        );
      } else if (config.storageType === 's3' && this.s3Client) {
        const command = new PutObjectCommand({
          Bucket: config.s3Bucket,
          Key: key,
          Body: data,
          ContentType: options.contentType || 'application/octet-stream',
          Metadata: options.metadata
        });
        await this.s3Client.send(command);
      }

      logger.debug(`Uploaded file: ${key}`);
    } catch (error) {
      logger.error(`Failed to upload file ${key}:`, error);
      throw error;
    }
  }

  async downloadFile(key: string): Promise<Buffer> {
    if (!this.isInitialized) {
      throw new Error('Storage service not initialized');
    }

    try {
      if (config.storageType === 'minio' && this.minioClient) {
        const stream = await this.minioClient.getObject(config.minioBucket, key);
        const chunks: Buffer[] = [];
        
        return new Promise((resolve, reject) => {
          stream.on('data', (chunk) => chunks.push(chunk));
          stream.on('end', () => resolve(Buffer.concat(chunks)));
          stream.on('error', reject);
        });
      } else if (config.storageType === 's3' && this.s3Client) {
        const command = new GetObjectCommand({
          Bucket: config.s3Bucket,
          Key: key
        });
        const response = await this.s3Client.send(command);
        
        if (response.Body) {
          const chunks: Uint8Array[] = [];
          const stream = response.Body as Readable;
          
          return new Promise((resolve, reject) => {
            stream.on('data', (chunk) => chunks.push(chunk));
            stream.on('end', () => resolve(Buffer.concat(chunks)));
            stream.on('error', reject);
          });
        }
      }
      
      throw new Error('Failed to download file');
    } catch (error) {
      logger.error(`Failed to download file ${key}:`, error);
      throw error;
    }
  }

  async deleteFile(key: string): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Storage service not initialized');
    }

    try {
      if (config.storageType === 'minio' && this.minioClient) {
        await this.minioClient.removeObject(config.minioBucket, key);
      } else if (config.storageType === 's3' && this.s3Client) {
        const command = new DeleteObjectCommand({
          Bucket: config.s3Bucket,
          Key: key
        });
        await this.s3Client.send(command);
      }

      logger.debug(`Deleted file: ${key}`);
    } catch (error) {
      logger.error(`Failed to delete file ${key}:`, error);
      throw error;
    }
  }

  async getFileUrl(key: string, expiresIn: number = 3600): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('Storage service not initialized');
    }

    try {
      if (config.storageType === 'minio' && this.minioClient) {
        return await this.minioClient.presignedGetObject(config.minioBucket, key, expiresIn);
      } else if (config.storageType === 's3' && this.s3Client) {
        // For S3, you'd typically use getSignedUrl from @aws-sdk/s3-request-presigner
        // For now, return a placeholder
        return `https://${config.s3Bucket}.s3.${config.awsRegion}.amazonaws.com/${key}`;
      }
      
      throw new Error('Failed to generate file URL');
    } catch (error) {
      logger.error(`Failed to get file URL for ${key}:`, error);
      throw error;
    }
  }

  async listFiles(prefix?: string): Promise<StorageFile[]> {
    if (!this.isInitialized) {
      throw new Error('Storage service not initialized');
    }

    try {
      const files: StorageFile[] = [];

      if (config.storageType === 'minio' && this.minioClient) {
        const stream = this.minioClient.listObjects(config.minioBucket, prefix);
        
        return new Promise((resolve, reject) => {
          stream.on('data', (obj) => {
            files.push({
              key: obj.name!,
              size: obj.size,
              lastModified: obj.lastModified,
              etag: obj.etag
            });
          });
          stream.on('end', () => resolve(files));
          stream.on('error', reject);
        });
      }
      
      return files;
    } catch (error) {
      logger.error('Failed to list files:', error);
      throw error;
    }
  }

  async close(): Promise<void> {
    this.isInitialized = false;
    logger.info('Storage service closed');
  }

  get isReady(): boolean {
    return this.isInitialized;
  }
}