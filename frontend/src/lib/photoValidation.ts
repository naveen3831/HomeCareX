/** Same limits as the server (backend/src/modules/partner-jobs/jobPhotoStorage.ts). */
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

const JPEG = [0xff, 0xd8, 0xff];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const startsWith = (bytes: Uint8Array, sig: number[]): boolean =>
  bytes.length >= sig.length && sig.every((b, i) => bytes[i] === b);

function readHead(file: File): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(new Error('Could not read the photo'));
    reader.readAsArrayBuffer(file.slice(0, 8));
  });
}

/**
 * Returns a message when the photo cannot be used, or null when it is fine.
 * Checks the real bytes (not just the file name or declared type), because the server does the same.
 */
export async function validatePhoto(file: File): Promise<string | null> {
  if (file.size === 0) return 'This photo is empty. Please take it again.';
  if (file.size > MAX_PHOTO_BYTES) return 'Photo must be 5 MB or smaller.';
  try {
    const head = await readHead(file);
    if (!startsWith(head, JPEG) && !startsWith(head, PNG)) return 'Photo must be a JPG or PNG image.';
  } catch {
    return 'Could not read this photo. Please try another one.';
  }
  return null;
}
