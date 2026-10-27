import type { Request, RequestHandler } from "express";
import { HttpError } from "../auth/auth.types";
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
    UploadedFile,
    "originalname" | "mimetype" | "buffer" | "size"
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
const invalidUpload = (message = "Upload up to 3 files and check the form fields.") =>
  new HttpError(400, message, "INVALID_ATTACHMENT");

interface ParsedForm {
  files: UploadedFile[];
  fields: Record<string, string>;
}

async function readMultipart(req: Request): Promise<ParsedForm> {
  const contentType = req.get("content-type") ?? "";
  const boundaryMatch = /^multipart\/form-data\s*;.*?boundary=(?:"([^"]+)"|([^;\s]+))/i.exec(
    contentType,
  );
  if (!boundaryMatch) throw invalidUpload("A multipart form is required.");
  const boundary = boundaryMatch[1] ?? boundaryMatch[2];
  if (!boundary || boundary.length > 70) throw invalidUpload();

  // Maximum file data, form fields, and a bounded amount of multipart overhead.
  const maxBodyBytes = MAX_ATTACHMENT_BYTES * MAX_ATTACHMENTS + 500_000;
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  for await (const chunk of req) {
    const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += data.length;
    if (totalBytes > maxBodyBytes) throw invalidUpload();
    chunks.push(data);
  }

  const body = Buffer.concat(chunks, totalBytes).toString("latin1");
  const sections = body.split(`--${boundary}`);
  if (sections.length < 2 || sections[0] !== "") throw invalidUpload();
  const ending = sections.pop();
  if (ending !== "--" && ending !== "--\r\n") throw invalidUpload();
  const parts = sections.slice(1);
  if (parts.length > 12) throw invalidUpload();

  const files: UploadedFile[] = [];
  const fields: Record<string, string> = {};
  let fieldCount = 0;
  for (const section of parts) {
    const part = section.startsWith("\r\n") ? section.slice(2) : section;
    const headerEnd = part.indexOf("\r\n\r\n");
    if (headerEnd < 0 || !part.endsWith("\r\n")) throw invalidUpload();
    const headers = part.slice(0, headerEnd);
    const payload = part.slice(headerEnd + 4, -2);
    const disposition = /^content-disposition:\s*form-data\s*;(.*)$/im.exec(headers)?.[1];
    const fieldName = /(?:^|;)\s*name="([^"]*)"/i.exec(disposition ?? "")?.[1];
    if (fieldName === undefined) throw invalidUpload();
    const filename = /(?:^|;)\s*filename="([^"]*)"/i.exec(disposition ?? "")?.[1];

    if (filename !== undefined) {
      if (fieldName !== "attachments" || files.length >= MAX_ATTACHMENTS)
        throw invalidUpload();
      const buffer = Buffer.from(payload, "latin1");
      if (buffer.length > MAX_ATTACHMENT_BYTES) {
        throw invalidUpload("Each attachment must be 5 MB or smaller.");
      }
      const mimetype = /^content-type:\s*([^\r\n]+)/im.exec(headers)?.[1]?.trim() ?? "";
      if (!(ATTACHMENT_TYPES as readonly string[]).includes(mimetype)) {
        throw invalidUpload("Use JPG, PNG, GIF, WebP or PDF files only.");
      }
      files.push({ originalname: filename, mimetype, buffer, size: buffer.length });
    } else {
      fieldCount++;
      if (fieldCount > 8 || Buffer.byteLength(payload, "latin1") > 20_000)
        throw invalidUpload();
      // The body was read as latin1 to keep file bytes intact; text fields are UTF-8.
      fields[fieldName] = Buffer.from(payload, "latin1").toString("utf8");
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
  return { files, fields };
}

/** Applied only to authenticated ticket mutations. */
export const receiveTicketFiles: RequestHandler = (req, res, next) => {
  // Text-only requests may be plain JSON (already parsed by express.json()); they carry no files.
  if (req.is("application/json")) {
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

    if (error) {
      return next(error);
    }

    try {
      res.locals.ticketFiles = (
        Array.isArray(req.files) ? req.files : []
      ).map(validateEvidence);

      next();
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

  void readMultipart(req)
    .then(({ files, fields }) => {
      res.locals.ticketFiles = files.map(validateEvidence);
      // Validation runs on req.body next, so the form fields must be there.
      req.body = fields;
      next();
    })
    .catch(next);
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
