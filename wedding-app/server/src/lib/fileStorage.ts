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

function decode(dataUri: string, types: Record<string,string>, kind: string): { buffer: Buffer; ext: string } {
  const match = dataUri.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw BadRequest(`invalid-${kind}`, `Expected a base64-encoded ${kind} data URI`);
  const ext = types[match[1].trim().toLowerCase()];
  if (!ext) throw BadRequest(`unsupported-${kind}-type`, `Unsupported ${kind} type`);
  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length) throw BadRequest(`invalid-${kind}`, `Empty ${kind} payload`);
  if (buffer.length > MAX_DECODED_BYTES) throw BadRequest(`${kind}-too-large`, `${kind} exceeds the 8 MB limit`);
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
