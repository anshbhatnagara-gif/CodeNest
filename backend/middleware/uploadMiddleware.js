import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadDir = path.join(__dirname, '..', 'uploads', 'notes');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure disk storage
const storage = multer.diskStorage({
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

  if (allowedExtensions.includes(ext) || allowedMimeTypes.includes(mimeType)) {
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

export default noteUpload;
