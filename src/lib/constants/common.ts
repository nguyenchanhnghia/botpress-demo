/**
 * Common constants used across the application
 */

/** Presigned URL expiration time: 1 hour (3600 seconds) */
export const PRESIGNED_URL_EXPIRES_IN = 3600;

/** Allowed image file types for upload */
export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
] as const;

/** Maximum file size for image upload: 10MB (in bytes) */
export const MAX_IMAGE_FILE_SIZE = 10 * 1024 * 1024; // 10MB

