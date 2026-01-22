import { STSClient, AssumeRoleCommand } from '@aws-sdk/client-sts';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';

/**
 * S3 service for uploading and retrieving images.
 * 
 * Configuration via environment variables:
 * - AWS_REGION (default: ap-southeast-1)
 * - S3_BUCKET_NAME (required)
 * - S3_ENDPOINT (optional, for local testing)
 */

const region = process.env.AWS_REGION || 'ap-southeast-1';
const endpoint = process.env.S3_ENDPOINT || undefined;

let curatorClient: S3Client | null = null;
let curatorClientExpiresAt: number | null = null;

function getBucketName(): string {
  const name = process.env.S3_BUCKET_NAME;

  if (!name) {
    throw new Error('S3_BUCKET_NAME environment variable is required');
  }

  return name;
}

async function getWriteS3Client(): Promise<S3Client> {
  const roleArn = process.env.CURATOR_ROLE_ARN;
  if (!roleArn) {
    throw new Error('CURATOR_ROLE_ARN is required for upload');
  }

  const sts = new STSClient({ region });

  const { Credentials } = await sts.send(
    new AssumeRoleCommand({
      RoleArn: roleArn,
      RoleSessionName: `asset-upload-${Date.now()}`,
      DurationSeconds: 900, // 15 minutes
    })
  );

  if (!Credentials) {
    throw new Error('Failed to assume AssetsCuratorRole');
  }

  return new S3Client({
    region,
    credentials: {
      accessKeyId: Credentials.AccessKeyId!,
      secretAccessKey: Credentials.SecretAccessKey!,
      sessionToken: Credentials.SessionToken!,
    },
  });
}

async function getCuratorS3Client(): Promise<S3Client> {
  const roleArn = process.env.CURATOR_ROLE_ARN;
  if (!roleArn) {
    throw new Error('CURATOR_ROLE_ARN is required for presigned URLs');
  }

  // Reuse cached assumed-role client until shortly before expiration
  if (curatorClient && curatorClientExpiresAt && Date.now() < curatorClientExpiresAt - 60_000) {
    return curatorClient;
  }

  const sts = new STSClient({ region });
  const { Credentials } = await sts.send(
    new AssumeRoleCommand({
      RoleArn: roleArn,
      RoleSessionName: `asset-curator-${Date.now()}`,
      DurationSeconds: 900, // 15 minutes
    })
  );

  if (!Credentials) {
    throw new Error('Failed to assume curator role');
  }

  curatorClientExpiresAt = Credentials.Expiration
    ? new Date(Credentials.Expiration).getTime()
    : Date.now() + 15 * 60_000;

  curatorClient = new S3Client({
    region,
    ...(endpoint ? { endpoint } : {}),
    credentials: {
      accessKeyId: Credentials.AccessKeyId!,
      secretAccessKey: Credentials.SecretAccessKey!,
      sessionToken: Credentials.SessionToken!,
    },
  });

  return curatorClient;
}


export interface UploadImageParams {
  file: Buffer | Uint8Array;
  fileName: string;
  contentType: string;
  folder?: string; // Optional folder prefix (e.g., 'images', 'avatars')
}

export interface ImageMetadata {
  key: string;
  url: string;
  bucket: string;
  contentType: string;
  size?: number;
}

/**
 * Upload an image to S3
 */
export async function uploadImage(params: UploadImageParams): Promise<ImageMetadata> {
  const bucketName = getBucketName();

  // 🔐 WRITE CLIENT (AssumeRole)
  const client = await getWriteS3Client();

  const fileExtension = params.fileName.split('.').pop() || 'jpg';
  const uniqueFileName = `${uuidv4()}.${fileExtension}`;
  const key = params.folder ? `${params.folder}/${uniqueFileName}` : uniqueFileName;

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: params.file,
    ContentType: params.contentType,
    // Add metadata if needed
    Metadata: {
      originalFileName: params.fileName,
      uploadedAt: new Date().toISOString(),
    },
  });

  await client.send(command);

  return {
    key,
    url: `s3://${bucketName}/${key}`, // S3 URI format
    bucket: bucketName,
    contentType: params.contentType,
  };
}

/**
 * Generate a presigned URL for getting an image (for preview)
 * The URL is valid for a specified duration (default: 1 hour)
 */
export async function getPresignedUrl(
  key: string,
  expiresIn: number = 3600 // 1 hour default
): Promise<string> {
  const bucketName = getBucketName();
  if (!bucketName) {
    throw new Error('S3_BUCKET_NAME environment variable is required');
  }

  // 🔐 Use curator role for signing presigned GET URLs
  const client = await getCuratorS3Client();
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  const url = await getSignedUrl(client, command, { expiresIn });
  return url;
}

/**
 * Generate presigned URL for multiple images at once
 */
export async function getPresignedUrls(
  keys: string[],
  expiresIn: number = 3600
): Promise<Record<string, string>> {
  const urls: Record<string, string> = {};

  await Promise.all(
    keys.map(async (key) => {
      try {
        urls[key] = await getPresignedUrl(key, expiresIn);
      } catch (error) {
        console.error(`Failed to generate presigned URL for ${key}:`, error);
        urls[key] = '';
      }
    })
  );

  return urls;
}

export function initS3ForTests(opts: { region?: string; endpoint?: string; bucketName?: string }) {
  if (opts.region) process.env.AWS_REGION = opts.region;
  if (opts.endpoint) process.env.S3_ENDPOINT = opts.endpoint;
  if (opts.bucketName) process.env.S3_BUCKET_NAME = opts.bucketName;
  // Reset client so next call rebuilds with new config
  curatorClient = null;
  curatorClientExpiresAt = null;
}

const s3 = {
  uploadImage,
  getPresignedUrl,
  getPresignedUrls,
  initS3ForTests,
};

export default s3;

