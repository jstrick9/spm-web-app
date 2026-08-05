/** Local file storage with explicit public/private namespaces. */
import { writeFileSync, mkdirSync, existsSync, unlinkSync } from 'node:fs';
import { resolve, join, basename } from 'node:path';
import { uuid } from './crypto.js';
import { BadRequest } from './errors.js';

const UPLOAD_DIR = process.env.WEDDING_UPLOADS_PATH ? resolve(process.env.WEDDING_UPLOADS_PATH) : resolve(import.meta.dirname, '../../uploads');
const PUBLIC_DIR = join(UPLOAD_DIR, 'public');
const PRIVATE_DIR = join(UPLOAD_DIR, 'private');
for (const dir of [PUBLIC_DIR, PRIVATE_DIR]) if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

const IMAGE_TYPES: Record<string, string> = { 'image/jpeg':'jpg','image/jpg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif','image/avif':'avif','image/bmp':'bmp' };
const DOCUMENT_TYPES: Record<string, string> = { 'application/pdf':'pdf','image/jpeg':'jpg','image/jpg':'jpg','image/png':'png','image/webp':'webp' };
const MAX_DECODED_BYTES = 8 * 1024 * 1024;

/**
 * Magic-byte sniffing: the declared MIME type must match the file's actual
 * signature. This stops HTML/SVG/script payloads being smuggled through with
 * an innocent `image/png` or `application/pdf` declaration — the bytes are
 * later served from /uploads with the declared content type.
 */
function sniff(declaredType: string, buffer: Buffer): boolean {
  const ascii = (off: number, len: number) => buffer.subarray(off, off + len).toString('ascii');
  switch (declaredType) {
    case 'image/jpeg': return buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xd8;
    case 'image/png': return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    case 'image/gif': return buffer.length >= 6 && (ascii(0, 6) === 'GIF87a' || ascii(0, 6) === 'GIF89a');
    case 'image/webp': return buffer.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP';
    case 'image/bmp': return buffer.length >= 2 && buffer[0] === 0x42 && buffer[1] === 0x4d;
    case 'image/avif': return buffer.length >= 12 && ascii(4, 4) === 'ftyp' && ['avif', 'avis', 'mif1', 'msf1'].includes(ascii(8, 4));
    case 'application/pdf': return buffer.length >= 5 && ascii(0, 5) === '%PDF-';
    default: return true; // not in the allowlist anyway; decode() rejects earlier
  }
}

function decode(dataUri: string, types: Record<string,string>, kind: string): { buffer: Buffer; ext: string } {
  const match = dataUri.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw BadRequest(`invalid-${kind}`, `Expected a base64-encoded ${kind} data URI`);
  const declared = match[1].trim().toLowerCase();
  const ext = types[declared];
  if (!ext) throw BadRequest(`unsupported-${kind}-type`, `Unsupported ${kind} type`);
  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length) throw BadRequest(`invalid-${kind}`, `Empty ${kind} payload`);
  if (buffer.length > MAX_DECODED_BYTES) throw BadRequest(`${kind}-too-large`, `${kind} exceeds the 8 MB limit`);
  // Content sniffing: declared type must match the actual magic bytes.
  if (!sniff(declared.replace('image/jpg', 'image/jpeg'), buffer)) {
    throw BadRequest(`invalid-${kind}-content`, `The uploaded file's contents do not match its declared ${kind} type`);
  }
  return { buffer, ext };
}
function save(dataUri: string, prefix: string, dir: string, urlPrefix: string, types: Record<string,string>, kind: string): string {
  if (!dataUri.startsWith('data:')) return dataUri;
  const { buffer, ext } = decode(dataUri, types, kind);
  const filename = `${prefix}_${uuid()}.${ext}`;
  writeFileSync(join(dir, filename), buffer);
  return `${urlPrefix}/${filename}`;
}
/** Guest-visible images only. SVG is deliberately excluded. */
export function saveDataUri(dataUri: string, prefix = 'img'): string { return save(dataUri, prefix, PUBLIC_DIR, '/uploads/public', IMAGE_TYPES, 'image'); }
/** Non-public images such as operational variance evidence. */
export function savePrivateImageDataUri(dataUri: string, prefix = 'img'): string { return save(dataUri, prefix, PRIVATE_DIR, '/uploads/private', IMAGE_TYPES, 'image'); }
/** Public reference plans are served only through the venue underlay workflow. */
export function savePublicDocumentDataUri(dataUri: string, prefix = 'reference'): string { return save(dataUri, prefix, PUBLIC_DIR, '/uploads/public', { ...IMAGE_TYPES, 'application/pdf': 'pdf' }, 'reference'); }
/** Contracts, COIs and couple documents are always private. */
export function saveDocumentDataUri(dataUri: string, prefix = 'doc'): string { return save(dataUri, prefix, PRIVATE_DIR, '/uploads/private', DOCUMENT_TYPES, 'document'); }
export function publicFilePath(urlPath: string): string | null { if (!urlPath.startsWith('/uploads/public/')) return null; return join(PUBLIC_DIR, basename(urlPath)); }
export function privateFilePath(urlPath: string): string | null { if (!urlPath.startsWith('/uploads/private/')) return null; return join(PRIVATE_DIR, basename(urlPath)); }
export function deleteFile(urlPath: string): void { const dir = urlPath.startsWith('/uploads/private/') ? PRIVATE_DIR : urlPath.startsWith('/uploads/public/') ? PUBLIC_DIR : null; if (!dir) return; try { unlinkSync(join(dir, basename(urlPath))); } catch {} }
