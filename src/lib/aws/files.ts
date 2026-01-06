import { putItem, getItem, scanTable, deleteItem } from './dynamo';

/**
 * Files service - CRUD helpers for file records in DynamoDB.
 *
 * Assumptions (configurable via env):
 * - FILES_TABLE: DynamoDB table name that stores file records
 * - FILES_TABLE_PK: Primary key attribute name (default: 'id')
 *
 * Item shape:
 * {
 *   id: string,              // PK (UUID or S3 key)
 *   key: string,             // S3 key
 *   url: string,             // S3 URL
 *   contentType: string,     // MIME type
 *   fileName: string,        // Original file name
 *   fileSize: number,        // File size in bytes
 *   folder: string,          // S3 folder
 *   uploadedAt: string,      // ISO timestamp
 *   uploadedBy: string,      // User email
 *   ...other attributes
 * }
 */

const FILES_TABLE = process.env.FILES_TABLE || 'vz-files';
const FILES_TABLE_PK = process.env.FILES_TABLE_PK || process.env.FILES_TABLE_PK_NAME || 'id';

export type FileRecord = {
  id: string;
  key: string;
  url: string;
  contentType: string;
  fileName: string;
  fileSize: number;
  folder: string;
  uploadedAt: string;
  uploadedBy: string;
  [key: string]: any;
};

const Files = {
  /**
   * Create a new file record
   * Uses the S3 key as the ID (primary key) since it's unique
   */
  async create(data: {
    key: string;
    url: string;
    contentType: string;
    fileName: string;
    fileSize: number;
    folder: string;
    uploadedBy: string;
  }): Promise<FileRecord> {
    // Use S3 key as the ID (primary key) since it's unique
    const id = data.key;
    const now = new Date().toISOString();

    const record: FileRecord = {
      id,
      key: data.key,
      url: data.url,
      contentType: data.contentType,
      fileName: data.fileName,
      fileSize: data.fileSize,
      folder: data.folder,
      uploadedAt: now,
      uploadedBy: data.uploadedBy,
    };

    await putItem(FILES_TABLE, record);
    return record;
  },

  /**
   * Get file record by ID
   */
  async findById(id: string): Promise<FileRecord | null> {
    if (!id) return null;
    const key: Record<string, any> = {};
    key[FILES_TABLE_PK] = id;
    return await getItem<FileRecord>(FILES_TABLE, key);
  },

  /**
   * Get file record by S3 key
   */
  async findByKey(key: string): Promise<FileRecord | null> {
    if (!key) return null;
    // Query by key attribute (requires GSI or scan)
    // For now, use scan (can be optimized with GSI later)
    const files = await scanTable<FileRecord>({ TableName: FILES_TABLE });
    return files.find((f) => f.key === key) || null;
  },

  /**
   * List all files (with optional limit)
   */
  async list(limit?: number): Promise<FileRecord[]> {
    return await scanTable<FileRecord>({ TableName: FILES_TABLE, Limit: limit });
  },

  /**
   * Delete file record by ID
   */
  async delete(id: string): Promise<void> {
    if (!id) throw new Error('id required');
    const key: Record<string, any> = {};
    key[FILES_TABLE_PK] = id;
    await deleteItem(FILES_TABLE, key);
  },
};

export default Files;

