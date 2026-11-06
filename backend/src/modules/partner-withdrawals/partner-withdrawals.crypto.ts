import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { environmentConfig } from '../../config/environment';

/**
 * Bank account numbers are stored encrypted (AES-256-GCM). Only an admin who is about to make the
 * transfer ever sees one in clear text. Partners only ever get the last 4 digits back.
 */
const key = (): Buffer => {
  const secret = environmentConfig.bankDataKey;
  if (!secret) throw new Error('BANK_DATA_KEY (or JWT_SECRET in development) must be set to store bank details');
  return createHash('sha256').update(secret).digest();
};

export const encryptSecret = (plain: string): string => {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [iv.toString('base64'), cipher.getAuthTag().toString('base64'), enc.toString('base64')].join('.');
};

export const decryptSecret = (payload: string): string => {
  const [iv, tag, data] = payload.split('.');
  if (!iv || !tag || !data) throw new Error('Malformed encrypted value');
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
};
