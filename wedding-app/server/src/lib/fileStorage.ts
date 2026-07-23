/**
 * File storage abstraction — saves uploaded files to disk instead of
 * storing base64 data URIs in SQLite.
 *
 * In production, swap this for S3/R2 by changing the implementation
 * while keeping the same interface.
 */
import { writeFileSync, mkdirSync, existsSync, unlinkSync } from 'node:fs';
import { resolve, join, basename } from 'node:path';
import { uuid } from './crypto.js';
import { BadRequest } from './errors.js';

// Docker stores this under its persistent /data volume. Keep the package-local
// path as the development default so existing local installs remain compatible.
const UPLOAD_DIR = process.env.WEDDING_UPLOADS_PATH
  ? resolve(process.env.WEDDING_UPLOADS_PATH)
  : resolve(import.meta.dirname, '../../uploads');

// Ensure upload directory exists
if (!existsSync(UPLOAD_DIR)) {
  mkdirSync(UPLOAD_DIR, { recursive: true });
}

/**
 * Strict allowlist of accepted image MIME types and their canonical file
 * extensions. SVG is intentionally EXCLUDED: SVGs can embed <script> and are
 * a stored-XSS vector when served from the same origin. Anything not in this
 * map is rejected outright.
 */
const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
};

// 8 MB hard cap on a single decoded upload (data URIs are ~33% larger encoded).
const MAX_DECODED_BYTES = 8 * 1024 * 1024;

/**
 * Save a base64 image data URI to disk and return a URL path.
 * Returns the original string if it's already a plain URL (not a data URI).
 *
 * Throws BadRequest for non-image / disallowed MIME types so a malicious
 * authenticated user cannot smuggle an HTML/SVG/JS file into the publicly
 * served /uploads/ directory.
 */
export function saveDataUri(dataUri: string, prefix = 'img'): string {
  // If it's not a data URI, return as-is (assumed to already be a hosted URL).
  if (!dataUri.startsWith('data:')) return dataUri;

  const match = dataUri.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw BadRequest('invalid-image', 'Expected a base64-encoded image data URI');

  const [, rawMime, base64Data] = match;
  const mimeType = rawMime.trim().toLowerCase();
  const ext = ALLOWED_IMAGE_TYPES[mimeType];
  if (!ext) {
    throw BadRequest('unsupported-image-type', `Unsupported image type: ${mimeType}`);
  }

  const buffer = Buffer.from(base64Data, 'base64');
  if (buffer.length === 0) throw BadRequest('invalid-image', 'Empty image payload');
  if (buffer.length > MAX_DECODED_BYTES) {
    throw BadRequest('image-too-large', 'Image exceeds the 8 MB limit');
  }

  // Filename is server-generated; extension comes only from the allowlist.
  const filename = `${prefix}_${uuid()}.${ext}`;
  writeFileSync(join(UPLOAD_DIR, filename), buffer);

  return `/uploads/${filename}`;
}

/**
 * Delete a file from disk (if it's a local upload path). Uses basename() so a
 * crafted path like "/uploads/../../etc/passwd" can never escape UPLOAD_DIR.
 */
export function saveDocumentDataUri(dataUri: string, prefix = 'doc'): string {
  if (!dataUri.startsWith('data:')) return dataUri;
  const match = dataUri.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw BadRequest('invalid-document', 'Expected a base64-encoded data URI');
  const mimeType = match[1].trim().toLowerCase();
  const extMap: Record<string, string> = {
    'application/pdf': 'pdf',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  };
  const ext = extMap[mimeType];
  if (!ext) throw BadRequest('unsupported-document-type', `Unsupported document type: ${mimeType}`);
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length === 0) throw BadRequest('invalid-document', 'Empty document payload');
  if (buffer.length > MAX_DECODED_BYTES) throw BadRequest('document-too-large', 'Document exceeds the 8 MB limit');
  const filename = `${prefix}_${uuid()}.${ext}`;
  writeFileSync(join(UPLOAD_DIR, filename), buffer);
  return `/uploads/${filename}`;
}

export function deleteFile(urlPath: string): void {
  if (!urlPath.startsWith('/uploads/')) return;
  const safeName = basename(urlPath); // strips any directory traversal segments
  const filePath = join(UPLOAD_DIR, safeName);
  try { unlinkSync(filePath); } catch { /* file may not exist */ }
}
