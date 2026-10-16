export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_FILES = 3;
export const FILE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
];
export const FILE_ACCEPT = FILE_TYPES.join(',');
export function validateFiles(files: File[]): string | null {
  if (files.length > MAX_FILES) return 'Choose up to 3 attachments.';
  for (const file of files) {
    if (!FILE_TYPES.includes(file.type))
      return `${file.name}: use JPG, PNG, GIF, WebP or PDF.`;
    if (!file.size || file.size > MAX_FILE_BYTES)
      return `${file.name}: the file must be between 1 byte and 5 MB.`;
  }
  return null;
}
