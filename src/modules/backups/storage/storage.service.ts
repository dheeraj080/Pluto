import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as crypto from 'crypto';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3Client: S3Client;
  private readonly bucketName: string;

  constructor(private readonly configService: ConfigService) {
    this.bucketName = this.configService.get<string>('OBJECT_STORAGE_BUCKET', 'pluto-backups');

    const endpoint = this.configService.get<string>('OBJECT_STORAGE_ENDPOINT');
    const region = this.configService.get<string>('OBJECT_STORAGE_REGION', 'us-east-1');
    const accessKeyId = this.configService.get<string>(
      'OBJECT_STORAGE_ACCESS_KEY_ID',
      'minioadmin',
    );
    const secretAccessKey = this.configService.get<string>(
      'OBJECT_STORAGE_SECRET_ACCESS_KEY',
      'minioadmin',
    );
    const forcePathStyle = this.configService.get<boolean>('OBJECT_STORAGE_FORCE_PATH_STYLE', true);

    this.s3Client = new S3Client({
      region,
      endpoint: endpoint || undefined,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      forcePathStyle,
    });
  }

  /**
   * Generates a short-lived presigned upload URL for direct S3 upload
   */
  async generatePresignedUploadUrl(
    storageKey: string,
    ttlSeconds: number = 900,
    contentType: string = 'application/octet-stream',
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: storageKey,
      ContentType: contentType,
    });

    return getSignedUrl(this.s3Client, command, { expiresIn: ttlSeconds });
  }

  /**
   * Generates a short-lived presigned download URL for private S3 download
   */
  async generatePresignedDownloadUrl(
    storageKey: string,
    ttlSeconds: number = 900,
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: storageKey,
    });

    return getSignedUrl(this.s3Client, command, { expiresIn: ttlSeconds });
  }

  /**
   * Inspects metadata of an object in storage
   */
  async headObject(storageKey: string): Promise<{ contentLength: number; eTag?: string } | null> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: storageKey,
      });

      const result = await this.s3Client.send(command);
      return {
        contentLength: result.ContentLength || 0,
        eTag: result.ETag,
      };
    } catch (err: unknown) {
      const name = (err as { name?: string })?.name;
      if (name === 'NotFound' || name === 'NoSuchKey') {
        return null;
      }
      this.logger.warn(
        `HeadObject failed for key ${storageKey}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }

  /**
   * Streams the uploaded object from S3 and computes its SHA-256 hash to verify data integrity
   */
  async verifyObjectChecksum(
    storageKey: string,
    expectedChecksumSha256: string,
  ): Promise<{ matches: boolean; actualChecksumSha256: string; actualBytes: number }> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: storageKey,
    });

    const response = await this.s3Client.send(command);
    if (!response.Body) {
      throw new Error(`Empty body returned for storage key ${storageKey}`);
    }

    const hash = crypto.createHash('sha256');
    let actualBytes = 0;

    for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
      actualBytes += chunk.length;
      hash.update(chunk);
    }

    const actualChecksumSha256 = hash.digest('hex');
    const matches = actualChecksumSha256.toLowerCase() === expectedChecksumSha256.toLowerCase();

    return {
      matches,
      actualChecksumSha256,
      actualBytes,
    };
  }

  /**
   * Copies an object within the storage bucket (e.g. promoting from staging to completed)
   */
  async copyObject(sourceKey: string, destinationKey: string): Promise<void> {
    const command = new CopyObjectCommand({
      Bucket: this.bucketName,
      CopySource: `${this.bucketName}/${sourceKey}`,
      Key: destinationKey,
    });
    await this.s3Client.send(command);
  }

  /**
   * Deletes a single object from storage. Propagates errors so caller can handle storage failures.
   */
  async deleteObject(storageKey: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: storageKey,
      });
      await this.s3Client.send(command);
    } catch (err) {
      this.logger.error(
        `Failed to delete storage object ${storageKey}: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw err;
    }
  }

  /**
   * Batch deletes objects from storage. Propagates errors so caller can handle storage failures.
   */
  async deleteObjects(storageKeys: string[]): Promise<void> {
    if (storageKeys.length === 0) return;

    try {
      const command = new DeleteObjectsCommand({
        Bucket: this.bucketName,
        Delete: {
          Objects: storageKeys.map((Key) => ({ Key })),
          Quiet: true,
        },
      });
      await this.s3Client.send(command);
    } catch (err) {
      this.logger.error(
        `Failed to delete batch storage objects: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw err;
    }
  }
}
