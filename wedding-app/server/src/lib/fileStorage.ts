/**
 * File storage abstraction — saves uploaded files to disk instead of
 * storing base64 data URIs in SQLite.
 *
 * In production, swap this for S3/R2 by changing the implementation
 * while keeping the same interface.
 */
import { writeFileSync, mkdirSync, existsSync, unlinkSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { uuid } from './crypto.js';

const UPLOAD_DIR = resolve(import.meta.dirname, '../../uploads');

// Ensure upload directory exists
if (!existsSync(UPLOAD_DIR)) {
  mkdirSync(UPLOAD_DIR, { recursive: true });
}

/**
 * Save a data URI to disk and return a URL path.
 * Returns the original string if it's not a data URI (already a URL).
 */
export function saveDataUri(dataUri: string, prefix = 'img'): string {
  // If it's not a data URI, return as-is
  if (!dataUri.startsWith('data:')) return dataUri;

  // Parse the data URI
  const match = dataUri.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return dataUri;

  const [, mimeType, base64Data] = match;
  const ext = mimeType.split('/')[1] ?? 'bin';
  const filename = `${prefix}_${uuid()}.${ext}`;
  const filePath = join(UPLOAD_DIR, filename);

  writeFileSync(filePath, Buffer.from(base64Data, 'base64'));

  return `/uploads/${filename}`;
}

/**
 * Delete a file from disk (if it's a local upload path).
 */
export function deleteFile(urlPath: string): void {
  if (!urlPath.startsWith('/uploads/')) return;
  const filePath = join(UPLOAD_DIR, urlPath.replace('/uploads/', ''));
  try { unlinkSync(filePath); } catch { /* file may not exist */ }
}
