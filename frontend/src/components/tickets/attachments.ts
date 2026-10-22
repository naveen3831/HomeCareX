export const MAX_ATTACHMENTS = 3;
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024; // 5 MB each
export const ALLOWED_ATTACHMENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;

export const ATTACHMENT_ACCEPT = ALLOWED_ATTACHMENT_TYPES.join(",");

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isAllowedType(type: string): boolean {
  return (ALLOWED_ATTACHMENT_TYPES as readonly string[]).includes(type);
}

/**
 * Validates newly picked files against type, size and the total count.
 * Returns the files that passed and one message per rejected file.
 */
export function validateAttachments(
  existing: File[],
  incoming: File[]
): { accepted: File[]; errors: string[] } {
  const accepted: File[] = [];
  const errors: string[] = [];

  for (const file of incoming) {
    if (existing.length + accepted.length >= MAX_ATTACHMENTS) {
      errors.push(`You can attach up to ${MAX_ATTACHMENTS} files.`);
      break;
    }
    if (!isAllowedType(file.type)) {
      errors.push(`${file.name}: only JPG, PNG, WebP or PDF files are allowed.`);
      continue;
    }
    if (file.size === 0) {
      errors.push(`${file.name}: the file is empty.`);
      continue;
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      errors.push(
        `${file.name}: larger than ${formatBytes(MAX_ATTACHMENT_BYTES)}.`
      );
      continue;
    }
    accepted.push(file);
  }

  return { accepted, errors };
}
