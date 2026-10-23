import { describe, expect, it } from 'vitest';
import { MAX_PHOTO_BYTES, validatePhoto } from '@/lib/photoValidation';

const PNG_HEAD = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPG_HEAD = [0xff, 0xd8, 0xff, 0xe0];
const file = (head: number[], size: number, name = 'p.png', type = 'image/png'): File => {
  const bytes = new Uint8Array(size);
  bytes.set(head.slice(0, size));
  return new File([bytes], name, { type });
};

describe('validatePhoto', () => {
  it('accepts a PNG and a JPG', async () => {
    expect(await validatePhoto(file(PNG_HEAD, 100))).toBeNull();
    expect(await validatePhoto(file(JPG_HEAD, 100, 'p.jpg', 'image/jpeg'))).toBeNull();
  });

  it('accepts exactly 5 MB and rejects one byte more', async () => {
    expect(await validatePhoto(file(PNG_HEAD, MAX_PHOTO_BYTES))).toBeNull();
    expect(await validatePhoto(file(PNG_HEAD, MAX_PHOTO_BYTES + 1))).toMatch(/5 MB/);
  });

  it('rejects an empty file', async () => {
    expect(await validatePhoto(new File([], 'p.png', { type: 'image/png' }))).toMatch(/empty/i);
  });

  it('rejects a file that only claims to be an image (checks the real bytes)', async () => {
    const fake = new File(['<script>alert(1)</script>'], 'p.png', { type: 'image/png' });
    expect(await validatePhoto(fake)).toMatch(/JPG or PNG/);
  });

  it('rejects other image types such as GIF', async () => {
    const gif = file([0x47, 0x49, 0x46, 0x38, 0x39, 0x61], 100, 'p.gif', 'image/gif');
    expect(await validatePhoto(gif)).toMatch(/JPG or PNG/);
  });
});
