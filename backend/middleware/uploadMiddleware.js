import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import storageAdapter from '../config/storage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadDir = path.join(__dirname, '..', 'uploads', 'notes');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure disk storage for local fallback
const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const baseName = path.basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .substring(0, 50);
    const uniqueSuffix = `${Date.now()}_${Math.round(Math.random() * 1e6)}`;
    cb(null, `${baseName}_${uniqueSuffix}${ext}`);
  }
});

// Configure memory storage for Cloudflare R2
const memStorage = multer.memoryStorage();

// Dynamic storage engine: uses memory storage when R2 is active, disk storage for local fallback
class DynamicStorageEngine {
  _handleFile(req, file, cb) {
    const engine = storageAdapter.isConfigured() ? memStorage : diskStorage;
    engine._handleFile(req, file, cb);
  }
  _removeFile(req, file, cb) {
    const engine = storageAdapter.isConfigured() ? memStorage : diskStorage;
    engine._removeFile(req, file, cb);
  }
}

const storage = new DynamicStorageEngine();

// Allowed MIME types and extensions
const allowedExtensions = ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.txt', '.png', '.jpg', '.jpeg', '.webp', '.gif'];
const allowedMimeTypes = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif'
];

const maxFileSizeMB = parseInt(process.env.MAX_NOTE_FILE_SIZE_MB || '25', 10);
const maxFileSize = maxFileSizeMB * 1024 * 1024;

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const mimeType = file.mimetype;

  if (allowedExtensions.includes(ext) && allowedMimeTypes.includes(mimeType)) {
    cb(null, true);
  } else {
    cb(new Error(`File type "${ext || mimeType}" is not supported. Allowed formats: PDF, DOC/DOCX, PPT/PPTX, TXT, PNG, JPG, WEBP, GIF.`), false);
  }
};

export const noteUpload = multer({
  storage,
  limits: { fileSize: maxFileSize },
  fileFilter
});

// Error handling middleware for Multer
export const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: `File size exceeds the allowed limit of ${maxFileSizeMB}MB.`
      });
    }
    return res.status(400).json({
      success: false,
      message: `Upload error: ${err.message}`
    });
  } else if (err) {
    return res.status(400).json({
      success: false,
      message: err.message || 'File upload failed.'
    });
  }
  next();
};

/**
 * Verify file signatures and byte structures for supported formats
 * Accepts either a Buffer (memory storage) or a string file path (disk storage).
 */
export const verifyFileSignature = (fileOrBuffer, originalname, mimetype) => {
  const ext = path.extname(originalname).toLowerCase();

  let header;
  if (Buffer.isBuffer(fileOrBuffer)) {
    if (fileOrBuffer.length === 0) {
      return false;
    }
    header = fileOrBuffer.subarray(0, Math.min(8192, fileOrBuffer.length));
  } else if (typeof fileOrBuffer === 'string') {
    const bufferSize = 8192;
    const buffer = Buffer.alloc(bufferSize);
    let bytesRead = 0;

    try {
      const fd = fs.openSync(fileOrBuffer, 'r');
      try {
        bytesRead = fs.readSync(fd, buffer, 0, bufferSize, 0);
      } finally {
        fs.closeSync(fd);
      }
    } catch (err) {
      return false;
    }

    if (bytesRead === 0) {
      return false;
    }
    header = buffer.subarray(0, bytesRead);
  } else {
    return false;
  }

  const matches = (sig, offset = 0) => {
    if (header.length < offset + sig.length) return false;
    for (let i = 0; i < sig.length; i++) {
      if (header[offset + i] !== sig[i]) return false;
    }
    return true;
  };

  // 1. PDF: %PDF-
  if (ext === '.pdf') {
    if (mimetype !== 'application/pdf') return false;
    return matches([0x25, 0x50, 0x44, 0x46, 0x2d]);
  }

  // 2. PNG: \x89PNG\r\n\x1a\n
  if (ext === '.png') {
    if (mimetype !== 'image/png') return false;
    return matches([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  }

  // 3. JPG / JPEG: \xFF\xD8\xFF
  if (ext === '.jpg' || ext === '.jpeg') {
    if (mimetype !== 'image/jpeg') return false;
    return matches([0xff, 0xd8, 0xff]);
  }

  // 4. GIF: GIF87a or GIF89a
  if (ext === '.gif') {
    if (mimetype !== 'image/gif') return false;
    const isGif87 = matches([0x47, 0x49, 0x46, 0x38, 0x37, 0x61]);
    const isGif89 = matches([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
    return isGif87 || isGif89;
  }

  // 5. WEBP: RIFF....WEBP
  if (ext === '.webp') {
    if (mimetype !== 'image/webp') return false;
    const isRiff = matches([0x52, 0x49, 0x46, 0x46], 0);
    const isWebp = matches([0x57, 0x45, 0x42, 0x50], 8);
    return isRiff && isWebp;
  }

  // 6. DOC / PPT (Legacy OLE compound binary format)
  if (ext === '.doc') {
    if (mimetype !== 'application/msword') return false;
    return matches([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  }
  if (ext === '.ppt') {
    if (mimetype !== 'application/vnd.ms-powerpoint') return false;
    return matches([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  }

  // 7. DOCX / PPTX (Office OpenXML container formats)
  if (ext === '.docx') {
    if (mimetype !== 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return false;
    if (!matches([0x50, 0x4b, 0x03, 0x04])) return false;
    const headerStr = header.toString('binary');
    return headerStr.includes('word/') || headerStr.includes('[Content_Types].xml');
  }

  if (ext === '.pptx') {

    
    if (mimetype !== 'application/vnd.openxmlformats-officedocument.presentationml.presentation') return false;
    if (!matches([0x50, 0x4b, 0x03, 0x04])) return false;
    const headerStr = header.toString('binary');
    return headerStr.includes('ppt/') || headerStr.includes('[Content_Types].xml');
  }

  // 8. TXT (.txt, text/plain)
  if (ext === '.txt') {
    if (mimetype !== 'text/plain') return false;
    // Reject null bytes (0x00)
    for (let i = 0; i < header.length; i++) {
      if (header[i] === 0x00) return false;
    }
    // Reject binary/executable headers and scripts
    if (matches([0x4d, 0x5a])) return false; // MZ
    if (matches([0x7f, 0x45, 0x4c, 0x46])) return false; // ELF
    if (matches([0x25, 0x50, 0x44, 0x46])) return false; // %PDF
    if (matches([0x50, 0x4b, 0x03, 0x04])) return false; // PK
    if (matches([0x89, 0x50, 0x4e, 0x47])) return false; // PNG
    if (matches([0x47, 0x49, 0x46, 0x38])) return false; // GIF
    const str = header.toString('utf8');
    if (str.startsWith('<?php') || str.startsWith('#!/')) return false;
    return true;
  }

  return false;
};

/**
 * Middleware to validate saved file content against extension and MIME type.
 * Cleans up temporary file if validation fails (when using disk storage).
 */
export const validateFileContent = (req, res, next) => {
  if (!req.file) {
    return next();
  }

  const fileTarget = req.file.buffer || req.file.path;
  const { originalname, mimetype } = req.file;

  try {
    const isValid = verifyFileSignature(fileTarget, originalname, mimetype);
    if (!isValid) {
      if (req.file.path && fs.existsSync(req.file.path)) {
        try { fs.unlinkSync(req.file.path); } catch (_) {}
      }
      req.file = undefined;
      return res.status(400).json({
        success: false,
        message: 'Invalid file content or format mismatch.'
      });
    }
  } catch (err) {
    if (req.file.path && fs.existsSync(req.file.path)) {
      try { fs.unlinkSync(req.file.path); } catch (_) {}
    }
    req.file = undefined;
    return res.status(400).json({
      success: false,
      message: 'File validation error.'
    });
  }

  next();
};

export default noteUpload;
