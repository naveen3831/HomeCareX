import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import type { RequestHandler } from 'express';
import multer from 'multer';
import { HttpError } from '../auth/auth.types';

/**
 * "Before work" proof sent with POST /partner/jobs/:id/verify-start:
 * up to 6 photos (JPG/PNG, 5 MB each) and 1 optional video (MP4/WebM/MOV, 50 MB).
 *
 * Files are checked by their real bytes, written under JOB_PROOF_STORAGE_DIR with a random name,
 * and only their metadata is kept on the booking (booking.startProof). They are never served as
 * public static files.
 */
export const MAX_START_PHOTOS = 6;
export const MAX_START_PHOTO_BYTES = 5 * 1024 * 1024;
export const MAX_START_VIDEO_BYTES = 50 * 1024 * 1024;

export interface StartMedia {
  kind: 'photo' | 'video';
  mimeType: string;
  ext: string;
  size: number;
  data: Buffer;
}

export interface StartProofRecord {
  kind: 'photo' | 'video';
  storageKey: string;
  mimeType: string;
  size: number;
  uploadedAt: Date;
}

const bad = (message: string) => new HttpError(400, message, 'INVALID_FILE');

const startsWith = (buf: Buffer, bytes: number[], offset = 0) =>
  bytes.every((b, i) => buf[offset + i] === b);

/** Trust the bytes, not the declared type. */
function classify(file: Express.Multer.File): StartMedia {
  const { buffer, mimetype, size } = file;
  if (!size || buffer.length !== size) throw bad('One of the files is empty or damaged.');

  if (mimetype === 'image/jpeg' && startsWith(buffer, [0xff, 0xd8, 0xff])) {
    return { kind: 'photo', mimeType: mimetype, ext: 'jpg', size, data: buffer };
  }
  if (mimetype === 'image/png' && startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { kind: 'photo', mimeType: mimetype, ext: 'png', size, data: buffer };
  }
  // MP4 and MOV both carry an "ftyp" box at byte 4.
  if ((mimetype === 'video/mp4' || mimetype === 'video/quicktime') && buffer.subarray(4, 8).toString('ascii') === 'ftyp') {
    return { kind: 'video', mimeType: mimetype, ext: mimetype === 'video/mp4' ? 'mp4' : 'mov', size, data: buffer };
  }
  if (mimetype === 'video/webm' && startsWith(buffer, [0x1a, 0x45, 0xdf, 0xa3])) {
    return { kind: 'video', mimeType: mimetype, ext: 'webm', size, data: buffer };
  }
  throw bad('Upload JPG or PNG photos and an MP4, WebM or MOV video.');
}

const receive = multer({
  storage: multer.memoryStorage(),
  // The per-type limits are enforced in classify's caller; this is the ceiling for the largest file (the video).
  limits: { fileSize: MAX_START_VIDEO_BYTES, files: MAX_START_PHOTOS + 1 },
}).fields([
  { name: 'photo', maxCount: 1 }, // older clients
  { name: 'photos', maxCount: MAX_START_PHOTOS },
  { name: 'video', maxCount: 1 },
]);

/** Plain JSON (no files) passes straight through. Multipart is parsed, checked and put on res.locals.startMedia. */
export const receiveStartMedia: RequestHandler = (req, res, next) => {
  if (req.is('application/json')) {
    res.locals.startMedia = [] as StartMedia[];
    return next();
  }

  receive(req, res, (error: unknown) => {
    if (error instanceof multer.MulterError) {
      const message =
        error.code === 'LIMIT_FILE_SIZE'
          ? 'A file is too large. Photos can be up to 5 MB and the video up to 50 MB.'
          : `Send up to ${MAX_START_PHOTOS} photos and 1 video.`;
      return next(new HttpError(400, message, 'INVALID_FILE'));
    }
    if (error) return next(error);

    try {
      const groups = (req.files ?? {}) as Record<string, Express.Multer.File[]>;
      const photoFiles = [...(groups.photo ?? []), ...(groups.photos ?? [])];
      const videoFiles = groups.video ?? [];

      if (photoFiles.length > MAX_START_PHOTOS) throw bad(`Send up to ${MAX_START_PHOTOS} photos.`);

      const media: StartMedia[] = [];
      for (const file of photoFiles) {
        const item = classify(file);
        if (item.kind !== 'photo') throw bad('Photos must be JPG or PNG.');
        if (item.size > MAX_START_PHOTO_BYTES) throw bad('Each photo must be 5 MB or smaller.');
        media.push(item);
      }
      for (const file of videoFiles) {
        const item = classify(file);
        if (item.kind !== 'video') throw bad('The video must be MP4, WebM or MOV.');
        media.push(item);
      }

      res.locals.startMedia = media;
      return next();
    } catch (err) {
      return next(err);
    }
  });
};

const storageDir = () =>
  process.env.JOB_PROOF_STORAGE_DIR || path.resolve(__dirname, '../../../storage/job-proof');

/** Writes the files and returns the metadata to keep on the booking. */
export async function saveStartProof(
  bookingId: string,
  media: StartMedia[],
  now: Date = new Date(),
): Promise<StartProofRecord[]> {
  if (media.length === 0) return [];
  const dir = path.join(storageDir(), bookingId);
  await fs.mkdir(dir, { recursive: true });

  const records: StartProofRecord[] = [];
  for (const item of media) {
    const name = `${crypto.randomUUID()}.${item.ext}`;
    await fs.writeFile(path.join(dir, name), item.data, { mode: 0o600 });
    records.push({
      kind: item.kind,
      storageKey: `${bookingId}/${name}`,
      mimeType: item.mimeType,
      size: item.size,
      uploadedAt: now,
    });
  }
  return records;
}
