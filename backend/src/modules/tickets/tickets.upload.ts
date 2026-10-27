import multer from 'multer';
import type { RequestHandler } from 'express';

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

export interface EvidenceFile {
  name: string;
  mimeType: string;
  sizeBytes: number;
  data: Buffer;
}

/** Verify the file signature as well as the declared MIME type. */
export function validateEvidence(
  file: Pick<
    Express.Multer.File,
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

  const b = file.buffer;

  const matches =
    (file.mimetype === 'image/png' &&
      b.subarray(0, 8).equals(
        Buffer.from('89504e470d0a1a0a', 'hex'),
      )) ||
    (file.mimetype === 'image/jpeg' &&
      b[0] === 0xff &&
      b[1] === 0xd8 &&
      b[2] === 0xff) ||
    (file.mimetype === 'image/gif' &&
      /^GIF8[79]a$/.test(
        b.subarray(0, 6).toString('ascii'),
      )) ||
    (file.mimetype === 'image/webp' &&
      b.subarray(0, 4).toString() === 'RIFF' &&
      b.subarray(8, 12).toString() === 'WEBP') ||
    (file.mimetype === 'application/pdf' &&
      b.subarray(0, 5).toString() === '%PDF-');

  if (!matches) {
    throw new HttpError(
      400,
      'Attachment content does not match an allowed image or PDF.',
      'INVALID_ATTACHMENT',
    );
  }

  const name =
    Array.from(
      file.originalname.replace(/.*[/\\]/, ''),
    )
      .filter(
        (c) =>
          c.charCodeAt(0) >= 32 &&
          c.charCodeAt(0) !== 127,
      )
      .slice(0, 180)
      .join('') || 'attachment';

  return {
    name,
    mimeType: file.mimetype,
    sizeBytes: file.size,
    data: b,
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
  fileFilter: (_req, file, cb) => {
    if (
      (ATTACHMENT_TYPES as readonly string[]).includes(
        file.mimetype,
      )
    ) {
      cb(null, true);
    } else {
      cb(
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
      return next(
        new HttpError(
          400,
          error.code === 'LIMIT_FILE_SIZE'
            ? 'Each attachment must be 5 MB or smaller.'
            : 'Upload up to 3 files and check the form fields.',
          'INVALID_ATTACHMENT',
        ),
      );
    }

    if (error) {
      return next(error);
    }

    try {
      res.locals.ticketFiles = (
        Array.isArray(req.files) ? req.files : []
      ).map(validateEvidence);

      next();
    } catch (validationError) {
      next(validationError);
    }
  });
};
