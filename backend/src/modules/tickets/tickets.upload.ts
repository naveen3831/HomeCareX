import type { RequestHandler } from 'express';
import multer from 'multer';

import { HttpError } from '../auth/auth.types';

export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
export const MAX_ATTACHMENTS = 3;

export const ATTACHMENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
] as const;

type UploadedFile = Express.Multer.File;

export interface EvidenceFile {
  name: string;
  mimeType: string;
  sizeBytes: number;
  data: Buffer;
}

const invalidUpload = (
  message = 'Upload up to 3 files and check the form fields.',
) => new HttpError(400, message, 'INVALID_ATTACHMENT');

/** Verify the file signature as well as the declared MIME type. */
export function validateEvidence(
  file: Pick<
    UploadedFile,
    'originalname' | 'mimetype' | 'buffer' | 'size'
  >,
): EvidenceFile {
  if (
    !file.size ||
    file.size > MAX_ATTACHMENT_BYTES ||
    file.buffer.length !== file.size
  ) {
    throw new HttpError(
      400,
      'Each attachment must be between 1 byte and 5 MB.',
      'INVALID_ATTACHMENT',
    );
  }

  const buffer = file.buffer;

  const matches =
    (file.mimetype === 'image/png' &&
      buffer
        .subarray(0, 8)
        .equals(Buffer.from('89504e470d0a1a0a', 'hex'))) ||
    (file.mimetype === 'image/jpeg' &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff) ||
    (file.mimetype === 'image/gif' &&
      /^GIF8[79]a$/.test(
        buffer.subarray(0, 6).toString('ascii'),
      )) ||
    (file.mimetype === 'image/webp' &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP') ||
    (file.mimetype === 'application/pdf' &&
      buffer.subarray(0, 5).toString('ascii') === '%PDF-');

  if (!matches) {
    throw new HttpError(
      400,
      'Attachment content does not match an allowed image or PDF.',
      'INVALID_ATTACHMENT',
    );
  }

  // Remove directory components, control characters and excessively long names.
  const name =
    Array.from(file.originalname.replace(/.*[/\\]/, ''))
      .filter(
        (character) =>
          character.charCodeAt(0) >= 32 &&
          character.charCodeAt(0) !== 127,
      )
      .slice(0, 180)
      .join('') || 'attachment';

  return {
    name,
    mimeType: file.mimetype,
    sizeBytes: file.size,
    data: buffer,
  };
}

const receive = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_ATTACHMENT_BYTES,
    files: MAX_ATTACHMENTS,
    fields: 8,
    fieldSize: 20_000,
    parts: 12,
  },
  fileFilter: (_req, file, callback) => {
    if (
      (ATTACHMENT_TYPES as readonly string[]).includes(file.mimetype)
    ) {
      callback(null, true);
    } else {
      callback(
        new HttpError(
          400,
          'Use JPG, PNG, GIF, WebP or PDF files only.',
          'INVALID_ATTACHMENT',
        ),
      );
    }
  },
}).array('attachments', MAX_ATTACHMENTS);

/**
 * Applied only to authenticated ticket mutations.
 * Supports JSON requests without files and multipart requests with files.
 * Uploaded files are kept in memory and validated before reaching the controller.
 */
export const receiveTicketFiles: RequestHandler = (
  req,
  res,
  next,
) => {
  if (req.is('application/json')) {
    res.locals.ticketFiles = [];
    return next();
  }

  receive(req, res, (error: unknown) => {
    if (error instanceof multer.MulterError) {
      next(
        new HttpError(
          400,
          error.code === 'LIMIT_FILE_SIZE'
            ? 'Each attachment must be 5 MB or smaller.'
            : 'Upload up to 3 files and check the form fields.',
          'INVALID_ATTACHMENT',
        ),
      );
      return;
    }

    if (error) {
      return next(error);
    }

    try {
      const files = Array.isArray(req.files) ? req.files : [];

      res.locals.ticketFiles = files.map((file) =>
        validateEvidence(file as UploadedFile),
      );

      return next();
    } catch (error) {
      return next(error);
    }
  });
};