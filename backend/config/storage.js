import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Local upload directory fallback
const LOCAL_UPLOAD_DIR = path.resolve(__dirname, '..', 'uploads', 'notes');

/**
 * Storage Adapter supporting Cloudflare R2 (S3-compatible) with automatic local disk fallback.
 */
export class StorageAdapter {
  constructor(options = {}) {
    this.provider = (options.provider || process.env.STORAGE_PROVIDER || 'local').toLowerCase().trim();
    this.accountId = options.accountId || process.env.R2_ACCOUNT_ID;
    this.accessKeyId = options.accessKeyId || process.env.R2_ACCESS_KEY_ID;
    this.secretAccessKey = options.secretAccessKey || process.env.R2_SECRET_ACCESS_KEY;
    this.bucketName = options.bucketName || process.env.R2_BUCKET_NAME || 'codenest-attachments';
    this.localUploadDir = options.localUploadDir || LOCAL_UPLOAD_DIR;
    this.s3Client = options.customS3Client || null;

    this._initClient();
  }

  _initClient() {
    // Only initialize S3Client if provider is 'r2' and credentials are provided
    if (this.provider === 'r2' && this.accountId && this.accessKeyId && this.secretAccessKey) {
      if (!this.s3Client) {
        this.s3Client = new S3Client({
          region: 'auto',
          endpoint: `https://${this.accountId}.r2.cloudflarestorage.com`,
          credentials: {
            accessKeyId: this.accessKeyId,
            secretAccessKey: this.secretAccessKey
          }
        });
      }
      this.isR2Active = true;
    } else {
      this.isR2Active = false;

      // Fail fast if STORAGE_PROVIDER=r2 in production but credentials are missing
      const isProduction = process.env.NODE_ENV === 'production';
      if (this.provider === 'r2' && (!this.accountId || !this.accessKeyId || !this.secretAccessKey)) {
        if (isProduction) {
          throw new Error(
            'Production Storage Configuration Error: STORAGE_PROVIDER=r2 but required Cloudflare R2 credentials (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY) are missing. Silent fallback to ephemeral local storage is prohibited in production.'
          );
        } else {
          console.warn(
            '[Storage] Warning: STORAGE_PROVIDER=r2 but credentials are incomplete. Falling back to local storage in development.'
          );
        }
      }

      // Ensure local directory exists when running local fallback
      if (!fs.existsSync(this.localUploadDir)) {
        try {
          fs.mkdirSync(this.localUploadDir, { recursive: true });
        } catch {
          // Ignore directory creation errors if read-only or in mocked tests
        }
      }
    }
  }

  /**
   * Check whether Cloudflare R2 is configured and active.
   */
  isConfigured() {
    return this.isR2Active;
  }

  /**
   * Uploads an attachment to Cloudflare R2 or local storage fallback.
   * Supports either in-memory buffer or existing local file path.
   *
   * @param {Object} params
   * @param {Buffer} [params.buffer] - File buffer
   * @param {string} [params.filePath] - Existing local file path
   * @param {string} params.originalname - Original uploaded file name
   * @param {string} params.mimetype - MIME type
   * @param {string} [params.filename] - Unique filename
   * @returns {Promise<{ fileUrl: string, storageProvider: string, key?: string }>}
   */
  async uploadAttachment({ buffer, filePath, originalname, mimetype, filename }) {
    if (this.provider === 'r2' && !this.isR2Active) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error(
          'Production Storage Error: STORAGE_PROVIDER=r2 is set in production but R2 client is inactive due to missing credentials. Refusing upload to ephemeral local storage.'
        );
      }
    }

    let fileBuffer = buffer;
    if (!fileBuffer && filePath) {
      if (fs.existsSync(filePath)) {
        fileBuffer = await fs.promises.readFile(filePath);
      }
    }

    if (!fileBuffer || !Buffer.isBuffer(fileBuffer)) {
      throw new Error('Upload error: Valid file buffer is required.');
    }

    const safeFilename = filename || `${Date.now()}_${Math.round(Math.random() * 1e6)}_${path.basename(originalname || 'file')}`;

    if (this.isR2Active && this.s3Client) {
      const key = `notes/${safeFilename}`;
      const safeDownloadName = encodeURIComponent(originalname || safeFilename);

      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: fileBuffer,
        ContentType: mimetype || 'application/octet-stream',
        ContentDisposition: `attachment; filename="${safeDownloadName}"`
      });

      await this.s3Client.send(command);

      // Clean up temporary local disk file if Multer wrote one
      if (filePath && fs.existsSync(filePath)) {
        try {
          await fs.promises.unlink(filePath);
        } catch {
          // Ignore temp file cleanup error
        }
      }

      return {
        fileUrl: key,
        storageProvider: 'r2',
        key
      };
    }

    // Local Disk Storage Fallback
    // If the file was already placed in this.localUploadDir by Multer diskStorage, avoid redundant write
    if (filePath) {
      const resolvedFilePath = path.resolve(filePath);
      const expectedDirWithSep = this.localUploadDir.endsWith(path.sep) ? this.localUploadDir : this.localUploadDir + path.sep;
      if (resolvedFilePath.startsWith(expectedDirWithSep)) {
        const localName = path.basename(resolvedFilePath);
        return {
          fileUrl: `/uploads/notes/${localName}`,
          storageProvider: 'local'
        };
      }
    }

    const localFilePath = path.join(this.localUploadDir, safeFilename);
    await fs.promises.writeFile(localFilePath, fileBuffer);

    return {
      fileUrl: `/uploads/notes/${safeFilename}`,
      storageProvider: 'local'
    };
  }

  /**
   * Generates a secure download resolution:
   * - For R2: creates a short-lived pre-signed URL (default 300s TTL).
   * - For Local: returns local file resolution for streaming.
   *
   * @param {string} fileUrl - Stored file_url
   * @param {string} originalname - Friendly download file name
   * @param {number} [expiresIn=300] - Expiry in seconds for signed URL
   * @returns {Promise<{ type: 'redirect'|'local', url?: string, path?: string, fileName?: string }>}
   */
  async getAttachmentDownloadUrl(fileUrl, originalname, expiresIn = 300) {
    if (!fileUrl || typeof fileUrl !== 'string') {
      throw new Error('Download error: Valid fileUrl is required.');
    }

    const trimmedUrl = fileUrl.trim();

    // Check if the file is an R2 key (starts with notes/ or is not /uploads/)
    const isLocalUrl = trimmedUrl.startsWith('/uploads/');

    if (!isLocalUrl && this.isR2Active && this.s3Client) {
      const key = trimmedUrl;
      const safeDownloadName = encodeURIComponent(originalname || path.basename(key));

      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        ResponseContentDisposition: `attachment; filename="${safeDownloadName}"`
      });

      const signedUrl = await getSignedUrl(this.s3Client, command, { expiresIn });

      return {
        type: 'redirect',
        url: signedUrl,
        expiresIn
      };
    }

    // Local Storage Resolution (handles /uploads/notes/<filename>)
    const subPath = trimmedUrl.replace(/^\/uploads\/notes\//, '').replace(/^\/uploads\//, '');
    if (!subPath || subPath.includes('..') || subPath.includes('/') || subPath.includes('\\')) {
      throw new Error('Security Error: Invalid attachment file path traversal detected.');
    }
    const fileName = path.basename(subPath);
    const absolutePath = path.resolve(this.localUploadDir, fileName);

    const uploadDirWithSep = this.localUploadDir.endsWith(path.sep) ? this.localUploadDir : this.localUploadDir + path.sep;
    if (!absolutePath.startsWith(uploadDirWithSep)) {
      throw new Error('Security Error: Invalid attachment file path traversal detected.');
    }

    return {
      type: 'local',
      path: absolutePath,
      fileName: originalname || fileName
    };
  }

  /**
   * Deletes an attachment from R2 or local storage.
   *
   * @param {string} fileUrl - Stored file_url
   * @returns {Promise<{ success: boolean, deletedFrom: string }>}
   */
  async deleteAttachment(fileUrl) {
    if (!fileUrl || typeof fileUrl !== 'string') {
      return { success: false, reason: 'Invalid fileUrl' };
    }

    const trimmedUrl = fileUrl.trim();
    const isLocalUrl = trimmedUrl.startsWith('/uploads/');

    if (!isLocalUrl && this.isR2Active && this.s3Client) {
      try {
        const command = new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: trimmedUrl
        });
        await this.s3Client.send(command);
        return { success: true, deletedFrom: 'r2' };
      } catch (err) {
        console.error('R2 Delete Error:', err.message);
        return { success: false, deletedFrom: 'r2', error: err.message };
      }
    }

    // Local File Deletion with Path Traversal Protection
    try {
      const fileName = path.basename(trimmedUrl.replace(/^\/uploads\/notes\//, '').replace(/^\/uploads\//, ''));
      const absolutePath = path.resolve(this.localUploadDir, fileName);
      const uploadDirWithSep = this.localUploadDir.endsWith(path.sep) ? this.localUploadDir : this.localUploadDir + path.sep;

      if (!absolutePath.startsWith(uploadDirWithSep)) {
        return { success: false, reason: 'Path traversal prevented' };
      }

      if (fs.existsSync(absolutePath)) {
        await fs.promises.unlink(absolutePath);
        return { success: true, deletedFrom: 'local' };
      }

      return { success: true, deletedFrom: 'local', note: 'File did not exist' };
    } catch (err) {
      console.error('Local File Delete Error:', err.message);
      return { success: false, deletedFrom: 'local', error: err.message };
    }
  }
}

// Default singleton instance using environment variables
export const storage = new StorageAdapter();

export default storage;
