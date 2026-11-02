import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import os from 'os';
import pool from '../config/db.js';
import storageSingleton, { StorageAdapter } from '../config/storage.js';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { downloadNoteFile, createNote, updateNote, deleteNote } from '../controllers/notesController.js';
import { verifyFileSignature, validateFileContent } from '../middleware/uploadMiddleware.js';

describe('Phase 9.2A: Cloudflare R2 & Local Storage Adapter Test Suite', () => {
  let tempLocalDir;

  before(async () => {
    tempLocalDir = path.join(os.tmpdir(), `codenest_storage_test_${Date.now()}`);
    await fs.promises.mkdir(tempLocalDir, { recursive: true });
  });

  after(async () => {
    try {
      await fs.promises.rm(tempLocalDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  });

  // =========================================================================
  // 1. LOCAL STORAGE FALLBACK TESTS
  // =========================================================================
  describe('Local Storage Fallback Mode', () => {
    it('1. Defaults to local storage when R2 credentials are not provided', () => {
      const adapter = new StorageAdapter({
        provider: 'local',
        localUploadDir: tempLocalDir
      });

      assert.equal(adapter.isConfigured(), false);
      assert.equal(adapter.provider, 'local');
    });

    it('2. Successfully uploads buffer to local storage directory', async () => {
      const adapter = new StorageAdapter({
        provider: 'local',
        localUploadDir: tempLocalDir
      });

      const testBuffer = Buffer.from('CodeNest sample note content for testing');
      const result = await adapter.uploadAttachment({
        buffer: testBuffer,
        originalname: 'test_cheatsheet.pdf',
        mimetype: 'application/pdf',
        filename: 'unit_test_note_1.pdf'
      });

      assert.equal(result.storageProvider, 'local');
      assert.equal(result.fileUrl, '/uploads/notes/unit_test_note_1.pdf');

      // Verify file exists on disk
      const writtenPath = path.join(tempLocalDir, 'unit_test_note_1.pdf');
      assert.equal(fs.existsSync(writtenPath), true);
      const readContent = await fs.promises.readFile(writtenPath, 'utf8');
      assert.equal(readContent, 'CodeNest sample note content for testing');
    });

    it('3. Resolves local download file path correctly', async () => {
      const adapter = new StorageAdapter({
        provider: 'local',
        localUploadDir: tempLocalDir
      });

      const res = await adapter.getAttachmentDownloadUrl(
        '/uploads/notes/unit_test_note_1.pdf',
        'Download Name.pdf'
      );

      assert.equal(res.type, 'local');
      assert.equal(res.path, path.join(tempLocalDir, 'unit_test_note_1.pdf'));
      assert.equal(res.fileName, 'Download Name.pdf');
    });

    it('4. Rejects local path traversal attempts during download resolution', async () => {
      const adapter = new StorageAdapter({
        provider: 'local',
        localUploadDir: tempLocalDir
      });

      await assert.rejects(
        async () => {
          await adapter.getAttachmentDownloadUrl('/uploads/notes/../../package.json', 'exploit.json');
        },
        /Security Error: Invalid attachment file path traversal detected/
      );
    });

    it('5. Successfully deletes file from local storage', async () => {
      const adapter = new StorageAdapter({
        provider: 'local',
        localUploadDir: tempLocalDir
      });

      const filePath = path.join(tempLocalDir, 'unit_test_note_1.pdf');
      assert.equal(fs.existsSync(filePath), true);

      const deleteRes = await adapter.deleteAttachment('/uploads/notes/unit_test_note_1.pdf');
      assert.equal(deleteRes.success, true);
      assert.equal(deleteRes.deletedFrom, 'local');
      assert.equal(fs.existsSync(filePath), false);
    });
  });

  // =========================================================================
  // 2. MOCK CLOUDFLARE R2 CLIENT TESTS
  // =========================================================================
  describe('Cloudflare R2 Adapter Mode (Mocked S3)', () => {
    it('6. Activates R2 when provider is r2 and credentials are present', () => {
      const mockS3Client = {
        send: async () => ({})
      };

      const adapter = new StorageAdapter({
        provider: 'r2',
        accountId: 'test_account_123',
        accessKeyId: 'test_key_id',
        secretAccessKey: 'test_secret_key',
        bucketName: 'test-bucket',
        customS3Client: mockS3Client
      });

      assert.equal(adapter.isConfigured(), true);
      assert.equal(adapter.bucketName, 'test-bucket');
    });

    it('7. Sends PutObjectCommand to R2 with correct parameters', async () => {
      let capturedCommand = null;

      const mockS3Client = {
        send: async (command) => {
          capturedCommand = command;
          return { $metadata: { httpStatusCode: 200 } };
        }
      };

      const adapter = new StorageAdapter({
        provider: 'r2',
        accountId: 'test_account_123',
        accessKeyId: 'test_key_id',
        secretAccessKey: 'test_secret_key',
        bucketName: 'codenest-r2-bucket',
        customS3Client: mockS3Client
      });

      const fileBuffer = Buffer.from('Mock PDF binary bytes');
      const uploadResult = await adapter.uploadAttachment({
        buffer: fileBuffer,
        originalname: 'algorithms_cheatsheet.pdf',
        mimetype: 'application/pdf',
        filename: 'algo_sheet_123.pdf'
      });

      assert.equal(uploadResult.storageProvider, 'r2');
      assert.equal(uploadResult.fileUrl, 'notes/algo_sheet_123.pdf');
      assert.equal(uploadResult.key, 'notes/algo_sheet_123.pdf');

      assert.ok(capturedCommand instanceof PutObjectCommand);
      assert.equal(capturedCommand.input.Bucket, 'codenest-r2-bucket');
      assert.equal(capturedCommand.input.Key, 'notes/algo_sheet_123.pdf');
      assert.equal(capturedCommand.input.ContentType, 'application/pdf');
      assert.equal(capturedCommand.input.ContentDisposition, 'attachment; filename="algorithms_cheatsheet.pdf"');
    });

    it('8. Sends DeleteObjectCommand to R2 when deleting R2 fileUrl', async () => {
      let capturedDeleteCommand = null;

      const mockS3Client = {
        send: async (command) => {
          capturedDeleteCommand = command;
          return { $metadata: { httpStatusCode: 204 } };
        }
      };

      const adapter = new StorageAdapter({
        provider: 'r2',
        accountId: 'test_account_123',
        accessKeyId: 'test_key_id',
        secretAccessKey: 'test_secret_key',
        bucketName: 'codenest-r2-bucket',
        customS3Client: mockS3Client
      });

      const delResult = await adapter.deleteAttachment('notes/algo_sheet_123.pdf');

      assert.equal(delResult.success, true);
      assert.equal(delResult.deletedFrom, 'r2');
      assert.ok(capturedDeleteCommand instanceof DeleteObjectCommand);
      assert.equal(capturedDeleteCommand.input.Bucket, 'codenest-r2-bucket');
      assert.equal(capturedDeleteCommand.input.Key, 'notes/algo_sheet_123.pdf');
    });

    it('8b. Generates signed download URL with 300s TTL for R2 objects', async () => {
      const dummyClient = new S3Client({
        region: 'auto',
        endpoint: 'https://test_account_123.r2.cloudflarestorage.com',
        credentials: {
          accessKeyId: 'test_access_key',
          secretAccessKey: 'test_secret_key_1234567890'
        }
      });

      const adapter = new StorageAdapter({
        provider: 'r2',
        accountId: 'test_account_123',
        accessKeyId: 'test_access_key',
        secretAccessKey: 'test_secret_key_1234567890',
        bucketName: 'codenest-r2-bucket',
        customS3Client: dummyClient
      });

      const signedRes = await adapter.getAttachmentDownloadUrl('notes/sample_doc.pdf', 'Sample Document.pdf', 300);

      assert.equal(signedRes.type, 'redirect');
      assert.equal(signedRes.expiresIn, 300);
      assert.ok(typeof signedRes.url === 'string');
      assert.ok(signedRes.url.includes('codenest-r2-bucket.test_account_123.r2.cloudflarestorage.com/notes/sample_doc.pdf'));
      assert.ok(signedRes.url.includes('X-Amz-Signature'));
      assert.ok(signedRes.url.includes('X-Amz-Expires=300'));
    });

    it('9. Handles legacy /uploads/ URLs on local disk even when R2 is configured', async () => {
      const mockS3Client = {
        send: async () => ({})
      };

      const adapter = new StorageAdapter({
        provider: 'r2',
        accountId: 'test_account_123',
        accessKeyId: 'test_key_id',
        secretAccessKey: 'test_secret_key',
        bucketName: 'codenest-r2-bucket',
        localUploadDir: tempLocalDir,
        customS3Client: mockS3Client
      });

      // Write a legacy file
      await fs.promises.writeFile(path.join(tempLocalDir, 'legacy_file.txt'), 'legacy content');

      // Request download for legacy /uploads/ path
      const res = await adapter.getAttachmentDownloadUrl(
        '/uploads/notes/legacy_file.txt',
        'legacy_file.txt'
      );

      // Should resolve to local file, maintaining backward compatibility
      assert.equal(res.type, 'local');
      assert.equal(res.path, path.join(tempLocalDir, 'legacy_file.txt'));

      // Delete legacy file
      const del = await adapter.deleteAttachment('/uploads/notes/legacy_file.txt');
      assert.equal(del.success, true);
      assert.equal(del.deletedFrom, 'local');
    });
  });

  // =========================================================================
  // 3. ERROR & EDGE CASE HANDLING TESTS
  // =========================================================================
  describe('Error Handling & Edge Cases', () => {
    it('10. Rejects upload when buffer is null, undefined, or invalid', async () => {
      const adapter = new StorageAdapter({ provider: 'local', localUploadDir: tempLocalDir });

      await assert.rejects(
        async () => {
          await adapter.uploadAttachment({ buffer: null, originalname: 'fail.pdf' });
        },
        /Upload error: Valid file buffer is required/
      );

      await assert.rejects(
        async () => {
          await adapter.uploadAttachment({ buffer: 'not a buffer', originalname: 'fail.pdf' });
        },
        /Upload error: Valid file buffer is required/
      );
    });

    it('11. Rejects getAttachmentDownloadUrl when fileUrl is empty or not string', async () => {
      const adapter = new StorageAdapter({ provider: 'local', localUploadDir: tempLocalDir });

      await assert.rejects(
        async () => {
          await adapter.getAttachmentDownloadUrl('', 'test.pdf');
        },
        /Download error: Valid fileUrl is required/
      );

      await assert.rejects(
        async () => {
          await adapter.getAttachmentDownloadUrl(null, 'test.pdf');
        },
        /Download error: Valid fileUrl is required/
      );
    });

    it('12. Gracefully handles R2 delete API failures without throwing', async () => {
      const failingS3Client = {
        send: async () => {
          throw new Error('R2 Network Connection Timeout');
        }
      };

      const adapter = new StorageAdapter({
        provider: 'r2',
        accountId: 'test_account_123',
        accessKeyId: 'test_key_id',
        secretAccessKey: 'test_secret_key',
        bucketName: 'codenest-r2-bucket',
        customS3Client: failingS3Client
      });

      const res = await adapter.deleteAttachment('notes/broken_key.pdf');
      assert.equal(res.success, false);
      assert.equal(res.deletedFrom, 'r2');
      assert.equal(res.error, 'R2 Network Connection Timeout');
    });

    it('13. Falls back to local when STORAGE_PROVIDER=r2 but credentials are incomplete', () => {
      const adapter = new StorageAdapter({
        provider: 'r2',
        accountId: 'test_account_only', // missing accessKeyId and secretAccessKey
        localUploadDir: tempLocalDir
      });

      assert.equal(adapter.isConfigured(), false);
      assert.equal(adapter.isR2Active, false);
    });
  });
});

// Helper mock response object builder
const createMockRes = () => {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    downloadPath: null,
    downloadName: null,
    redirectUrl: null,
    redirectStatus: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    download(filePath, fileName) {
      this.downloadPath = filePath;
      this.downloadName = fileName;
      return this;
    },
    redirect(statusOrUrl, url) {
      if (typeof statusOrUrl === 'number') {
        this.redirectStatus = statusOrUrl;
        this.redirectUrl = url;
      } else {
        this.redirectStatus = 302;
        this.redirectUrl = statusOrUrl;
      }
      return this;
    }
  };
  return res;
};

// =========================================================================
// PHASE 9.2B: CONTROLLER & MIDDLEWARE INTEGRATION TEST SUITE
// =========================================================================
describe('Phase 9.2B: Notes Controller & Upload Middleware Integration', () => {
  const originalEnv = { ...process.env };
  const mockOwnerEmail = 'owner@codenest.com';
  let tempUploadDir;

  before(async () => {
    tempUploadDir = path.join(os.tmpdir(), `codenest_92b_upload_${Date.now()}`);
    await fs.promises.mkdir(tempUploadDir, { recursive: true });
  });

  after(async () => {
    try {
      await fs.promises.rm(tempUploadDir, { recursive: true, force: true });
    } catch (_) {}
  });

  beforeEach(() => {
    process.env.OWNER_EMAIL = mockOwnerEmail;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  // -----------------------------------------------------------------------
  // Production Fail-Fast & Environment Protection Tests
  // -----------------------------------------------------------------------
  describe('Production Storage Guardrails', () => {
    it('14. Fails fast on initialization if STORAGE_PROVIDER=r2 in production but credentials are missing', () => {
      const prevNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      try {
        assert.throws(
          () => {
            new StorageAdapter({
              provider: 'r2',
              accountId: '', // missing
              accessKeyId: '',
              secretAccessKey: ''
            });
          },
          /Production Storage Configuration Error: STORAGE_PROVIDER=r2 but required Cloudflare R2 credentials/
        );
      } finally {
        process.env.NODE_ENV = prevNodeEnv;
      }
    });

    it('15. Refuses upload to ephemeral local storage in production if R2 is inactive', async () => {
      const prevNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      try {
        const adapter = new StorageAdapter({
          provider: 'r2',
          accountId: 'key_present',
          accessKeyId: 'id_present',
          secretAccessKey: 'sec_present',
          customS3Client: { send: async () => ({}) }
        });
        // Manually simulate client becoming inactive
        adapter.isR2Active = false;

        await assert.rejects(
          async () => {
            await adapter.uploadAttachment({
              buffer: Buffer.from('%PDF-1.4 test'),
              originalname: 'test.pdf'
            });
          },
          /Production Storage Error: STORAGE_PROVIDER=r2 is set in production but R2 client is inactive/
        );
      } finally {
        process.env.NODE_ENV = prevNodeEnv;
      }
    });
  });

  // -----------------------------------------------------------------------
  // Middleware: Memory Buffer & File Signature Validation Tests
  // -----------------------------------------------------------------------
  describe('Upload Middleware Buffer Validation', () => {
    it('16. Validates file signatures directly from Buffer without disk I/O', () => {
      // PDF
      const pdfBuffer = Buffer.from('%PDF-1.4 valid pdf file content');
      assert.equal(verifyFileSignature(pdfBuffer, 'notes.pdf', 'application/pdf'), true);

      // PNG
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
      assert.equal(verifyFileSignature(pngBuffer, 'diagram.png', 'image/png'), true);

      // Plain text
      const txtBuffer = Buffer.from('Simple study notes in plain text');
      assert.equal(verifyFileSignature(txtBuffer, 'notes.txt', 'text/plain'), true);
    });

    it('17. Rejects spoofed MIME or extension from Buffer', () => {
      // PHP script spoofed as image/png
      const phpScript = Buffer.from('<?php echo "malicious script"; ?>');
      assert.equal(verifyFileSignature(phpScript, 'image.png', 'image/png'), false);

      // PDF bytes spoofed with .png extension
      const pdfBytes = Buffer.from('%PDF-1.4 header');
      assert.equal(verifyFileSignature(pdfBytes, 'image.png', 'image/png'), false);
    });

    it('18. validateFileContent middleware strips invalid file buffer and returns 400', () => {
      const req = {
        file: {
          buffer: Buffer.from('malicious executable content'),
          originalname: 'document.pdf',
          mimetype: 'application/pdf'
        }
      };
      const res = createMockRes();
      let nextCalled = false;

      validateFileContent(req, res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, false);
      assert.equal(res.statusCode, 400);
      assert.equal(req.file, undefined);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /invalid file content/i);
    });
  });

  // -----------------------------------------------------------------------
  // Controller: Notes Download, Authorization & Backward Compatibility Tests
  // -----------------------------------------------------------------------
  describe('Notes Controller Download & Authorization', () => {
    it('19. Redirects to Cloudflare R2 pre-signed URL when note attachment is an R2 key', async () => {
      const originalExecute = pool.execute;
      const originalAdapter = storageSingleton;

      // Mock S3 client generating signed URLs
      const mockS3Client = new S3Client({
        region: 'auto',
        endpoint: 'https://test_account_123.r2.cloudflarestorage.com',
        credentials: { accessKeyId: 'k', secretAccessKey: 's1234567890' }
      });

      storageSingleton.provider = 'r2';
      storageSingleton.accountId = 'test_account_123';
      storageSingleton.accessKeyId = 'k';
      storageSingleton.secretAccessKey = 's1234567890';
      storageSingleton.bucketName = 'codenest-r2-bucket';
      storageSingleton.s3Client = mockS3Client;
      storageSingleton.isR2Active = true;

      pool.execute = async (sql) => {
        if (sql.includes('SELECT id, title, file_url, file_name, status FROM notes')) {
          return [[{
            id: 101,
            title: 'R2 Cloud Note',
            file_url: 'notes/1730000000_algorithms.pdf',
            file_name: 'algorithms.pdf',
            status: 'published'
          }]];
        }
        return [[]];
      };

      try {
        const req = {
          params: { id: '101' },
          user: { id: 5, email: 'student@example.com', role: 'student' }
        };
        const res = createMockRes();

        await downloadNoteFile(req, res);

        assert.equal(res.redirectStatus, 302);
        assert.ok(typeof res.redirectUrl === 'string');
        assert.ok(res.redirectUrl.includes('codenest-r2-bucket.test_account_123.r2.cloudflarestorage.com/notes/1730000000_algorithms.pdf'));
        assert.ok(res.redirectUrl.includes('X-Amz-Signature'));
      } finally {
        pool.execute = originalExecute;
        storageSingleton.provider = 'local';
        storageSingleton.isR2Active = false;
        storageSingleton.s3Client = null;
      }
    });

    it('20. Rejects unauthenticated download requests with HTTP 401', async () => {
      const req = { params: { id: '101' }, user: undefined };
      const res = createMockRes();

      await downloadNoteFile(req, res);

      assert.equal(res.statusCode, 401);
      assert.equal(res.body.success, false);
    });

    it('21. Rejects student downloading draft note with HTTP 403 Forbidden', async () => {
      const originalExecute = pool.execute;

      pool.execute = async (sql) => {
        if (sql.includes('SELECT id, title, file_url, file_name, status FROM notes')) {
          return [[{
            id: 102,
            title: 'Draft Notes for Course',
            file_url: 'notes/draft.pdf',
            file_name: 'draft.pdf',
            status: 'draft'
          }]];
        }
        return [[]];
      };

      try {
        const req = {
          params: { id: '102' },
          user: { id: 7, email: 'student@example.com', role: 'student' }
        };
        const res = createMockRes();

        await downloadNoteFile(req, res);

        assert.equal(res.statusCode, 403);
        assert.equal(res.body.success, false);
        assert.match(res.body.message, /forbidden|draft/i);
      } finally {
        pool.execute = originalExecute;
      }
    });

    it('22. Allows Academy Owner to download draft notes', async () => {
      const originalExecute = pool.execute;
      const mockS3Client = new S3Client({
        region: 'auto',
        endpoint: 'https://test_account_123.r2.cloudflarestorage.com',
        credentials: { accessKeyId: 'k', secretAccessKey: 's1234567890' }
      });

      storageSingleton.provider = 'r2';
      storageSingleton.accountId = 'test_account_123';
      storageSingleton.accessKeyId = 'k';
      storageSingleton.secretAccessKey = 's1234567890';
      storageSingleton.bucketName = 'codenest-r2-bucket';
      storageSingleton.s3Client = mockS3Client;
      storageSingleton.isR2Active = true;

      pool.execute = async (sql) => {
        if (sql.includes('SELECT id, title, file_url, file_name, status FROM notes')) {
          return [[{
            id: 103,
            title: 'Owner Draft Notes',
            file_url: 'notes/owner_draft.pdf',
            file_name: 'owner_draft.pdf',
            status: 'draft'
          }]];
        }
        return [[]];
      };

      try {
        const req = {
          params: { id: '103' },
          user: { id: 1, email: mockOwnerEmail, role: 'owner' }
        };
        const res = createMockRes();

        await downloadNoteFile(req, res);

        assert.equal(res.redirectStatus, 302);
        assert.ok(res.redirectUrl.includes('owner_draft.pdf'));
      } finally {
        pool.execute = originalExecute;
        storageSingleton.provider = 'local';
        storageSingleton.isR2Active = false;
        storageSingleton.s3Client = null;
      }
    });
  });

  // -----------------------------------------------------------------------
  // Controller: Notes Lifecycle, Upload, and Deletion Reliability
  // -----------------------------------------------------------------------
  describe('Notes CRUD & Deletion Reliability', () => {
    it('23. createNote uploads through storage adapter and persists note metadata', async () => {
      const originalExecute = pool.execute;
      let insertedParams = null;

      pool.execute = async (sql, params) => {
        if (sql.includes('SELECT id, title FROM courses')) {
          return [[{ id: 1, title: 'Python Basics' }]];
        }
        if (sql.includes('INSERT INTO notes')) {
          insertedParams = params;
          return [{ insertId: 55 }];
        }
        if (sql.includes('INSERT INTO activity_logs')) {
          return [{ insertId: 10 }];
        }
        if (sql.includes('SELECT \n        n.*, c.title AS course_title')) {
          return [[{ id: 55, title: 'Lecture 1', file_url: insertedParams[5], status: 'published' }]];
        }
        return [[]];
      };

      try {
        const req = {
          body: {
            title: 'Lecture 1',
            description: 'Introduction',
            content: 'Text content',
            course_id: '1',
            status: 'published'
          },
          file: {
            buffer: Buffer.from('%PDF-1.4 dummy pdf'),
            originalname: 'lecture1.pdf',
            mimetype: 'application/pdf',
            size: 1024
          },
          user: { id: 1, email: mockOwnerEmail, role: 'owner' }
        };
        const res = createMockRes();

        await createNote(req, res);

        assert.equal(res.statusCode, 201);
        assert.equal(res.body.success, true);
        assert.ok(insertedParams !== null);
        assert.ok(insertedParams[5].includes('/uploads/notes/')); // Local fileUrl generated
        assert.equal(insertedParams[6], 'lecture1.pdf');
        assert.equal(insertedParams[7], 'PDF');
      } finally {
        pool.execute = originalExecute;
      }
    });

    it('24. createNote cleans up uploaded storage file if database insert fails', async () => {
      const originalExecute = pool.execute;
      let deletedUrl = null;

      const originalDelete = storageSingleton.deleteAttachment.bind(storageSingleton);
      storageSingleton.deleteAttachment = async (url) => {
        deletedUrl = url;
        return { success: true, deletedFrom: 'mock' };
      };

      pool.execute = async (sql) => {
        if (sql.includes('SELECT id, title FROM courses')) {
          return [[{ id: 1, title: 'Python Basics' }]];
        }
        if (sql.includes('INSERT INTO notes')) {
          throw new Error('Database transaction deadlocked');
        }
        return [[]];
      };

      try {
        const req = {
          body: { title: 'Deadlock Note', course_id: '1' },
          file: {
            buffer: Buffer.from('%PDF-1.4 test buffer'),
            originalname: 'test.pdf',
            mimetype: 'application/pdf',
            size: 500
          },
          user: { id: 1 }
        };
        const res = createMockRes();

        await createNote(req, res);

        assert.equal(res.statusCode, 500);
        assert.equal(res.body.success, false);
        assert.ok(deletedUrl !== null, 'Uploaded file must be cleaned up on database error to avoid orphan');
      } finally {
        pool.execute = originalExecute;
        storageSingleton.deleteAttachment = originalDelete;
      }
    });

    it('25. deleteNote safely deletes attached file and removes DB record', async () => {
      const originalExecute = pool.execute;
      let dbDeleted = false;
      let storageDeletedUrl = null;

      const originalDelete = storageSingleton.deleteAttachment.bind(storageSingleton);
      storageSingleton.deleteAttachment = async (url) => {
        storageDeletedUrl = url;
        return { success: true, deletedFrom: 'r2' };
      };

      pool.execute = async (sql) => {
        if (sql.includes('SELECT id, title, file_url FROM notes')) {
          return [[{ id: 205, title: 'Note to delete', file_url: 'notes/sample.pdf' }]];
        }
        if (sql.includes('DELETE FROM notes')) {
          dbDeleted = true;
          return [{ affectedRows: 1 }];
        }
        if (sql.includes('INSERT INTO activity_logs')) {
          return [{ insertId: 1 }];
        }
        return [[]];
      };

      try {
        const req = {
          params: { id: '205' },
          user: { id: 1 }
        };
        const res = createMockRes();

        await deleteNote(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.body.success, true);
        assert.equal(storageDeletedUrl, 'notes/sample.pdf');
        assert.equal(dbDeleted, true);
      } finally {
        pool.execute = originalExecute;
        storageSingleton.deleteAttachment = originalDelete;
      }
    });

    it('26. deleteNote fails with 502 and preserves database record if R2 deletion fails', async () => {
      const originalExecute = pool.execute;
      let dbDeleted = false;

      const originalDelete = storageSingleton.deleteAttachment.bind(storageSingleton);
      storageSingleton.deleteAttachment = async () => {
        return { success: false, deletedFrom: 'r2', error: 'Cloudflare R2 Connection Timeout' };
      };

      pool.execute = async (sql) => {
        if (sql.includes('SELECT id, title, file_url FROM notes')) {
          return [[{ id: 206, title: 'Note with R2 failure', file_url: 'notes/important_file.pdf' }]];
        }
        if (sql.includes('DELETE FROM notes')) {
          dbDeleted = true;
          return [{ affectedRows: 1 }];
        }
        return [[]];
      };

      try {
        const req = {
          params: { id: '206' },
          user: { id: 1 }
        };
        const res = createMockRes();

        await deleteNote(req, res);

        assert.equal(res.statusCode, 502);
        assert.equal(res.body.success, false);
        assert.equal(dbDeleted, false, 'Database record must NOT be deleted when R2 deletion fails');
        assert.match(res.body.message, /Failed to delete attachment from Cloudflare R2/);
      } finally {
        pool.execute = originalExecute;
        storageSingleton.deleteAttachment = originalDelete;
      }
    });
  });
});
