import { describe, it, expect, afterAll } from 'vitest';
import { readdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { saveDataUri } from './fileStorage.js';
import { HttpError } from './errors.js';

const UPLOAD_DIR = resolve(import.meta.dirname, '../../uploads');

describe('fileStorage.saveDataUri', () => {
  const created: string[] = [];

  afterAll(() => {
    // best-effort cleanup of files this test wrote
    for (const url of created) {
      try { rmSync(resolve(UPLOAD_DIR, url.replace('/uploads/', ''))); } catch { /* ignore */ }
    }
  });

  it('passes plain URLs through unchanged', () => {
    expect(saveDataUri('https://cdn.example.com/a.jpg')).toBe('https://cdn.example.com/a.jpg');
  });

  it('saves an allowed image type and returns a safe /uploads path', () => {
    const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    const url = saveDataUri(`data:image/png;base64,${png}`, 'test');
    created.push(url);
    expect(url).toMatch(/^\/uploads\/test_[\w-]+\.png$/);
  });

  it('rejects SVG (stored-XSS vector)', () => {
    const svg = Buffer.from('<svg onload="alert(1)"></svg>').toString('base64');
    expect(() => saveDataUri(`data:image/svg+xml;base64,${svg}`)).toThrow(HttpError);
  });

  it('rejects HTML smuggled as a data URI', () => {
    const html = Buffer.from('<script>alert(1)</script>').toString('base64');
    expect(() => saveDataUri(`data:text/html;base64,${html}`)).toThrow(/unsupported-image-type/);
  });

  it('rejects a malformed data URI', () => {
    expect(() => saveDataUri('data:image/png;base64')).toThrow(HttpError);
  });

  it('never writes a non-image extension to the uploads directory', () => {
    try { saveDataUri('data:application/javascript;base64,YWxlcnQoMSk='); } catch { /* expected */ }
    const files = readdirSync(UPLOAD_DIR);
    expect(files.some((f) => f.endsWith('.html') || f.endsWith('.js') || f.endsWith('.svg'))).toBe(false);
  });
});
