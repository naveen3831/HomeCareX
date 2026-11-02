import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { MAX_KYC_FILE_BYTES, readKycDocument, saveKycDocument } from './kyc-storage';

const dataUrl = (mime: string, bytes: Buffer) => `data:${mime};base64,${bytes.toString('base64')}`;
const PDF = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.from('hello')]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

test.before(async () => {
  process.env.KYC_STORAGE_DIR = await fs.mkdtemp(path.join(os.tmpdir(), 'kyc-'));
});

test('saves a PDF and reads the same bytes back', async () => {
  const saved = await saveKycDocument(dataUrl('application/pdf', PDF), 'ID proof');
  assert.equal(saved.mimeType, 'application/pdf');
  assert.match(saved.storageKey, /^[0-9a-f-]{36}\.pdf$/);
  assert.deepEqual(await readKycDocument(saved.storageKey), PDF);
});

test('saves a PNG', async () => {
  const saved = await saveKycDocument(dataUrl('image/png', PNG), 'Address proof');
  assert.match(saved.storageKey, /\.png$/);
});

test('rejects the old placeholder string the register form used to send', async () => {
  await assert.rejects(() => saveKycDocument('doc_id_1730000000_aadhaar.pdf', 'ID proof'), /upload a PDF, JPG or PNG/);
});

test('rejects unsupported types', async () => {
  await assert.rejects(() => saveKycDocument(dataUrl('text/html', Buffer.from('<script>')), 'ID proof'), /only PDF, JPG and PNG/);
});

test('rejects a file whose bytes do not match the declared type', async () => {
  await assert.rejects(() => saveKycDocument(dataUrl('application/pdf', Buffer.from('not a pdf at all')), 'ID proof'), /does not match/);
});

test('rejects files over 5MB', async () => {
  const big = Buffer.concat([Buffer.from('%PDF'), Buffer.alloc(MAX_KYC_FILE_BYTES)]);
  await assert.rejects(() => saveKycDocument(dataUrl('application/pdf', big), 'ID proof'), /under 5MB/);
});

test('readKycDocument refuses path traversal', async () => {
  await assert.rejects(() => readKycDocument('../../etc/passwd'), /not found/i);
});
